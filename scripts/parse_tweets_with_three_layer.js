#!/usr/bin/env node

/**
 * Three-Layer Consensus Tweet Parser
 * Processes pending tweets from database using Gemini + Ollama + Regex
 * Runs hourly via GitHub Actions after tweet fetching
 */

require('ts-node').register({
  transpileOnly: true,
  project: require('path').join(__dirname, 'tsconfig.scripts.json'),
});
const { Pool } = require('pg');
const { ThreeLayerConsensusEngine } = require('../src/lib/parsing/three-layer-consensus-engine');
const { RateLimiter } = require('../src/lib/parsing/rate-limiter');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function getPendingTweets(limit = 50) {
  try {
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
      hashtags: Array.isArray(row.hashtags)
        ? row.hashtags
        : row.hashtags
        ? JSON.parse(row.hashtags)
        : [],
      mentions: Array.isArray(row.mentions)
        ? row.mentions
        : row.mentions
        ? JSON.parse(row.mentions)
        : [],
      urls: Array.isArray(row.urls)
        ? row.urls
        : row.urls
        ? JSON.parse(row.urls)
        : [],
    }));
  } catch (error) {
    console.error('Error fetching pending tweets:', error);
    return [];
  }
}

async function updateTweetStatus(tweetId, status) {
  try {
    await pool.query(`
      UPDATE raw_tweets
      SET processing_status = $1, processed_at = NOW()
      WHERE tweet_id = $2
    `, [status, tweetId]);
  } catch (error) {
    console.error(`Error updating tweet ${tweetId} status:`, error);
  }
}

async function saveParsedEvent(parsedResult) {
  try {
    const { getEventTypeInHindi } = await import('../src/lib/i18n/event-types-hi.ts');

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
        review_status = EXCLUDED.review_status,
        parsed_at = EXCLUDED.parsed_at,
        parsed_by = EXCLUDED.parsed_by
    `, [
      parsedResult.tweet_id,
      parsedResult.event_type,
      parsedResult.event_type_hi || getEventTypeInHindi(parsedResult.event_type),
      parsedResult.event_type_confidence,
      parsedResult.event_date,
      parsedResult.date_confidence,
      JSON.stringify(parsedResult.locations || []),
      (parsedResult.people_mentioned || []).map(p => String(p)),
      (parsedResult.organizations || []).map(o => String(o)),
      (parsedResult.schemes_mentioned || []).map(s => String(s)),
      parsedResult.overall_confidence,
      parsedResult.needs_review,
      parsedResult.review_status || 'pending',
      new Date(),
      parsedResult.parsed_by
    ]);
  } catch (error) {
    console.error('Error saving parsed event:', error);
    throw error;
  }
}

async function initializeParsingEngine() {
  // Very conservative rate limits to respect API limits
  // Gemini free tier: ~2-3 requests per minute
  const rateLimiter = new RateLimiter({
    geminiRequestsPerMinute: 2, // Very conservative: 2 RPM = 1 request every 30 seconds
    ollamaRequestsPerMinute: 30, // Conservative: 30 RPM = 1 request every 2 seconds
    regexRequestsPerMinute: 1000
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
  let engine;

  try {
    console.log('🚀 Starting three-layer tweet parsing...');

    // Initialize parsing engine
    engine = await initializeParsingEngine();

    // Get pending tweets
    const maxBatch = Number(process.env.PARSE_BATCH_LIMIT || 25);
    const pendingTweets = await getPendingTweets(maxBatch);
    console.log(`📊 Found ${pendingTweets.length} pending tweets to parse`);

    if (pendingTweets.length === 0) {
      console.log('ℹ️ No pending tweets to parse');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each tweet
    for (const tweet of pendingTweets) {
      try {
        console.log(`🔄 Parsing tweet ${tweet.tweet_id}...`);

        const parsedResult = await engine.parseTweet(
          tweet.text,
          tweet.tweet_id,
          new Date(tweet.created_at)
        );

        // Save parsed result
        await saveParsedEvent(parsedResult);

        // Update tweet status
        await updateTweetStatus(tweet.tweet_id, 'parsed');

        successCount++;
        console.log(`✅ Parsed tweet ${tweet.tweet_id}: ${parsedResult.event_type} (${(parsedResult.overall_confidence * 100).toFixed(1)}% confidence)`);

        // Conservative delay to respect rate limits
        // Gemini: 2 RPM = 30 seconds between requests
        // Add extra buffer for safety
        const delayMs = 35000; // 35 seconds between tweets (conservative)
        console.log(`⏳ Waiting ${delayMs/1000}s before next tweet (rate limit protection)...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

      } catch (error) {
        console.error(`❌ Failed to parse tweet ${tweet.tweet_id}:`, error);
        await updateTweetStatus(tweet.tweet_id, 'failed');
        errorCount++;
      }
    }

    console.log(`\n🎉 Parsing completed:`);
    console.log(`✅ Successfully parsed: ${successCount} tweets`);
    console.log(`❌ Failed to parse: ${errorCount} tweets`);
    console.log(`📊 Total processed: ${successCount + errorCount} tweets`);

  } catch (error) {
    console.error('❌ Error in tweet parsing:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, getPendingTweets, saveParsedEvent };
