#!/usr/bin/env node

/**
 * Pipeline Health Validation Script
 *
 * Validates the end-to-end pipeline health:
 * - Fetch job status (recent fetches)
 * - Parse queue status (pending tweets)
 * - Review queue status (needs_review count)
 * - Analytics data availability
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/ops/pipeline-health.js
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

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

async function checkPipelineHealth() {
  const client = await pool.connect();
  
  try {
    // 1. Fetch job metrics
    const fetchMetrics = await client.query(`
      SELECT
        COUNT(*) AS total_tweets,
        COUNT(*) FILTER (WHERE processing_status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE processing_status = 'parsed') AS parsed,
        COUNT(*) FILTER (WHERE processing_status = 'failed') AS failed,
        MAX(fetched_at) AS last_fetch_time,
        COUNT(*) FILTER (WHERE fetched_at > NOW() - INTERVAL '1 hour') AS fetched_last_hour
      FROM raw_tweets
    `);
    
    // 2. Parse queue metrics
    const parseMetrics = await client.query(`
      SELECT
        COUNT(*) AS pending_count
      FROM raw_tweets
      WHERE processing_status = 'pending'
    `);
    
    // 3. Review queue metrics
    const reviewMetrics = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE needs_review = true) AS needs_review,
        COUNT(*) FILTER (WHERE review_status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE review_status = 'pending') AS pending_review
      FROM parsed_events
    `);
    
    // 4. Analytics-ready metrics (approved events)
    const analyticsMetrics = await client.query(`
      SELECT COUNT(*) AS analytics_ready
      FROM parsed_events
      WHERE needs_review = false 
        AND (review_status IS NULL OR review_status = 'approved')
    `);
    
    // 5. Recent activity (last 24h)
    const recentActivity = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE fetched_at > NOW() - INTERVAL '24 hours') AS tweets_fetched_24h,
        COUNT(*) FILTER (WHERE processed_at > NOW() - INTERVAL '24 hours' AND processing_status = 'parsed') AS tweets_parsed_24h,
        COUNT(*) FILTER (WHERE reviewed_at > NOW() - INTERVAL '24 hours') AS tweets_reviewed_24h
      FROM raw_tweets rt
      LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
    `);
    
    const fetch = fetchMetrics.rows[0] || {};
    const parse = parseMetrics.rows[0] || {};
    const review = reviewMetrics.rows[0] || {};
    const analytics = analyticsMetrics.rows[0] || {};
    const recent = recentActivity.rows[0] || {};
    
    // Calculate health scores
    const fetchHealth = fetch.fetched_last_hour > 0 ? 'healthy' : 'stale';
    const parseHealth = parseInt(parse.pending_count || '0', 10) < 100 ? 'healthy' : 'backlog';
    const reviewHealth = parseInt(review.needs_review || '0', 10) < 25 ? 'healthy' : 'backlog';
    
    const health = {
      overall: fetchHealth === 'healthy' && parseHealth === 'healthy' && reviewHealth === 'healthy' ? 'healthy' : 'needs_attention',
      fetch: fetchHealth,
      parse: parseHealth,
      review: reviewHealth,
    };
    
    return {
      health,
      metrics: {
        fetch: {
          total: parseInt(fetch.total_tweets || '0', 10),
          pending: parseInt(fetch.pending || '0', 10),
          parsed: parseInt(fetch.parsed || '0', 10),
          failed: parseInt(fetch.failed || '0', 10),
          last_fetch_time: fetch.last_fetch_time,
          fetched_last_hour: parseInt(fetch.fetched_last_hour || '0', 10),
        },
        parse: {
          pending: parseInt(parse.pending_count || '0', 10),
        },
        review: {
          needs_review: parseInt(review.needs_review || '0', 10),
          approved: parseInt(review.approved || '0', 10),
          pending_review: parseInt(review.pending_review || '0', 10),
        },
        analytics: {
          ready: parseInt(analytics.analytics_ready || '0', 10),
        },
        recent_24h: {
          tweets_fetched: parseInt(recent.tweets_fetched_24h || '0', 10),
          tweets_parsed: parseInt(recent.tweets_parsed_24h || '0', 10),
          tweets_reviewed: parseInt(recent.tweets_reviewed_24h || '0', 10),
        },
      },
    };
  } finally {
    client.release();
  }
}

function formatHealthReport(healthData) {
  const { health, metrics } = healthData;
  
  const lines = [
    '╔══════════════════════════════════════════════════════════╗',
    '║         Pipeline Health Dashboard                        ║',
    '╚══════════════════════════════════════════════════════════╝',
    '',
    `Overall Status: ${health.overall === 'healthy' ? '✅ HEALTHY' : '⚠️  NEEDS ATTENTION'}`,
    '',
    '📥 Fetch Pipeline:',
    `   Status: ${health.fetch === 'healthy' ? '✅' : '⚠️ '} ${health.fetch.toUpperCase()}`,
    `   Total Tweets: ${metrics.fetch.total}`,
    `   Pending: ${metrics.fetch.pending}`,
    `   Parsed: ${metrics.fetch.parsed}`,
    `   Failed: ${metrics.fetch.failed}`,
    `   Last Fetch: ${metrics.fetch.last_fetch_time || 'Never'}`,
    `   Fetched Last Hour: ${metrics.fetch.fetched_last_hour}`,
    '',
    '🔄 Parse Pipeline:',
    `   Status: ${health.parse === 'healthy' ? '✅' : '⚠️ '} ${health.parse.toUpperCase()}`,
    `   Pending Queue: ${metrics.parse.pending}`,
    '',
    '👁️  Review Pipeline:',
    `   Status: ${health.review === 'healthy' ? '✅' : '⚠️ '} ${health.review.toUpperCase()}`,
    `   Needs Review: ${metrics.review.needs_review}`,
    `   Approved: ${metrics.review.approved}`,
    '',
    '📊 Analytics:',
    `   Ready for Analytics: ${metrics.analytics.ready}`,
    '',
    '📈 Last 24 Hours:',
    `   Fetched: ${metrics.recent_24h.tweets_fetched}`,
    `   Parsed: ${metrics.recent_24h.tweets_parsed}`,
    `   Reviewed: ${metrics.recent_24h.tweets_reviewed}`,
    '',
  ];
  
  return lines.join('\n');
}

(async () => {
  try {
    const healthData = await checkPipelineHealth();
    
    // Print formatted report
    console.log(formatHealthReport(healthData));
    
    // Also emit JSON for programmatic access
    const payload = {
      generated_at: new Date().toISOString(),
      ...healthData,
    };
    
    console.log('\n--- JSON Output ---');
    console.log(JSON.stringify(payload, null, 2));
    
    // Exit with non-zero if unhealthy
    if (healthData.health.overall !== 'healthy') {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Pipeline health check failed:', error);
    process.exit(2);
  } finally {
    await pool.end();
  }
})();

