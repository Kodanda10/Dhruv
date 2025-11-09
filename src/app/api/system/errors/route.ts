/**
 * Errors API Endpoint
 * Phase 8.4: Error Snapshot Panel
 * Returns error traces for monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from '@/lib/auth/server';
import { getTraces, getTracesByComponent } from '@/middleware/traceLogger';

export const dynamic = 'force-dynamic';

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

    const { searchParams } = new URL(request.url);
    const component = searchParams.get('component');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const minutes = parseInt(searchParams.get('minutes') || '60', 10);

    // Get all traces (or filtered by component)
    const allTraces = component
      ? getTracesByComponent(component, 1000) // Get more to filter by time
      : getTraces(1000);

    // Filter errors only (status_code >= 400 or has error_message)
    const errorTraces = allTraces.filter(
      (trace) => trace.status_code >= 400 || trace.error_message
    );

    // Filter by time window
    const cutoffTime = Date.now() - minutes * 60 * 1000;
    const recentErrors = errorTraces.filter((trace) => {
      const traceTime = new Date(trace.timestamp).getTime();
      return traceTime >= cutoffTime;
    });

    // Sort by timestamp (most recent first) and limit
    const sortedErrors = recentErrors
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    // Determine severity
    const errorsWithSeverity = sortedErrors.map((trace) => {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (trace.status_code >= 500) {
        severity = 'critical';
      } else if (trace.status_code >= 400) {
        severity = trace.status_code === 404 ? 'low' : 'high';
      } else if (trace.error_message) {
        severity = 'medium';
      }
      return {
        ...trace,
        severity,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        errors: errorsWithSeverity,
        count: errorsWithSeverity.length,
        total_in_window: recentErrors.length,
      },
    });
  } catch (error) {
    console.error('Errors API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch errors',
      },
      { status: 500 }
    );
  }
}

