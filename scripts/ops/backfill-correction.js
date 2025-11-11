#!/usr/bin/env node

/**
 * Backfill Correction Script
 * Identifies and corrects failed parsing operations
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/ops/backfill-correction.js
 *
 * Environment variables:
 *   CORRECTION_BATCH_SIZE: Number of failed tweets to process per batch (default: 10)
 *   MAX_CORRECTIONS: Maximum number of corrections to attempt (default: 100)
 *   DRY_RUN: If set, only identify issues without fixing (default: false)
 */

require('ts-node').register({
  transpileOnly: true,
  project: require('path').join(__dirname, '../tsconfig.scripts.json'),
});
const { Pool } = require('pg');
const { ThreeLayerConsensusEngine } = require('../../src/lib/parsing/three-layer-consensus-engine');
const { RateLimiter } = require('../../src/lib/parsing/rate-limiter');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function identifyFailedParsing() {
  console.log('🔍 Identifying failed parsing operations...');

  // Find tweets that failed parsing
  const failedTweets = await pool.query(`
    SELECT
      rt.tweet_id,
      rt.text,
      rt.created_at,
      rt.processing_status,
      pe.overall_confidence,
      pe.needs_review,
      pe.parsed_at
    FROM raw_tweets rt
    LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
    WHERE rt.processing_status = 'failed'
       OR (rt.processing_status = 'parsed' AND pe.overall_confidence < 0.3)
    ORDER BY rt.created_at DESC
  `);

  // Find parsed events with data quality issues
  const qualityIssues = await pool.query(`
    SELECT
      tweet_id,
      overall_confidence,
      event_type,
      locations,
      parsed_at
    FROM parsed_events
    WHERE overall_confidence < 0.5
       OR (event_type IS NULL AND overall_confidence > 0.7)
       OR (locations IS NULL AND overall_confidence > 0.7)
    ORDER BY overall_confidence ASC
  `);

  return {
    failedTweets: failedTweets.rows,
    qualityIssues: qualityIssues.rows,
    totalIssues: failedTweets.rows.length + qualityIssues.rows.length
  };
}

async function getTweetDetails(tweetId) {
  const result = await pool.query(`
    SELECT tweet_id, text, created_at, author_handle,
           retweet_count, reply_count, like_count, quote_count,
           hashtags, mentions, urls
    FROM raw_tweets
    WHERE tweet_id = $1
  `, [tweetId]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    tweet_id: row.tweet_id,
    text: row.text,
    created_at: row.created_at,
    author_handle: row.author_handle,
    retweet_count: parseInt(row.retweet_count) || 0,
    reply_count: parseInt(row.reply_count) || 0,
    like_count: parseInt(row.like_count) || 0,
    quote_count: parseInt(row.quote_count) || 0,
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : row.hashtags ? JSON.parse(row.hashtags) : [],
    mentions: Array.isArray(row.mentions) ? row.mentions : row.mentions ? JSON.parse(row.mentions) : [],
    urls: Array.isArray(row.urls) ? row.urls : row.urls ? JSON.parse(row.urls) : [],
  };
}

async function updateTweetStatus(tweetId, status) {
  await pool.query(`
    UPDATE raw_tweets
    SET processing_status = $1, processed_at = NOW()
    WHERE tweet_id = $2
  `, [status, tweetId]);
}

async function saveCorrectedEvent(parsedResult) {
  const { getEventTypeInHindi } = await import('../../src/lib/i18n/event-types-hi.ts');

  await pool.query(`
    INSERT INTO parsed_events (
      tweet_id, event_type, event_type_hi, event_type_confidence,
      event_date, date_confidence, locations, people_mentioned,
      organizations, schemes_mentioned, overall_confidence,
      needs_review, review_status, parsed_at, parsed_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (tweet_id) DO UPDATE SET
      event_type = EXCLUDED.event_type,
      event_type_hi = EXCLUDED.event_type_hi,
      event_type_confidence = EXCLUDED.event_type_confidence,
      event_date = EXCLUDED.event_date,
      date_confidence = EXCLUDED.date_confidence,
      locations = EXCLUDED.locations,
      people_mentioned = EXCLUDED.people_mentioned,
      organizations = EXCLUDED.organizations,
      schemes_mentioned = EXCLUDED.schemes_mentioned,
      overall_confidence = EXCLUDED.overall_confidence,
      needs_review = EXCLUDED.needs_review,
      review_status = 'pending', -- Reset review status for re-parsing
      parsed_at = EXCLUDED.parsed_at,
      parsed_by = EXCLUDED.parsed_by || '_corrected'
  `, [
    parsedResult.tweet_id,
    parsedResult.event_type,
    parsedResult.event_type_hi || getEventTypeInHindi(parsedResult.event_type),
    parsedResult.event_type_confidence,
    parsedResult.event_date,
    parsedResult.date_confidence,
    JSON.stringify(parsedResult.locations || []),
    parsedResult.people_mentioned || [],
    parsedResult.organizations || [],
    parsedResult.schemes_mentioned || [],
    parsedResult.overall_confidence,
    parsedResult.needs_review,
    parsedResult.review_status || 'pending',
    new Date(),
    parsedResult.parsed_by
  ]);
}

async function initializeCorrectionEngine() {
  // More aggressive rate limits for corrections (since we're being more selective)
  const rateLimiter = new RateLimiter({
    geminiRequestsPerMinute: 5, // 5 RPM for corrections
    ollamaRequestsPerMinute: 60, // 60 RPM for corrections
    regexRequestsPerMinute: 1000
  });

  const engine = new ThreeLayerConsensusEngine({
    rateLimiter,
    consensusThreshold: 0.7, // Higher threshold for corrections
    enableFallback: true,
    logLevel: 'info',
    geminiModel: 'gemini-pro',
    ollamaModel: 'gemma2:2b'
  });

  return engine;
}

async function performCorrections(issues, engine, options = {}) {
  const { batchSize = 10, maxCorrections = 100, dryRun = false } = options;

  console.log(`🔧 Starting corrections (batch size: ${batchSize}, max: ${maxCorrections}, dry-run: ${dryRun})`);

  let totalCorrected = 0;
  let totalFailed = 0;

  // Process in batches
  for (let i = 0; i < issues.length && totalCorrected < maxCorrections; i += batchSize) {
    const batch = issues.slice(i, i + batchSize);
    console.log(`\n📦 Correction batch ${Math.floor(i/batchSize) + 1}: Processing ${batch.length} tweets...`);

    for (const issue of batch) {
      if (totalCorrected >= maxCorrections) break;

      try {
        const tweetDetails = await getTweetDetails(issue.tweet_id);
        if (!tweetDetails) {
          console.log(`  ⚠️  Tweet ${issue.tweet_id} not found, skipping`);
          continue;
        }

        console.log(`  🔄 Correcting tweet ${issue.tweet_id}...`);

        if (!dryRun) {
          const correctedResult = await engine.parseTweet(
            tweetDetails.text,
            tweetDetails.tweet_id,
            new Date(tweetDetails.created_at)
          );

          // Only save if confidence improved significantly
          const confidenceImproved = correctedResult.overall_confidence > (issue.overall_confidence || 0) + 0.2;

          if (confidenceImproved || !issue.overall_confidence) {
            await saveCorrectedEvent(correctedResult);
            await updateTweetStatus(issue.tweet_id, 'parsed');

            console.log(`  ✅ Corrected: ${correctedResult.event_type} (${(correctedResult.overall_confidence * 100).toFixed(1)}% confidence, improved: ${confidenceImproved})`);
            totalCorrected++;
          } else {
            console.log(`  ⏭️  Skipped: No significant improvement (${(correctedResult.overall_confidence * 100).toFixed(1)}% vs ${(issue.overall_confidence * 100).toFixed(1)}%)`);
          }
        } else {
          console.log(`  📋 Would correct: ${issue.tweet_id} (dry-run)`);
          totalCorrected++;
        }

        // Rate limiting delay
        const delayMs = 15000; // 15 seconds between corrections
        console.log(`  ⏳ Waiting ${delayMs/1000}s before next correction...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

      } catch (error) {
        console.error(`  ❌ Failed to correct tweet ${issue.tweet_id}:`, error.message);
        if (!dryRun) {
          await updateTweetStatus(issue.tweet_id, 'failed');
        }
        totalFailed++;
      }
    }
  }

  return { totalCorrected, totalFailed };
}

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';
  const batchSize = parseInt(process.env.CORRECTION_BATCH_SIZE || '10', 10);
  const maxCorrections = parseInt(process.env.MAX_CORRECTIONS || '100', 10);

  console.log('🚀 Starting backfill correction process');
  console.log(`📊 Configuration:`);
  console.log(`   - Batch size: ${batchSize}`);
  console.log(`   - Max corrections: ${maxCorrections}`);
  console.log(`   - Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log('');

  try {
    // Identify issues
    const issues = await identifyFailedParsing();

    console.log(`📈 Issues identified:`);
    console.log(`   - Failed tweets: ${issues.failedTweets.length}`);
    console.log(`   - Quality issues: ${issues.qualityIssues.length}`);
    console.log(`   - Total issues: ${issues.totalIssues}`);
    console.log('');

    if (issues.totalIssues === 0) {
      console.log('✅ No issues found. Backfill correction not needed.');
      return;
    }

    if (dryRun) {
      console.log('ℹ️  Dry run mode: Would process the following issues:');
      issues.failedTweets.slice(0, 5).forEach(tweet => {
        console.log(`   - Failed tweet: ${tweet.tweet_id} (${tweet.processing_status})`);
      });
      issues.qualityIssues.slice(0, 5).forEach(issue => {
        console.log(`   - Quality issue: ${issue.tweet_id} (${(issue.overall_confidence * 100).toFixed(1)}% confidence)`);
      });
      console.log(`\nℹ️  Run without DRY_RUN=true to perform actual corrections.`);
      return;
    }

    // Initialize correction engine
    const engine = await initializeCorrectionEngine();

    // Combine and prioritize issues (failed tweets first, then quality issues)
    const allIssues = [
      ...issues.failedTweets.map(tweet => ({ ...tweet, issueType: 'failed' })),
      ...issues.qualityIssues.map(issue => ({ ...issue, issueType: 'quality' }))
    ];

    // Perform corrections
    const results = await performCorrections(allIssues, engine, {
      batchSize,
      maxCorrections,
      dryRun
    });

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Backfill correction complete!');
    console.log('='.repeat(60));
    console.log(`✅ Successfully corrected: ${results.totalCorrected} tweets`);
    console.log(`❌ Failed corrections: ${results.totalFailed} tweets`);

    // Final status
    const finalIssues = await identifyFailedParsing();
    console.log(`📊 Remaining issues: ${finalIssues.totalIssues}`);

  } catch (error) {
    console.error('❌ Fatal error during backfill correction:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { identifyFailedParsing, performCorrections };