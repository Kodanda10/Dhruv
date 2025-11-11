/**
 * System Health Tests
 * Tests for all health check functions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  buildSystemHealthResponse,
  checkDatabase,
  checkTwitter,
  checkGemini,
  checkOllama,
  checkFlaskAPI,
  checkMapMyIndia,
} from '@/lib/health/system-health';

// Mock fetch globally
global.fetch = jest.fn();

describe('System Health Checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.X_BEARER_TOKEN;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.FLASK_API_URL;
    delete process.env.MAPMYINDIA_CLIENT_ID;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkTwitter', () => {
    it('should return unhealthy if bearer token not configured', async () => {
      const result = await checkTwitter();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('Bearer token not configured');
    });

    it('should test actual Twitter API connectivity', async () => {
      process.env.X_BEARER_TOKEN = 'test-token';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'x-rate-limit-remaining': '15',
          'x-rate-limit-reset': '1234567890',
        }),
        json: async () => ({ data: { id: '123', username: 'OPChoudhary_Ind' } }),
      });

      const result = await checkTwitter();
      
      expect(result.status).toBe('healthy');
      expect(result.latency).toBeDefined();
      expect(result.remaining_calls).toBe(15);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.twitter.com/2/users/by/username/OPChoudhary_Ind'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle Twitter API errors correctly', async () => {
      process.env.X_BEARER_TOKEN = 'invalid-token';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await checkTwitter();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('Invalid credentials');
    });
  });

  describe('checkGemini', () => {
    it('should return unhealthy if API key not configured', async () => {
      const result = await checkGemini();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('API key not configured');
    });

    it('should test actual Gemini API connectivity', async () => {
      process.env.GEMINI_API_KEY = 'test-key';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ models: [{ name: 'gemini-pro' }, { name: 'gemini-pro-vision' }] }),
      });

      const result = await checkGemini();
      
      expect(result.status).toBe('healthy');
      expect(result.latency).toBeDefined();
      expect(result.models_available).toBe(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com/v1beta/models'),
        expect.any(Object)
      );
    });

    it('should handle Gemini API errors correctly', async () => {
      process.env.GEMINI_API_KEY = 'invalid-key';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await checkGemini();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('Invalid API key');
    });
  });

  describe('checkFlaskAPI', () => {
    it('should test Flask API connectivity', async () => {
      process.env.FLASK_API_URL = 'http://localhost:5000';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', version: '1.0.0', flags: {} }),
      });

      const result = await checkFlaskAPI();
      
      expect(result.status).toBe('healthy');
      expect(result.latency).toBeDefined();
      expect(result.version).toBe('1.0.0');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/health',
        expect.any(Object)
      );
    });

    it('should mark as degraded if Flask is not running', async () => {
      process.env.FLASK_API_URL = 'http://localhost:5000';
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      const result = await checkFlaskAPI();
      expect(result.status).toBe('degraded');
      expect(result.note).toContain('optional');
    });
  });

  describe('checkMapMyIndia', () => {
    it('should return degraded if credentials not configured', async () => {
      const result = await checkMapMyIndia();
      expect(result.status).toBe('degraded');
      expect(result.note).toContain('optional');
    });

    it('should test MapMyIndia API connectivity', async () => {
      process.env.MAPMYINDIA_CLIENT_ID = 'test-id';
      process.env.MAPMYINDIA_CLIENT_SECRET = 'test-secret';
      
      // Mock token endpoint
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'test-token', expires_in: 3600 }),
        })
        // Mock geocoding endpoint
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      const result = await checkMapMyIndia();
      
      expect(result.status).toBe('healthy');
      expect(result.latency).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('buildSystemHealthResponse', () => {
    it('should include all services in response', async () => {
      // Mock all services
      process.env.X_BEARER_TOKEN = 'test-token';
      process.env.GEMINI_API_KEY = 'test-key';
      process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), json: async () => ({ data: {} }) }) // Twitter
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ models: [] }) }) // Gemini
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ models: [] }) }) // Ollama
        .mockRejectedValueOnce(new Error('Flask not running')) // Flask
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token' }) }) // MapMyIndia token
        .mockResolvedValueOnce({ ok: true }); // MapMyIndia geo

      const { payload } = await buildSystemHealthResponse();
      
      expect(payload.services.database).toBeDefined();
      expect(payload.services.twitter_api).toBeDefined();
      expect(payload.services.gemini_api).toBeDefined();
      expect(payload.services.ollama_api).toBeDefined();
      expect(payload.services.flask_api).toBeDefined();
      expect(payload.services.mapmyindia_api).toBeDefined();
    });
  });
});

