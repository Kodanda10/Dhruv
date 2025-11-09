/**
 * Metrics API Endpoint
 * Phase 8.5: Latency Heatmap
 * Returns latency metrics for heatmap visualization
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession } from '@/lib/auth/server';
import { getTraces } from '@/middleware/traceLogger';

export const dynamic = 'force-dynamic';

interface EndpointMetrics {
  endpoint: string;
  component: string;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  request_count: number;
  success_count: number;
  error_count: number;
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '1000', 10);

    // Get recent traces
    const traces = getTraces(limit);

    // Group by endpoint
    const endpointMap = new Map<string, number[]>();

    traces.forEach((trace) => {
      const key = `${trace.component}:${trace.endpoint}`;
      if (!endpointMap.has(key)) {
        endpointMap.set(key, []);
      }
      endpointMap.get(key)!.push(trace.latency_ms);
    });

    // Calculate metrics for each endpoint
    const metrics: EndpointMetrics[] = Array.from(endpointMap.entries()).map(
      ([key, latencies]) => {
        const [component, endpoint] = key.split(':');
        const sorted = [...latencies].sort((a, b) => a - b);
        const count = sorted.length;
        const p50 = sorted[Math.floor(count * 0.5)] || 0;
        const p95 = sorted[Math.floor(count * 0.95)] || 0;
        const p99 = sorted[Math.floor(count * 0.99)] || 0;
        const max = Math.max(...sorted);

        // Count successes and errors
        const endpointTraces = traces.filter(
          (t) => t.component === component && t.endpoint === endpoint
        );
        const success_count = endpointTraces.filter((t) => t.status_code < 400).length;
        const error_count = endpointTraces.length - success_count;

        return {
          endpoint,
          component,
          p50,
          p95,
          p99,
          max,
          request_count: count,
          success_count,
          error_count,
        };
      }
    );

    // Sort by p95 latency (descending)
    metrics.sort((a, b) => b.p95 - a.p95);

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        count: metrics.length,
      },
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
      },
      { status: 500 }
    );
  }
}

