#!/usr/bin/env node

/**
 * One-Time Script: Parse All Pending Tweets
 *
 * Processes all tweets in raw_tweets table where processing_status='pending'.
 * This is a ONE-TIME operation to backfill parsing for existing tweets.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/ops/parse-all-pending-tweets.js
 *
 * Environment variables:
 *   PARSE_BATCH_LIMIT: Number of tweets to process per batch (default: 25)
 *   MAX_BATCHES: Maximum number of batches to process (default: unlimited)
 *   DRY_RUN: If set, only count tweets without parsing (default: false)
 */

require('ts-node').register({
  transpileOnly: true,
  project: require('path').join(__dirname, '../tsconfig.scripts.json'),
});
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function getPendingTweetsCount() {
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM raw_tweets
    WHERE processing_status = 'pending'
  `);
  return parseInt(result.rows[0]?.count || '0', 10);
}

async function getPendingTweetsBatch(limit = 25) {
  const result = await pool.query(`
    SELECT tweet_id, text, created_at, author_handle,
           retweet_count, reply_count, like_count, quote_count,
           hashtags, mentions, urls
    FROM raw_tweets
    WHERE processing_status = 'pending'
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  return result.rows.map(row => ({
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
  }));
}

async function updateTweetStatus(tweetId, status) {
  await pool.query(`
    UPDATE raw_tweets
    SET processing_status = $1, fetched_at = NOW()
    WHERE tweet_id = $2
  `, [status, tweetId]);
}

async function saveParsedEvent(parsedResult) {
  const { getEventTypeInHindi } = await import('../../src/lib/i18n/event-types-hi.ts');

  // First delete any existing parsed event for this tweet
  await pool.query(`
    DELETE FROM parsed_events WHERE tweet_id = $1
  `, [parsedResult.tweet_id]);

  // Then insert the new one
  await pool.query(`
    INSERT INTO parsed_events (
      tweet_id, event_type, event_type_hi, event_type_confidence,
      event_date, date_confidence, locations, people_mentioned,
      organizations, schemes_mentioned, overall_confidence,
      needs_review, review_status, parsed_at, parsed_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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

async function initializeParsingEngine() {
  const { RateLimiter } = await import('../../src/lib/parsing/rate-limiter.ts');
  const { ThreeLayerConsensusEngine } = await import('../../src/lib/parsing/three-layer-consensus-engine.ts');
  // Very conservative rate limits to respect API limits
  // Gemini free tier: ~2-3 requests per minute
  // Ollama local: can handle more, but be conservative
  const rateLimiter = new RateLimiter({
    geminiRPM: 2, // Very conservative: 2 RPM = 1 request every 30 seconds
    ollamaRPM: 30, // Conservative: 30 RPM = 1 request every 2 seconds
    maxRetries: 3,
    backoffMultiplier: 2,
    initialBackoffMs: 5000,
  });

  const engine = new ThreeLayerConsensusEngine({
    rateLimiter,
    consensusThreshold: 0.6,
    enableFallback: true,
    logLevel: 'info',
    geminiModel: 'gemini-1.5-flash',
    ollamaModel: 'gemma2:2b'
  });

  return engine;
}

async function main() {
  const dryRun = process.env.DRY_RUN === 'true';
  const batchLimit = parseInt(process.env.PARSE_BATCH_LIMIT || '25', 10);
  const maxBatches = process.env.MAX_BATCHES ? parseInt(process.env.MAX_BATCHES, 10) : null;

  console.log('🚀 Starting one-time backfill: Parse All Pending Tweets');
  console.log(`📊 Configuration:`);
  console.log(`   - Batch size: ${batchLimit}`);
  console.log(`   - Max batches: ${maxBatches || 'unlimited'}`);
  console.log(`   - Dry run: ${dryRun ? 'YES (counting only)' : 'NO (will parse)'}`);
  console.log('');

  // Count total pending tweets
  const totalPending = await getPendingTweetsCount();
  console.log(`📈 Total pending tweets: ${totalPending}`);

  if (totalPending === 0) {
    console.log('✅ No pending tweets to parse. Exiting.');
    return;
  }

  if (dryRun) {
    console.log('ℹ️  Dry run mode: Exiting without parsing.');
    return;
  }

  let engine;
  try {
    engine = await initializeParsingEngine();
  } catch (error) {
    console.error('❌ Failed to initialize parsing engine:', error);
    process.exit(1);
  }

  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let batchNumber = 0;

  while (true) {
    // Check if we've hit max batches
    if (maxBatches && batchNumber >= maxBatches) {
      console.log(`\n⚠️  Reached max batches limit (${maxBatches}). Stopping.`);
      break;
    }

    // Get next batch
    const tweets = await getPendingTweetsBatch(batchLimit);
    
    if (tweets.length === 0) {
      console.log('\n✅ All pending tweets processed!');
      break;
    }

    batchNumber++;
    console.log(`\n📦 Batch #${batchNumber}: Processing ${tweets.length} tweets...`);

    let batchSuccess = 0;
    let batchFailed = 0;

    // Process each tweet in batch
    for (const tweet of tweets) {
      try {
        console.log(`  🔄 Parsing tweet ${tweet.tweet_id}...`);

        const parsedResult = await engine.parseTweet(
          tweet.text,
          tweet.tweet_id,
          new Date(tweet.created_at)
        );

        // Save parsed result
        await saveParsedEvent(parsedResult);

        // Update tweet status
        await updateTweetStatus(tweet.tweet_id, 'parsed');

        batchSuccess++;
        totalSuccess++;
        totalProcessed++;

        console.log(`  ✅ Parsed: ${parsedResult.event_type} (${(parsedResult.overall_confidence * 100).toFixed(1)}% confidence)`);

        // Conservative delay to respect rate limits
        // Gemini: 2 RPM = 30 seconds between requests
        // Add extra buffer for safety
        const delayMs = 35000; // 35 seconds between tweets (conservative)
        console.log(`  ⏳ Waiting ${delayMs/1000}s before next tweet (rate limit protection)...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

      } catch (error) {
        console.error(`  ❌ Failed to parse tweet ${tweet.tweet_id}:`, error.message);
        await updateTweetStatus(tweet.tweet_id, 'failed');
        batchFailed++;
        totalFailed++;
        totalProcessed++;
      }
    }

    console.log(`  📊 Batch #${batchNumber} complete: ${batchSuccess} success, ${batchFailed} failed`);

    // Progress update
    const remaining = await getPendingTweetsCount();
    const progress = totalPending > 0 ? ((totalProcessed / totalPending) * 100).toFixed(1) : 0;
    console.log(`  📈 Progress: ${totalProcessed}/${totalPending} (${progress}%) | Remaining: ${remaining}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Backfill Complete!');
  console.log('='.repeat(60));
  console.log(`✅ Successfully parsed: ${totalSuccess} tweets`);
  console.log(`❌ Failed to parse: ${totalFailed} tweets`);
  console.log(`📊 Total processed: ${totalProcessed} tweets`);
  
  const finalPending = await getPendingTweetsCount();
  if (finalPending > 0) {
    console.log(`⚠️  Still pending: ${finalPending} tweets`);
  } else {
    console.log(`✅ All tweets processed!`);
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
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { main };

