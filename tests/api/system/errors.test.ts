/**
 * Errors API Endpoint Tests
 * Phase 8.4: Error Snapshot Panel
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/system/errors/route';

// Mock dependencies
jest.mock('@/lib/auth/server', () => ({
  validateAdminSession: jest.fn(),
}));

jest.mock('@/middleware/traceLogger', () => ({
  getTraces: jest.fn(),
  getTracesByComponent: jest.fn(),
}));

import { validateAdminSession } from '@/lib/auth/server';
import { getTraces, getTracesByComponent } from '@/middleware/traceLogger';

describe('Errors API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validateAdminSession as jest.Mock).mockReturnValue({ role: 'admin' });
  });

  it('should return errors for admin users', async () => {
    const mockTraces = [
      {
        trace_id: 'error-1',
        timestamp: new Date(Date.now() - 1000).toISOString(),
        latency_ms: 100,
        status_code: 500,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
        error_message: 'Internal error',
      },
    ];

    (getTraces as jest.Mock).mockReturnValue(mockTraces);

    const request = new NextRequest('http://localhost:3000/api/system/errors');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.errors.length).toBeGreaterThan(0);
  });

  it('should filter by component', async () => {
    const mockTraces = [
      {
        trace_id: 'error-1',
        timestamp: new Date().toISOString(),
        latency_ms: 100,
        status_code: 500,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
    ];

    (getTracesByComponent as jest.Mock).mockReturnValue(mockTraces);

    const request = new NextRequest('http://localhost:3000/api/system/errors?component=api');
    const response = await GET(request);
    const data = await response.json();

    expect(getTracesByComponent).toHaveBeenCalledWith('api', 1000);
    expect(data.success).toBe(true);
  });

  it('should filter by time window', async () => {
    const oldTrace = {
      trace_id: 'old-error',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      latency_ms: 100,
      status_code: 500,
      component: 'api',
      endpoint: '/api/test',
      method: 'GET',
    };

    const recentTrace = {
      trace_id: 'recent-error',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      latency_ms: 100,
      status_code: 500,
      component: 'api',
      endpoint: '/api/test',
      method: 'GET',
    };

    (getTraces as jest.Mock).mockReturnValue([oldTrace, recentTrace]);

    const request = new NextRequest('http://localhost:3000/api/system/errors?minutes=60');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    // Should only include recent error (within 60 minutes)
    expect(data.data.errors.length).toBe(1);
    expect(data.data.errors[0].trace_id).toBe('recent-error');
  });

  it('should reject non-admin users', async () => {
    (validateAdminSession as jest.Mock).mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/system/errors');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
  });

  it('should assign severity correctly', async () => {
    const mockTraces = [
      {
        trace_id: 'critical',
        timestamp: new Date().toISOString(),
        latency_ms: 100,
        status_code: 500,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
      {
        trace_id: 'high',
        timestamp: new Date().toISOString(),
        latency_ms: 100,
        status_code: 400,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
      {
        trace_id: 'low',
        timestamp: new Date().toISOString(),
        latency_ms: 100,
        status_code: 404,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
    ];

    (getTraces as jest.Mock).mockReturnValue(mockTraces);

    const request = new NextRequest('http://localhost:3000/api/system/errors');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    const criticalError = data.data.errors.find((e: any) => e.trace_id === 'critical');
    expect(criticalError.severity).toBe('critical');
  });
});

