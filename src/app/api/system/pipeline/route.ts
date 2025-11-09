/**
 * Pipeline Monitor API Endpoint
 * Phase 7.5: Database & Pipeline Monitor
 * Returns pipeline health flow: Fetch → Parse → Review → AI → Analytics
 */

import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';
import { validateAdminSession } from '@/lib/auth/server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface PipelineNode {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_execution: string | null;
  last_success: string | null;
  last_error: string | null;
  record_count?: number;
  latency_ms?: number;
}

interface PipelineHealth {
  nodes: PipelineNode[];
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  last_sync: string;
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = validateAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const pool = getDbPool();

    // Check database connection
    const dbCheck = await pool.query('SELECT NOW() as current_time, version() as version');
    const dbHealthy = !!dbCheck.rows[0];

    // Get parsed events count
    const parsedCountResult = await pool.query('SELECT COUNT(*) as count FROM parsed_events');
    const parsedCount = parseInt(parsedCountResult.rows[0]?.count || '0', 10);

    // Get recent parsed events to determine last execution
    const lastParseResult = await pool.query(`
      SELECT MAX(created_at) as last_execution
      FROM parsed_events
    `);
    const lastParse = lastParseResult.rows[0]?.last_execution;

    // Get review queue status
    const reviewQueueResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE needs_review = true) as pending,
        COUNT(*) FILTER (WHERE review_status = 'approved') as approved,
        MAX(reviewed_at) as last_review
      FROM parsed_events
    `);
    const reviewData = reviewQueueResult.rows[0];

    // Determine node statuses
    const nodes: PipelineNode[] = [
      {
        name: 'Fetch',
        status: dbHealthy ? 'healthy' : 'unhealthy',
        last_execution: lastParse || null,
        last_success: lastParse || null,
        last_error: null,
        record_count: parsedCount,
      },
      {
        name: 'Parse',
        status: parsedCount > 0 ? 'healthy' : 'degraded',
        last_execution: lastParse || null,
        last_success: lastParse || null,
        last_error: null,
        record_count: parsedCount,
      },
      {
        name: 'Review',
        status: reviewData?.pending > 0 ? 'degraded' : 'healthy',
        last_execution: reviewData?.last_review || null,
        last_success: reviewData?.last_review || null,
        last_error: null,
        record_count: reviewData?.pending || 0,
      },
      {
        name: 'AI',
        status: 'healthy', // Would check AI service health
        last_execution: reviewData?.last_review || null,
        last_success: reviewData?.last_review || null,
        last_error: null,
      },
      {
        name: 'Analytics',
        status: parsedCount > 0 ? 'healthy' : 'degraded',
        last_execution: new Date().toISOString(),
        last_success: new Date().toISOString(),
        last_error: null,
      },
    ];

    // Determine overall status
    const unhealthyCount = nodes.filter((n) => n.status === 'unhealthy').length;
    const degradedCount = nodes.filter((n) => n.status === 'degraded').length;
    const overall_status =
      unhealthyCount > 0 ? 'unhealthy' : degradedCount > 0 ? 'degraded' : 'healthy';

    const pipelineHealth: PipelineHealth = {
      nodes,
      overall_status,
      last_sync: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: pipelineHealth,
    });
  } catch (error) {
    console.error('Pipeline Monitor API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch pipeline health',
      },
      { status: 500 }
    );
  }
}


