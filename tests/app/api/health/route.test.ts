/**
 * Tests for /api/health endpoint
 * 
 * Tests health check functionality including:
 * - Database connection status
 * - Ollama call tracking
 * - Validation queue monitoring
 */

import { GET } from '@/app/api/health/route';
import { NextRequest } from 'next/server';
import { getDBPool } from '@/lib/db/pool';

// Mock database pool
jest.mock('@/lib/db/pool', () => ({
  getDBPool: jest.fn()
}));

describe('GET /api/health', () => {
  let mockPool: any;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    mockQuery = jest.fn();
    mockPool = {
      query: mockQuery,
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0
    };
    (getDBPool as jest.Mock).mockReturnValue(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return healthy status with database connected', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        total_connections: '5',
        active_connections: '2',
        idle_connections: '3'
      }]
    });

    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.dbConnections).toBeDefined();
    expect(data.dbConnections.total).toBe(5);
    expect(data.dbConnections.active).toBe(2);
    expect(data.dbConnections.idle).toBe(3);
    expect(data.dbConnections.poolMax).toBe(5);
    expect(data.dbConnections.poolActive).toBe(5);
    expect(data.dbConnections.poolIdle).toBe(3);
  });

  test('should return healthy status when query fails (fallback stats)', async () => {
    mockQuery.mockRejectedValue(new Error('Query failed'));

    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.dbConnections.total).toBe(0);
    expect(data.dbConnections.active).toBe(0);
    expect(data.dbConnections.idle).toBe(0);
  });

  test('should include ollama call count in response', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        total_connections: '1',
        active_connections: '0',
        idle_connections: '1'
      }]
    });

    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    expect(data.ollamaCalls).toBeDefined();
    expect(typeof data.ollamaCalls.recent).toBe('number');
    expect(data.ollamaCalls.lastCall).toBeDefined();
  });

  test('should include validation queue size in response', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        total_connections: '1',
        active_connections: '0',
        idle_connections: '1'
      }]
    });

    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    expect(data.validationQueue).toBeDefined();
    expect(typeof data.validationQueue).toBe('number');
  });

  test('should include memory usage in response', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        total_connections: '1',
        active_connections: '0',
        idle_connections: '1'
      }]
    });

    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    expect(data.memory).toBeDefined();
    expect(typeof data.memory.heapUsed).toBe('number');
    expect(typeof data.memory.heapTotal).toBe('number');
    expect(typeof data.memory.rss).toBe('number');
  });

  test('should handle database pool getDBPool error', async () => {
    (getDBPool as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Pool initialization failed');
    });

    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.status).toBe('unhealthy');
    expect(data.error).toBe('Pool initialization failed');
  });

  test('should include timestamp in response', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        total_connections: '1',
        active_connections: '0',
        idle_connections: '1'
      }]
    });

    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });
});

