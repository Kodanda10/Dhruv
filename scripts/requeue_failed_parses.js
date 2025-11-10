#!/usr/bin/env node

/**
 * Requeue Failed Parses
 * Finds tweets that were parsed but resulted in empty data fields
 * and resets their status to 'pending' for re-processing.
 */

require('ts-node').register({
  transpileOnly: true,
  project: require('path').join(__dirname, 'tsconfig.scripts.json'),
});
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function requeueFailedParses() {
  let client;
  try {
    client = await pool.connect();
    console.log('🚀 Finding parsed events with empty data fields to requeue...');

    // Find tweet_ids from parsed_events that have null or empty arrays for key data fields.
    // This indicates a likely parsing failure that needs reprocessing.
    const findRes = await client.query(`
      SELECT tweet_id
      FROM parsed_events
      WHERE 
        (locations IS NULL OR locations = '[]') AND
        (people_mentioned IS NULL OR people_mentioned = '{}') AND
        (organizations IS NULL OR organizations = '{}') AND
        (schemes_mentioned IS NULL OR schemes_mentioned = '{}')
    `);

    const tweetIdsToRequeue = findRes.rows.map(r => r.tweet_id);

    if (tweetIdsToRequeue.length === 0) {
      console.log('✅ No tweets found that require re-parsing.');
      return;
    }

    console.log(`🔍 Found ${tweetIdsToRequeue.length} tweets to requeue for parsing.`);

    // Begin a transaction
    await client.query('BEGIN');

    // Update the processing_status in raw_tweets back to 'pending'
    const updateRes = await client.query(`
      UPDATE raw_tweets
      SET processing_status = 'pending'
      WHERE tweet_id = ANY($1::varchar[])
    `, [tweetIdsToRequeue]);

    // Delete the old, incorrect entries from parsed_events to allow for clean re-insertion
    const deleteRes = await client.query(`
      DELETE FROM parsed_events
      WHERE tweet_id = ANY($1::varchar[])
    `, [tweetIdsToRequeue]);

    // Commit the transaction
    await client.query('COMMIT');

    console.log(`✅ Successfully requeued ${updateRes.rowCount} tweets for re-parsing.`);
    console.log(`🗑️  Cleaned up ${deleteRes.rowCount} old entries from parsed_events.`);
    console.log('The automated pipeline will now re-process these tweets on its next run.');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('❌ Error requeueing tweets:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

if (require.main === module) {
  requeueFailedParses();
}
