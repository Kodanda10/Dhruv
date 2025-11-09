#!/usr/bin/env node

/**
 * Database Helper Functions
 * Used by pipeline scripts for database operations
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.includes('localhost')
      ? { rejectUnauthorized: false }
      : false,
});

async function getTweetCount() {
  const result = await pool.query('SELECT COUNT(*) as count FROM raw_tweets');
  return parseInt(result.rows[0]?.count || '0', 10);
}

async function getPendingTweetCount() {
  const result = await pool.query(
    "SELECT COUNT(*) as count FROM raw_tweets WHERE processing_status = 'pending'"
  );
  return parseInt(result.rows[0]?.count || '0', 10);
}

async function getParsedEventCount() {
  const result = await pool.query('SELECT COUNT(*) as count FROM parsed_events');
  return parseInt(result.rows[0]?.count || '0', 10);
}

async function getApprovedEventCount() {
  const result = await pool.query(`
    SELECT COUNT(*) as count 
    FROM parsed_events 
    WHERE needs_review = false 
      AND (review_status IS NULL OR review_status = 'approved')
  `);
  return parseInt(result.rows[0]?.count || '0', 10);
}

async function removeSampleTweets() {
  // Check if is_sample column exists
  const columnCheck = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'raw_tweets' AND column_name = 'is_sample'
  `);
  
  if (columnCheck.rows.length === 0) {
    console.log('ℹ️  is_sample column does not exist - skipping sample removal');
    return { deleted: 0 };
  }
  
  const result = await pool.query(`
    DELETE FROM raw_tweets WHERE is_sample = true
  `);
  
  return { deleted: result.rowCount || 0 };
}

async function removeSampleParsedEvents() {
  const columnCheck = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'parsed_events' AND column_name = 'is_sample'
  `);
  
  if (columnCheck.rows.length === 0) {
    console.log('ℹ️  is_sample column does not exist in parsed_events - skipping');
    return { deleted: 0 };
  }
  
  const result = await pool.query(`
    DELETE FROM parsed_events WHERE is_sample = true
  `);
  
  return { deleted: result.rowCount || '0' };
}

async function getPipelineStats() {
  const [rawStats, parsedStats, reviewStats] = await Promise.all([
    pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE processing_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE processing_status = 'parsed') as parsed,
        COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
        COUNT(*) as total
      FROM raw_tweets
    `),
    pool.query('SELECT COUNT(*) as total FROM parsed_events'),
    pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE needs_review = true) as needs_review,
        COUNT(*) FILTER (WHERE review_status = 'approved') as approved,
        COUNT(*) FILTER (WHERE review_status = 'rejected') as rejected
      FROM parsed_events
    `),
  ]);
  
  return {
    raw: rawStats.rows[0] || {},
    parsed: parsedStats.rows[0] || {},
    review: reviewStats.rows[0] || {},
  };
}

module.exports = {
  pool,
  getTweetCount,
  getPendingTweetCount,
  getParsedEventCount,
  getApprovedEventCount,
  removeSampleTweets,
  removeSampleParsedEvents,
  getPipelineStats,
};

