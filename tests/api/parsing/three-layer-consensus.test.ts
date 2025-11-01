import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/parsing/three-layer-consensus/route';

// Mock the ThreeLayerConsensusEngine
const mockParseTweet = jest.fn();
// @ts-expect-error - Jest mock type inference issue
const mockInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/parsing/three-layer-consensus-engine', () => ({
  ThreeLayerConsensusEngine: jest.fn().mockImplementation(() => ({
    initialize: mockInitialize,
    // @ts-expect-error - Jest mock type inference issue
    parseTweet: mockParseTweet.mockResolvedValue({
      final_result: {
        locations: ['रायपुर'],
        event_type: 'बैठक',
        schemes_mentioned: ['PM-Kisan'],
        hashtags: ['#test'],
        people_mentioned: [],
        confidence: 0.8,
        parser_source: 'gemini',
        geo_hierarchy: []
      },
      layer_results: {
        gemini: { locations: ['रायपुर'], confidence: 0.9, parser_source: 'gemini' },
        ollama: { locations: ['रायपुर'], confidence: 0.7, parser_source: 'ollama' },
        custom: { locations: ['रायपुर'], confidence: 0.6, parser_source: 'custom' }
      },
      consensus_score: 0.8,
      agreement_level: 'high',
      conflicts: [],
      geo_hierarchy_resolved: true
    })
  }))
}));

describe('Three-Layer Consensus API Endpoint', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockParseTweet.mockClear();
    mockInitialize.mockClear();
    
    // Reset to default successful behavior
    mockParseTweet.mockImplementation(async () => {
      // Add a small delay to simulate processing time
      await new Promise(resolve => setTimeout(resolve, 10));
      return {
        final_result: {
          locations: ['रायपुर'],
          event_type: 'बैठक',
          schemes_mentioned: ['PM-Kisan'],
          hashtags: ['#test'],
          people_mentioned: [],
          confidence: 0.8,
          parser_source: 'gemini',
          geo_hierarchy: []
        },
        layer_results: {
          gemini: { locations: ['रायपुर'], confidence: 0.9, parser_source: 'gemini' },
          ollama: { locations: ['रायपुर'], confidence: 0.7, parser_source: 'ollama' },
          custom: { locations: ['रायपुर'], confidence: 0.6, parser_source: 'custom' }
        },
        consensus_score: 0.8,
        agreement_level: 'high',
        conflicts: [],
        geo_hierarchy_resolved: true
      };
    });
  });
  describe('POST /api/parsing/three-layer-consensus', () => {
    test('should parse tweet successfully', async () => {
      const requestBody = {
        tweet_id: 'test_123',
        tweet_text: 'रायपुर में बैठक हुई। PM-Kisan योजना पर चर्चा। #किसान',
        created_at: '2024-01-01T00:00:00Z',
        author_handle: 'test_user'
      };

      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.result).toBeDefined();
      expect(data.result.tweet_id).toBe('test_123');
      expect(data.result.parsed_data.locations).toContain('रायपुर');
      expect(data.result.parsed_data.event_type).toBe('बैठक');
      expect(data.result.consensus_analysis.consensus_score).toBe(0.8);
      expect(data.result.consensus_analysis.agreement_level).toBe('high');
      expect(data.processing_time_ms).toBeGreaterThanOrEqual(0); // Allow 0 for mocked responses
    });

    test('should return 400 for missing tweet_text', async () => {
      const requestBody = {
        tweet_id: 'test_123',
        created_at: '2024-01-01T00:00:00Z',
        author_handle: 'test_user'
      };

      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('tweet_text is required');
    });

    test('should handle parsing errors gracefully', async () => {
      // Mock the engine to throw an error
      // @ts-expect-error - Jest mock type inference issue
      mockParseTweet.mockRejectedValueOnce(new Error('Parsing failed'));

      const requestBody = {
        tweet_id: 'test_123',
        tweet_text: 'रायपुर में बैठक हुई',
        created_at: '2024-01-01T00:00:00Z',
        author_handle: 'test_user'
      };

      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Parsing failed');
    });

    test('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    test('should include geo_hierarchy when resolved', async () => {
      // Force mock to include geo_hierarchy and flag as resolved
      // @ts-expect-error - Jest mock type inference issue  
      mockParseTweet.mockResolvedValueOnce({
        final_result: {
          locations: ['पंडरी'],
          event_type: 'बैठक',
          schemes_mentioned: [],
          hashtags: [],
          people_mentioned: [],
          geo_hierarchy: [
            {
              village: 'পंडरी',
              gram_panchayat: 'रायपुर',
              block: 'रायपुर',
              assembly: 'रायपुर शहर उत्तर',
              district: 'रायपुर',
              is_urban: true,
              ulb: 'रायपुर नगर निगम',
              ward_no: 5,
              confidence: 0.95
            }
          ],
          confidence: 0.85,
          parser_source: 'custom'
        },
        layer_results: { gemini: null, ollama: null, custom: null },
        consensus_score: 0.85,
        agreement_level: 'high',
        conflicts: [],
        geo_hierarchy_resolved: true
      });

      const requestBody = {
        tweet_id: 'geo_123',
        tweet_text: 'पंडरी में बैठक हुई',
        created_at: '2024-01-01T00:00:00Z',
        author_handle: 'test_user'
      };

      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.result.parsed_data.geo_hierarchy)).toBe(true);
      expect(data.result.parsed_data.geo_hierarchy.length).toBeGreaterThan(0);
      expect(data.result.consensus_analysis.geo_hierarchy_resolved).toBe(true);
    });
  });

  describe('GET /api/parsing/three-layer-consensus', () => {
    test('should parse tweet via GET request', async () => {
      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus?tweet_text=रायपुर में बैठक हुई');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tweet_text).toBe('रायपुर में बैठक हुई');
      expect(data.result).toBeDefined();
      expect(data.result.locations).toContain('रायपुर');
      expect(data.consensus_score).toBe(0.8);
      expect(data.agreement_level).toBe('high');
    });

    test('should return 400 for missing tweet_text parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('tweet_text parameter is required');
    });

    test('should handle parsing errors in GET request', async () => {
      // Mock the engine to throw an error
      // @ts-expect-error - Jest mock type compatibility
      mockParseTweet.mockRejectedValueOnce(new Error('GET parsing failed'));

      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus?tweet_text=test');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });
  });

  describe('Performance Tests', () => {
    test('should process request within acceptable time', async () => {
      const requestBody = {
        tweet_id: 'perf_test',
        tweet_text: 'रायपुर में बैठक हुई। PM-Kisan योजना पर चर्चा। #किसान',
        created_at: '2024-01-01T00:00:00Z',
        author_handle: 'test_user'
      };

      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const startTime = Date.now();
      const response = await POST(request);
      const processingTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(processingTime).toBeLessThan(3000); // 3 seconds max
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty tweet text', async () => {
      const requestBody = {
        tweet_id: 'empty_test',
        tweet_text: '',
        created_at: '2024-01-01T00:00:00Z',
        author_handle: 'test_user'
      };

      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('tweet_text is required');
    });

    test('should handle very long tweet text', async () => {
      const longText = 'रायपुर '.repeat(100) + 'बैठक #test';
      
      const requestBody = {
        tweet_id: 'long_test',
        tweet_text: longText,
        created_at: '2024-01-01T00:00:00Z',
        author_handle: 'test_user'
      };

      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.result.parsed_data.locations).toContain('रायपुर');
    });

    test('should handle special characters and Unicode', async () => {
      const specialText = 'रायपुर में बैठक हुई! 🎉 #किसान #farmer #test @user';
      
      // Mock the engine to return results with special characters
      // @ts-expect-error - Jest mock type inference issue  
      mockParseTweet.mockResolvedValueOnce({
        final_result: {
          locations: ['रायपुर'],
          event_type: 'बैठक',
          schemes_mentioned: [],
          hashtags: ['#किसान', '#farmer', '#test'],
          people_mentioned: [],
          confidence: 0.8,
          parser_source: 'gemini',
          geo_hierarchy: []
        },
        layer_results: {
          gemini: { locations: ['रायपुर'], confidence: 0.9, parser_source: 'gemini' },
          ollama: { locations: ['रायपुर'], confidence: 0.7, parser_source: 'ollama' },
          custom: { locations: ['रायपुर'], confidence: 0.6, parser_source: 'custom' }
        },
        consensus_score: 0.8,
        agreement_level: 'high',
        conflicts: [],
        geo_hierarchy_resolved: true
      });
      
      const requestBody = {
        tweet_id: 'unicode_test',
        tweet_text: specialText,
        created_at: '2024-01-01T00:00:00Z',
        author_handle: 'test_user'
      };

      const request = new NextRequest('http://localhost:3000/api/parsing/three-layer-consensus', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.result.parsed_data.hashtags).toContain('#किसान');
    });
  });
});
