#!/usr/bin/env node

/**
 * CommandView Metrics Reporter
 *
 * Generates queue summary + recent actions so Ops can wire this script
 * into Slack/email alerts without opening the dashboard UI.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/ops/commandview-metrics.js
 *
 * Optional thresholds:
 *   CMDVIEW_ALERT_THRESHOLD=<int>  (default: 25)
 *   CMDVIEW_WARN_THRESHOLD=<int>   (default: 10)
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

const ALERT_THRESHOLD = parseInt(process.env.CMDVIEW_ALERT_THRESHOLD || '25', 10);
const WARN_THRESHOLD = parseInt(process.env.CMDVIEW_WARN_THRESHOLD || '10', 10);

async function fetchSummary() {
  const summaryQuery = `
    SELECT
      COUNT(*) FILTER (WHERE needs_review = true) AS needs_review,
      COUNT(*) FILTER (WHERE review_status = 'approved') AS approved,
      COUNT(*) FILTER (WHERE review_status = 'rejected') AS rejected,
      COUNT(*) FILTER (WHERE review_status = 'edited') AS edited,
      COUNT(*) FILTER (WHERE needs_review = false AND (review_status IS NULL OR review_status = 'approved')) AS auto_approved,
      COALESCE(AVG(overall_confidence), 0)::float AS avg_confidence
    FROM parsed_events
  `;

  const recentQuery = `
    SELECT tweet_id, event_type, review_status, reviewed_at::TEXT AS reviewed_at, reviewed_by
    FROM parsed_events
    WHERE reviewed_at IS NOT NULL
    ORDER BY reviewed_at DESC
    LIMIT 5
  `;

  // Fetch pipeline metrics
  const pipelineQuery = `
    SELECT
      (SELECT COUNT(*) FROM raw_tweets WHERE processing_status = 'pending') AS pending_raw,
      (SELECT COUNT(*) FROM raw_tweets WHERE processing_status = 'parsed') AS parsed_raw,
      (SELECT COUNT(*) FROM raw_tweets WHERE processing_status = 'failed') AS failed_raw,
      (SELECT COUNT(*) FROM raw_tweets) AS total_raw,
      (SELECT COUNT(*) FROM parsed_events) AS total_parsed,
      (SELECT MAX(fetched_at) FROM raw_tweets) AS last_fetch_time,
      (SELECT MAX(processed_at) FROM raw_tweets WHERE processing_status = 'parsed') AS last_parse_time
  `;

  const [summaryResult, recentResult, pipelineResult] = await Promise.all([
    pool.query(summaryQuery),
    pool.query(recentQuery),
    pool.query(pipelineQuery),
  ]);

  return {
    summary: summaryResult.rows[0] || {},
    recent: recentResult.rows || [],
    pipeline: pipelineResult.rows[0] || {},
  };
}

function deriveSeverity(needsReview) {
  if (needsReview >= ALERT_THRESHOLD) return 'alert';
  if (needsReview >= WARN_THRESHOLD) return 'warn';
  return 'ok';
}

function formatMessage(summary, pipeline) {
  const parts = [
    `Pending Review: ${summary.needs_review || 0}`,
    `Approved: ${summary.approved || 0}`,
    `Rejected: ${summary.rejected || 0}`,
    `Edited: ${summary.edited || 0}`,
    `Avg confidence: ${Math.round((summary.avg_confidence || 0) * 100)}%`,
  ];
  
  if (pipeline) {
    parts.push(
      `Raw Pending: ${pipeline.pending_raw || 0}`,
      `Raw Parsed: ${pipeline.parsed_raw || 0}`,
      `Raw Failed: ${pipeline.failed_raw || 0}`
    );
  }
  
  return parts.join(' | ');
}

(async () => {
  try {
    const { summary, recent, pipeline } = await fetchSummary();
    const severity = deriveSeverity(Number(summary.needs_review || 0));

    const payload = {
      generated_at: new Date().toISOString(),
      severity,
      summary,
      pipeline,
      summary_text: formatMessage(summary, pipeline),
      recent,
    };

    // Emit JSON so downstream tooling can parse
    console.log(JSON.stringify(payload, null, 2));

    // Optional non-zero exit to trigger alerting if severity=alert
    if (severity === 'alert') {
      console.error('Queue threshold breached');
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to gather CommandView metrics:', error);
    process.exit(2);
  } finally {
    await pool.end();
  }
})();
