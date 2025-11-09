/**
 * Telemetry API Endpoint
 * Phase 7.4: Telemetry & Logs Dashboard
 * Returns API latency metrics, error rates, memory/CPU, web vitals
 */

import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';
import { validateAdminSession } from '@/lib/auth/server';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface TelemetryData {
  api_latency: {
    p50: number;
    p95: number;
    p99: number;
    endpoints: Array<{
      endpoint: string;
      p50: number;
      p95: number;
      p99: number;
      success_rate: number;
      error_rate: number;
    }>;
  };
  error_rates: Array<{
    endpoint: string;
    errors: number;
    total: number;
    rate: number;
  }>;
  system_metrics: {
    memory_mb: number;
    cpu_percent: number;
    uptime_seconds: number;
  };
  web_vitals: {
    lcp?: number;
    fid?: number;
    cls?: number;
  };
}

// Simple in-memory metrics store (in production, use Redis or Prometheus)
const metricsStore: {
  requests: Array<{ endpoint: string; latency: number; timestamp: number; success: boolean }>;
} = {
  requests: [],
};

// Clean old metrics (keep last 1 hour)
function cleanOldMetrics() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  metricsStore.requests = metricsStore.requests.filter((r) => r.timestamp > oneHourAgo);
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
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

    cleanOldMetrics();

    const requests = metricsStore.requests;
    const latencies = requests.map((r) => r.latency);
    
    // Calculate percentiles
    const p50 = calculatePercentile(latencies, 50);
    const p95 = calculatePercentile(latencies, 95);
    const p99 = calculatePercentile(latencies, 99);

    // Group by endpoint
    const endpointGroups = requests.reduce((acc, req) => {
      if (!acc[req.endpoint]) {
        acc[req.endpoint] = { latencies: [], successes: 0, total: 0 };
      }
      acc[req.endpoint].latencies.push(req.latency);
      acc[req.endpoint].total++;
      if (req.success) acc[req.endpoint].successes++;
      return acc;
    }, {} as Record<string, { latencies: number[]; successes: number; total: number }>);

    const endpoints = Object.entries(endpointGroups).map(([endpoint, data]) => ({
      endpoint,
      p50: calculatePercentile(data.latencies, 50),
      p95: calculatePercentile(data.latencies, 95),
      p99: calculatePercentile(data.latencies, 99),
      success_rate: data.total > 0 ? (data.successes / data.total) * 100 : 100,
      error_rate: data.total > 0 ? ((data.total - data.successes) / data.total) * 100 : 0,
    }));

    // Get system metrics (simplified - in production use actual system monitoring)
    const pool = getDbPool();
    const dbResult = await pool.query('SELECT NOW() as current_time');
    const uptime = process.uptime();

    // Memory usage (Node.js)
    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    // CPU usage (simplified - in production use actual CPU monitoring)
    const cpuPercent = 0; // Placeholder - would need actual CPU monitoring

    const telemetry: TelemetryData = {
      api_latency: {
        p50,
        p95,
        p99,
        endpoints,
      },
      error_rates: endpoints.map((e) => ({
        endpoint: e.endpoint,
        errors: Math.round((e.error_rate / 100) * (endpointGroups[e.endpoint]?.total || 0)),
        total: endpointGroups[e.endpoint]?.total || 0,
        rate: e.error_rate,
      })),
      system_metrics: {
        memory_mb: memoryMB,
        cpu_percent: cpuPercent,
        uptime_seconds: Math.round(uptime),
      },
      web_vitals: {
        // Web vitals would be collected client-side and sent to this endpoint
        // For now, return placeholder
      },
    };

    return NextResponse.json({
      success: true,
      data: telemetry,
    });
  } catch (error) {
    console.error('Telemetry API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch telemetry data',
      },
      { status: 500 }
    );
  }
}

// POST: Record a metric (called by middleware or client)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, latency, success } = body;

    if (!endpoint || typeof latency !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid metric data' },
        { status: 400 }
      );
    }

    metricsStore.requests.push({
      endpoint,
      latency,
      timestamp: Date.now(),
      success: success !== false,
    });

    // Keep only last 10000 requests
    if (metricsStore.requests.length > 10000) {
      metricsStore.requests = metricsStore.requests.slice(-10000);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to record metric' },
      { status: 500 }
    );
  }
}


