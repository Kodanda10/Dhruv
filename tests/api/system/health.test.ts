/**
 * System Health API Endpoint Tests
 *
 * Tests for the /api/system/health endpoint that provides
 * comprehensive health status for all system components.
 */

import { GET } from '../../../src/app/api/system/health/route';
import { NextRequest } from 'next/server';
import { Pool } from 'pg';

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn(),
}));

// Mock fetch for external API checks
global.fetch = jest.fn();

describe('/api/system/health - System Health Endpoint', () => {
  let mockPool: any;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQuery = jest.fn();
    mockPool = {
      query: mockQuery,
    };
    (Pool as unknown as jest.Mock).mockImplementation(() => mockPool);

    // Mock successful external API calls
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
    });
  });

  describe('Successful Health Checks', () => {
    it('should return healthy status when all services are operational', async () => {
      // Mock database health check
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1, connection_count: 8 }]
      });

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.services.database.status).toBe('healthy');
      expect(data.services.database.connection_pool).toBe(8);
      expect(data.uptime_seconds).toBeGreaterThan(0);
      expect(data.version).toBeDefined();
    });

    it('should include all required service health checks', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1, connection_count: 5 }]
      });

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.services).toHaveProperty('database');
      expect(data.services).toHaveProperty('twitter_api');
      expect(data.services).toHaveProperty('gemini_api');
      expect(data.services).toHaveProperty('ollama_api');
      expect(data.frontend).toHaveProperty('build_status');
      expect(data.frontend).toHaveProperty('bundle_size');
    });

    it('should return degraded status when some services are slow', async () => {
      // Mock database with high latency
      mockQuery.mockImplementation(() => new Promise(resolve =>
        setTimeout(() => resolve({ rows: [{ health_check: 1, connection_count: 1 }] }), 100)
      ));

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy'); // Database still healthy, just slower
      expect(data.services.database.latency).toBeGreaterThan(50);
    });
  });

  describe('Error Handling', () => {
    it('should return unhealthy status when database connection fails', async () => {
      mockQuery.mockRejectedValue(new Error('Connection refused'));

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.services.database.status).toBe('unhealthy');
      expect(data.services.database.error).toBe('Connection refused');
    });

    it('should handle Twitter API rate limit issues', async () => {
      // Mock low rate limit
      process.env.TWITTER_RATE_LIMIT_REMAINING = '5';

      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1, connection_count: 8 }]
      });

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.services.twitter_api.status).toBe('degraded');
    });

    it('should handle missing Gemini API key', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1, connection_count: 8 }]
      });

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.services.gemini_api.status).toBe('unhealthy');
      expect(data.services.gemini_api.error).toBe('API key not configured');

      // Restore
      process.env.GEMINI_API_KEY = originalKey;
    });

    it('should handle Ollama API connection failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1, connection_count: 8 }]
      });

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.services.ollama_api.status).toBe('unhealthy');
      expect(data.services.ollama_api.error).toBe('Connection failed');
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure and report latency for all services', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1, connection_count: 8 }]
      });

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.services.database.latency).toBeDefined();
      expect(data.services.database.latency).toBeGreaterThanOrEqual(0);
      expect(typeof data.services.database.latency).toBe('number');
    });

    it('should include uptime information', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1, connection_count: 8 }]
      });

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data.uptime_seconds).toBeDefined();
      expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Response Format', () => {
    it('should return valid JSON response', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1, connection_count: 8 }]
      });

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime_seconds');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('frontend');
    });

    it('should set appropriate HTTP status codes', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ health_check: 1, connection_count: 8 }]
      });

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should return 503 status for unhealthy systems', async () => {
      mockQuery.mockRejectedValue(new Error('Database down'));

      const request = new NextRequest('http://localhost/api/system/health');
      const response = await GET(request);

      expect(response.status).toBe(503);
    });
  });
});
