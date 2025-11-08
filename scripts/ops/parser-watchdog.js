#!/usr/bin/env node

/**
 * Parser Watchdog - Requeue Failed Rows
 *
 * Monitors parsed_events and raw_tweets for failed processing attempts
 * and requeues them after a configurable delay (default: 4 hours).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/ops/parser-watchdog.js
 *
 * Environment variables:
 *   RETRY_DELAY_HOURS: Hours to wait before retrying failed rows (default: 4)
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL env var is required');
  process.exit(2);
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')
      ? { rejectUnauthorized: false }
      : false,
});

const RETRY_DELAY_HOURS = parseInt(process.env.RETRY_DELAY_HOURS || '4', 10);

async function requeueFailedTweets() {
  const client = await pool.connect();
  
  try {
    // Find tweets that failed processing more than RETRY_DELAY_HOURS ago
    const requeueQuery = `
      UPDATE raw_tweets
      SET processing_status = 'pending',
          processed_at = NULL
      WHERE processing_status = 'failed'
        AND processed_at < NOW() - INTERVAL '${RETRY_DELAY_HOURS} hours'
      RETURNING tweet_id, processed_at
    `;
    
    const result = await client.query(requeueQuery);
    const requeuedCount = result.rowCount || 0;
    
    if (requeuedCount > 0) {
      console.log(`✅ Requeued ${requeuedCount} failed tweets for retry`);
      result.rows.forEach((row) => {
        console.log(`   - Tweet ${row.tweet_id} (failed at ${row.processed_at})`);
      });
    } else {
      console.log('ℹ️  No failed tweets ready for retry');
    }
    
    // Also check for parsed_events that might need attention
    const failedParseQuery = `
      SELECT COUNT(*) as count
      FROM raw_tweets
      WHERE processing_status = 'failed'
        AND processed_at < NOW() - INTERVAL '${RETRY_DELAY_HOURS} hours'
    `;
    
    const failedResult = await client.query(failedParseQuery);
    const stillFailed = parseInt(failedResult.rows[0]?.count || '0', 10);
    
    return {
      requeued: requeuedCount,
      stillFailed,
      retryDelayHours: RETRY_DELAY_HOURS,
    };
  } finally {
    client.release();
  }
}

(async () => {
  try {
    const stats = await requeueFailedTweets();
    
    const payload = {
      generated_at: new Date().toISOString(),
      stats,
    };
    
    console.log(JSON.stringify(payload, null, 2));
    
    if (stats.requeued > 0) {
      console.log(`\n✅ Watchdog completed: ${stats.requeued} tweets requeued`);
    }
  } catch (error) {
    console.error('❌ Watchdog error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

