import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pool = getDbPool();

  try {
    // Fetch all pipeline metrics in parallel
    const [
      fetchMetrics,
      parseMetrics,
      reviewMetrics,
      analyticsMetrics,
      recentActivity,
    ] = await Promise.all([
      // 1. Fetch job metrics
      pool.query(`
        SELECT
          COUNT(*) AS total_tweets,
          COUNT(*) FILTER (WHERE processing_status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE processing_status = 'parsed') AS parsed,
          COUNT(*) FILTER (WHERE processing_status = 'failed') AS failed,
          MAX(fetched_at) AS last_fetch_time,
          COUNT(*) FILTER (WHERE fetched_at > NOW() - INTERVAL '1 hour') AS fetched_last_hour
        FROM raw_tweets
      `),
      
      // 2. Parse queue metrics
      pool.query(`
        SELECT COUNT(*) AS pending_count
        FROM raw_tweets
        WHERE processing_status = 'pending'
      `),
      
      // 3. Review queue metrics
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE needs_review = true) AS needs_review,
          COUNT(*) FILTER (WHERE review_status = 'approved') AS approved,
          COUNT(*) FILTER (WHERE review_status = 'pending') AS pending_review
        FROM parsed_events
      `),
      
      // 4. Analytics-ready metrics
      pool.query(`
        SELECT COUNT(*) AS analytics_ready
        FROM parsed_events
        WHERE needs_review = false 
          AND (review_status IS NULL OR review_status = 'approved')
      `),
      
      // 5. Recent activity (last 24h)
      pool.query(`
        SELECT
          COUNT(DISTINCT rt.tweet_id) FILTER (WHERE rt.fetched_at > NOW() - INTERVAL '24 hours') AS tweets_fetched_24h,
          COUNT(DISTINCT rt.tweet_id) FILTER (WHERE rt.processed_at > NOW() - INTERVAL '24 hours' AND rt.processing_status = 'parsed') AS tweets_parsed_24h,
          COUNT(DISTINCT pe.tweet_id) FILTER (WHERE pe.reviewed_at > NOW() - INTERVAL '24 hours') AS tweets_reviewed_24h
        FROM raw_tweets rt
        LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
      `),
    ]);

    const fetch = fetchMetrics.rows[0] || {};
    const parse = parseMetrics.rows[0] || {};
    const review = reviewMetrics.rows[0] || {};
    const analytics = analyticsMetrics.rows[0] || {};
    const recent = recentActivity.rows[0] || {};

    // Calculate health scores
    const fetchHealth = parseInt(fetch.fetched_last_hour || '0', 10) > 0 ? 'healthy' : 'stale';
    const parseHealth = parseInt(parse.pending_count || '0', 10) < 100 ? 'healthy' : 'backlog';
    const reviewHealth = parseInt(review.needs_review || '0', 10) < 25 ? 'healthy' : 'backlog';

    const health = {
      overall:
        fetchHealth === 'healthy' && parseHealth === 'healthy' && reviewHealth === 'healthy'
          ? 'healthy'
          : 'needs_attention',
      fetch: fetchHealth,
      parse: parseHealth,
      review: reviewHealth,
    };

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
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
    });
  } catch (error) {
    console.error('Pipeline health check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check pipeline health',
      },
      { status: 500 },
    );
  }
}


