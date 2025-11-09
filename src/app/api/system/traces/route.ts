/**
 * Traces API Endpoint
 * Phase 8.1: Trace ID System
 * Returns trace logs for monitoring and debugging
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
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const traces = component
      ? getTracesByComponent(component, limit)
      : getTraces(limit);

    return NextResponse.json({
      success: true,
      data: {
        traces,
        count: traces.length,
      },
    });
  } catch (error) {
    console.error('Traces API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch traces',
      },
      { status: 500 }
    );
  }
}


