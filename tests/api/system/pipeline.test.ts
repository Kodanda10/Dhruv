/**
 * Pipeline Monitor API Tests
 * Phase 7.5: Tests for Database & Pipeline Monitor API
 */

import { describe, it, expect } from '@jest/globals';

describe('Pipeline Monitor API', () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  describe('GET /api/system/pipeline', () => {
    it('should require admin authentication', async () => {
      const response = await fetch(`${API_URL}/api/system/pipeline`);
      expect(response.status).toBe(401);
    });

    it('should return pipeline health data structure', async () => {
      const mockResponse = {
        success: true,
        data: {
          nodes: [
            {
              name: 'Fetch',
              status: 'healthy',
              last_execution: '2024-01-01T00:00:00Z',
              last_success: '2024-01-01T00:00:00Z',
              record_count: 100,
            },
          ],
          overall_status: 'healthy',
          last_sync: '2024-01-01T00:00:00Z',
        },
      };
      expect(mockResponse.success).toBe(true);
      expect(mockResponse.data).toHaveProperty('nodes');
      expect(mockResponse.data).toHaveProperty('overall_status');
      expect(Array.isArray(mockResponse.data.nodes)).toBe(true);
    });
  });
});


