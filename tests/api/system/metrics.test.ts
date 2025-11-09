/**
 * Metrics API Endpoint Tests
 * Phase 8.5: Latency Heatmap
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/system/metrics/route';

// Mock dependencies
jest.mock('@/lib/auth/server', () => ({
  validateAdminSession: jest.fn(),
}));

jest.mock('@/middleware/traceLogger', () => ({
  getTraces: jest.fn(),
}));

import { validateAdminSession } from '@/lib/auth/server';
import { getTraces } from '@/middleware/traceLogger';

describe('Metrics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validateAdminSession as jest.Mock).mockReturnValue({ role: 'admin' });
  });

  it('should return metrics for admin users', async () => {
    const mockTraces = [
      {
        trace_id: 'trace-1',
        timestamp: new Date().toISOString(),
        latency_ms: 100,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
      {
        trace_id: 'trace-2',
        timestamp: new Date().toISOString(),
        latency_ms: 200,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
      {
        trace_id: 'trace-3',
        timestamp: new Date().toISOString(),
        latency_ms: 300,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
    ];

    (getTraces as jest.Mock).mockReturnValue(mockTraces);

    const request = new NextRequest('http://localhost:3000/api/system/metrics');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.metrics.length).toBeGreaterThan(0);
  });

  it('should calculate p50, p95, p99 correctly', async () => {
    const mockTraces = Array.from({ length: 100 }, (_, i) => ({
      trace_id: `trace-${i}`,
      timestamp: new Date().toISOString(),
      latency_ms: (i + 1) * 10, // 10, 20, 30, ..., 1000
      status_code: 200,
      component: 'api',
      endpoint: '/api/test',
      method: 'GET',
    }));

    (getTraces as jest.Mock).mockReturnValue(mockTraces);

    const request = new NextRequest('http://localhost:3000/api/system/metrics');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    const metric = data.data.metrics[0];
    expect(metric.p50).toBe(500); // 50th percentile
    expect(metric.p95).toBe(950); // 95th percentile
    expect(metric.p99).toBe(990); // 99th percentile
  });

  it('should group metrics by endpoint', async () => {
    const mockTraces = [
      {
        trace_id: 'trace-1',
        timestamp: new Date().toISOString(),
        latency_ms: 100,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test1',
        method: 'GET',
      },
      {
        trace_id: 'trace-2',
        timestamp: new Date().toISOString(),
        latency_ms: 200,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test2',
        method: 'GET',
      },
    ];

    (getTraces as jest.Mock).mockReturnValue(mockTraces);

    const request = new NextRequest('http://localhost:3000/api/system/metrics');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.metrics.length).toBe(2); // Two different endpoints
  });

  it('should reject non-admin users', async () => {
    (validateAdminSession as jest.Mock).mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/system/metrics');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
  });

  it('should sort metrics by p95 latency descending', async () => {
    const mockTraces = [
      {
        trace_id: 'trace-1',
        timestamp: new Date().toISOString(),
        latency_ms: 100,
        status_code: 200,
        component: 'api',
        endpoint: '/api/slow',
        method: 'GET',
      },
      {
        trace_id: 'trace-2',
        timestamp: new Date().toISOString(),
        latency_ms: 500,
        status_code: 200,
        component: 'api',
        endpoint: '/api/fast',
        method: 'GET',
      },
    ];

    (getTraces as jest.Mock).mockReturnValue(mockTraces);

    const request = new NextRequest('http://localhost:3000/api/system/metrics');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    // Should be sorted by p95 descending
    expect(data.data.metrics[0].p95).toBeGreaterThanOrEqual(data.data.metrics[1].p95);
  });
});

