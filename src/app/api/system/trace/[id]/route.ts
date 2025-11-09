/**
 * Single Trace API Endpoint
 * Phase 8.3: Trace Timeline Inspector
 * Returns detailed trace information by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from '@/lib/auth/server';
import { getTraceById } from '@/middleware/traceLogger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const session = validateAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const traceId = params.id;
    const trace = getTraceById(traceId);

    if (!trace) {
      return NextResponse.json(
        { success: false, error: 'Trace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: trace,
    });
  } catch (error) {
    console.error('Trace API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch trace',
      },
      { status: 500 }
    );
  }
}


