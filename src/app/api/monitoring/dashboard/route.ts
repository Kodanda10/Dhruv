import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '24h';

  try {
    const pool = getDbPool();

    // Get time range based on timeframe
    const now = new Date();
    let startTime: Date;

    switch (timeframe) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Run monitoring queries in parallel
    const [
      reviewStats,
      parsingStats,
      apiUsage,
      featureFlags,
      systemConfig
    ] = await Promise.all([
      getReviewStats(pool, startTime),
      getParsingStats(pool, startTime),
      getApiUsageStats(pool, startTime),
      getFeatureFlags(pool),
      getSystemConfig(pool)
    ]);

    const dashboard = {
      timeframe,
      generated_at: now.toISOString(),
      review_operations: reviewStats,
      parsing_pipeline: parsingStats,
      api_usage: apiUsage,
      feature_flags: featureFlags,
      system_config: systemConfig,
      alerts: generateAlerts(reviewStats, parsingStats, apiUsage)
    };

    return NextResponse.json(dashboard);

  } catch (error) {
    console.error('Monitoring dashboard error:', error);
    return NextResponse.json({
      error: 'Failed to generate monitoring dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getReviewStats(pool: any, startTime: Date) {
  const [decisions, updates, finalizations] = await Promise.all([
    // Review decisions (approve/reject)
    pool.query(`
      SELECT
        action,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))) as avg_processing_time
      FROM review_decision_log
      WHERE created_at >= $1
      GROUP BY action
    `, [startTime]),

    // Review updates/edits
    pool.query(`
      SELECT
        COUNT(*) as total_updates,
        COUNT(CASE WHEN review_status = 'edited' THEN 1 END) as edited_count,
        AVG(overall_confidence) as avg_confidence
      FROM parsed_events
      WHERE reviewed_at >= $1 AND review_status IN ('approved', 'rejected', 'edited')
    `, [startTime]),

    // Batch finalizations
    pool.query(`
      SELECT
        COUNT(*) as batch_count,
        SUM(finalized_count) as total_finalized,
        AVG(finalized_count) as avg_batch_size
      FROM review_batch_log
      WHERE created_at >= $1
    `, [startTime])
  ]);

  return {
    decisions: decisions.rows,
    updates: updates.rows[0] || {},
    finalizations: finalizations.rows[0] || {},
    total_actions: decisions.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0) +
                  (updates.rows[0]?.total_updates || 0) +
                  (finalizations.rows[0]?.total_finalized || 0)
  };
}

async function getParsingStats(pool: any, startTime: Date) {
  const [parsing, corrections, failures] = await Promise.all([
    // Parsing success rates
    pool.query(`
      SELECT
        processing_status,
        COUNT(*) as count,
        AVG(overall_confidence) as avg_confidence
      FROM raw_tweets rt
      LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
      WHERE rt.created_at >= $1
      GROUP BY processing_status
    `, [startTime]),

    // Correction operations
    pool.query(`
      SELECT
        COUNT(*) as corrections_attempted,
        COUNT(CASE WHEN parsed_by LIKE '%_corrected' THEN 1 END) as corrections_successful
      FROM parsed_events
      WHERE parsed_at >= $1 AND parsed_by LIKE '%_corrected'
    `, [startTime]),

    // Failure analysis
    pool.query(`
      SELECT
        error_type,
        COUNT(*) as count
      FROM parsing_error_log
      WHERE created_at >= $1
      GROUP BY error_type
      ORDER BY count DESC
      LIMIT 10
    `, [startTime])
  ]);

  const totalParsed = parsing.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0);
  const successful = parsing.rows.find((row: any) => row.processing_status === 'parsed')?.count || 0;
  const successRate = totalParsed > 0 ? (parseInt(successful) / totalParsed * 100).toFixed(2) : '0.00';

  return {
    success_rate: `${successRate}%`,
    by_status: parsing.rows,
    corrections: corrections.rows[0] || {},
    top_failures: failures.rows
  };
}

async function getApiUsageStats(pool: any, startTime: Date) {
  const [endpointUsage, eventTypes, locations] = await Promise.all([
    // API endpoint usage
    pool.query(`
      SELECT
        endpoint,
        method,
        COUNT(*) as requests,
        AVG(response_time) as avg_response_time,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as errors
      FROM api_request_log
      WHERE created_at >= $1
      GROUP BY endpoint, method
      ORDER BY requests DESC
      LIMIT 20
    `, [startTime]),

    // Event type confirmations
    pool.query(`
      SELECT
        COUNT(*) as confirmations,
        COUNT(DISTINCT parsed_event_type_name) as unique_types
      FROM event_type_review_log
      WHERE created_at >= $1
    `, [startTime]),

    // Location resolutions
    pool.query(`
      SELECT
        COUNT(*) as resolutions,
        COUNT(DISTINCT parsed_location_name) as unique_locations
      FROM location_review_log
      WHERE created_at >= $1
    `, [startTime])
  ]);

  return {
    endpoints: endpointUsage.rows,
    event_types: eventTypes.rows[0] || {},
    locations: locations.rows[0] || {}
  };
}

async function getFeatureFlags(pool: any) {
  try {
    const result = await pool.query(`
      SELECT config_key, config_value, updated_at
      FROM system_config
      WHERE config_key LIKE '%flag%' OR config_key IN ('LABS_INTEGRATION', 'ENABLE_DYNAMIC_LEARNING')
      ORDER BY config_key
    `);

    return result.rows.map((row: any) => ({
      key: row.config_key,
      value: row.config_value,
      updated_at: row.updated_at
    }));
  } catch (error) {
    // If system_config table doesn't exist yet, return empty array
    return [];
  }
}

async function getSystemConfig(pool: any) {
  try {
    const result = await pool.query(`
      SELECT config_key, config_value, updated_at
      FROM system_config
      WHERE config_key NOT LIKE '%flag%'
      ORDER BY config_key
      LIMIT 20
    `);

    return result.rows.map((row: any) => ({
      key: row.config_key,
      value: row.config_value,
      updated_at: row.updated_at
    }));
  } catch (error) {
    return [];
  }
}

function generateAlerts(reviewStats: any, parsingStats: any, apiUsage: any) {
  const alerts = [];

  // Check review backlog
  const pendingReviews = reviewStats.updates?.pending_reviews || 0;
  if (pendingReviews > 100) {
    alerts.push({
      level: 'warning',
      message: `${pendingReviews} reviews pending - consider increasing review capacity`,
      metric: 'pending_reviews',
      value: pendingReviews
    });
  }

  // Check parsing success rate
  const successRate = parseFloat(parsingStats.success_rate);
  if (successRate < 70) {
    alerts.push({
      level: 'error',
      message: `Parsing success rate is ${parsingStats.success_rate} - investigate parsing pipeline`,
      metric: 'parsing_success_rate',
      value: successRate
    });
  }

  // Check API error rates
  const totalRequests = apiUsage.endpoints?.reduce((sum: number, ep: any) => sum + ep.requests, 0) || 0;
  const totalErrors = apiUsage.endpoints?.reduce((sum: number, ep: any) => sum + ep.errors, 0) || 0;
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests * 100) : 0;

  if (errorRate > 5) {
    alerts.push({
      level: 'warning',
      message: `API error rate is ${errorRate.toFixed(2)}% - check endpoint health`,
      metric: 'api_error_rate',
      value: errorRate
    });
  }

  // Check for feature flag issues
  if (!parsingStats.corrections?.corrections_attempted && parsingStats.top_failures?.length > 0) {
    alerts.push({
      level: 'info',
      message: 'Parsing failures detected - consider running backfill correction',
      metric: 'parsing_failures',
      value: parsingStats.top_failures.length
    });
  }

  return alerts;
}