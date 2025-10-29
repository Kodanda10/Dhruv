import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { ThreeLayerConsensusEngine, TweetData } from '@/lib/parsing/three-layer-consensus-engine';

// Mock Google Generative AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue(JSON.stringify({
            locations: ['रायपुर', 'बिलासपुर'],
            event_type: 'बैठक',
            schemes_mentioned: ['PM-Kisan'],
            hashtags: ['#test'],
            people_mentioned: ['श्री राम']
          }))
        }
      })
    })
  }))
}));

// Mock GeoHierarchyResolver
jest.mock('@/lib/geo-extraction/hierarchy-resolver', () => ({
  GeoHierarchyResolver: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    resolveVillage: jest.fn().mockResolvedValue([])
  }))
}));

// Mock fetch for Ollama
global.fetch = jest.fn();

describe('Three-Layer Consensus Engine', () => {
  let engine: ThreeLayerConsensusEngine;
  let mockTweet: TweetData;

  beforeAll(async () => {
    engine = new ThreeLayerConsensusEngine();
    await engine.initialize();

    mockTweet = {
      tweet_id: 'test_123',
      tweet_text: 'रायपुर में बैठक हुई। PM-Kisan योजना पर चर्चा। #किसान',
      created_at: '2024-01-01T00:00:00Z',
      author_handle: 'test_user'
    };
  });

  afterAll(async () => {
    await engine.cleanup();
  });

  describe('Layer 1: Gemini API Parsing', () => {
    test('should parse tweet with Gemini successfully', async () => {
      // Mock Gemini initialization
      (engine as any).gemini = {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockResolvedValue({
            response: {
              text: jest.fn().mockReturnValue(JSON.stringify({
                locations: ['रायपुर', 'बिलासपुर'],
                event_type: 'बैठक',
                schemes_mentioned: ['PM-Kisan'],
                hashtags: ['#test'],
                people_mentioned: ['श्री राम']
              }))
            }
          })
        })
      };

      const result = await (engine as any).parseWithGemini(mockTweet);

      expect(result).toMatchObject({
        locations: expect.arrayContaining(['रायपुर', 'बिलासपुर']),
        event_type: 'बैठक',
        schemes_mentioned: expect.arrayContaining(['PM-Kisan']),
        hashtags: expect.arrayContaining(['#test']),
        people_mentioned: expect.arrayContaining(['श्री राम']),
        confidence: 0.9,
        parser_source: 'gemini'
      });
    });

    test('should handle Gemini API errors gracefully', async () => {
      const engineWithoutGemini = new ThreeLayerConsensusEngine();
      // Don't initialize Gemini
      
      await expect((engineWithoutGemini as any).parseWithGemini(mockTweet))
        .rejects.toThrow('Gemini API not initialized');
    });
  });

  describe('Layer 2: Ollama Local Model Parsing', () => {
    test('should parse tweet with Ollama successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          response: JSON.stringify({
            locations: ['रायपुर'],
            event_type: 'बैठक',
            schemes_mentioned: ['PM-Kisan'],
            hashtags: ['#किसान'],
            people_mentioned: []
          })
        })
      });

      const result = await (engine as any).parseWithOllama(mockTweet);

      expect(result).toMatchObject({
        locations: expect.arrayContaining(['रायपुर']),
        event_type: 'बैठक',
        schemes_mentioned: expect.arrayContaining(['PM-Kisan']),
        hashtags: expect.arrayContaining(['#किसान']),
        confidence: 0.7,
        parser_source: 'ollama'
      });
    });

    test('should handle Ollama API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Connection refused'
      });

      await expect((engine as any).parseWithOllama(mockTweet))
        .rejects.toThrow('Ollama API error: Connection refused');
    });
  });

  describe('Layer 3: Custom Parsing Engine', () => {
    test('should extract locations using regex patterns', async () => {
      const result = await (engine as any).parseWithCustomEngine(mockTweet);

      expect(result.locations).toContain('रायपुर');
      expect(result.event_type).toBe('बैठक');
      expect(result.schemes_mentioned).toContain('PM-Kisan');
      expect(result.hashtags).toContain('#किसान');
      expect(result.confidence).toBe(0.6);
      expect(result.parser_source).toBe('custom');
    });

    test('should handle tweets with no matches gracefully', async () => {
      const emptyTweet = {
        ...mockTweet,
        tweet_text: 'Hello world'
      };

      const result = await (engine as any).parseWithCustomEngine(emptyTweet);

      expect(result.locations).toEqual([]);
      expect(result.event_type).toBeNull();
      expect(result.schemes_mentioned).toEqual([]);
      expect(result.hashtags).toEqual([]);
      expect(result.people_mentioned).toEqual([]);
    });
  });

  describe('Consensus Algorithm', () => {
    test('should apply 2/3 voting consensus correctly', async () => {
      const mockResults = {
        gemini: {
          locations: ['रायपुर', 'बिलासपुर'],
          event_type: 'बैठक',
          schemes_mentioned: ['PM-Kisan'],
          hashtags: ['#test'],
          people_mentioned: ['श्री राम'],
          confidence: 0.9,
          parser_source: 'gemini' as const,
          geo_hierarchy: [],
          raw_response: 'gemini response'
        },
        ollama: {
          locations: ['रायपुर'],
          event_type: 'बैठक',
          schemes_mentioned: ['PM-Kisan'],
          hashtags: ['#किसान'],
          people_mentioned: [],
          confidence: 0.7,
          parser_source: 'ollama' as const,
          geo_hierarchy: [],
          raw_response: 'ollama response'
        },
        custom: {
          locations: ['रायपुर'],
          event_type: 'बैठक',
          schemes_mentioned: ['PM-Kisan'],
          hashtags: ['#किसान'],
          people_mentioned: [],
          confidence: 0.6,
          parser_source: 'custom' as const,
          geo_hierarchy: [],
          raw_response: 'custom response'
        }
      };

      const consensusResult = (engine as any).applyConsensusAlgorithm(mockResults, mockTweet);

      expect(consensusResult.final_result.locations).toContain('रायपुर');
      expect(consensusResult.final_result.event_type).toBe('बैठक');
      expect(consensusResult.final_result.schemes_mentioned).toContain('PM-Kisan');
      expect(consensusResult.consensus_score).toBeGreaterThan(0.5);
      expect(consensusResult.agreement_level).toMatch(/high|medium|low/);
    });

    test('should identify conflicts between layers', async () => {
      const conflictingResults = {
        gemini: {
          locations: ['रायपुर', 'बिलासपुर'],
          event_type: 'बैठक',
          schemes_mentioned: ['PM-Kisan'],
          hashtags: ['#test'],
          people_mentioned: ['श्री राम'],
          confidence: 0.9,
          parser_source: 'gemini' as const,
          geo_hierarchy: [],
          raw_response: 'gemini response'
        },
        ollama: {
          locations: ['दुर्ग'],
          event_type: 'कार्यक्रम',
          schemes_mentioned: ['Ayushman'],
          hashtags: ['#health'],
          people_mentioned: ['श्री श्याम'],
          confidence: 0.7,
          parser_source: 'ollama' as const,
          geo_hierarchy: [],
          raw_response: 'ollama response'
        },
        custom: {
          locations: ['कोरबा'],
          event_type: 'यात्रा',
          schemes_mentioned: ['Ujjwala'],
          hashtags: ['#gas'],
          people_mentioned: ['श्री गोपाल'],
          confidence: 0.6,
          parser_source: 'custom' as const,
          geo_hierarchy: [],
          raw_response: 'custom response'
        }
      };

      const consensusResult = (engine as any).applyConsensusAlgorithm(conflictingResults, mockTweet);

      expect(consensusResult.conflicts.length).toBeGreaterThan(0);
      expect(consensusResult.agreement_level).toBe('low');
    });
  });

  describe('Complete Parsing Workflow', () => {
    test('should parse tweet with all three layers', async () => {
      // Mock Ollama response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          response: JSON.stringify({
            locations: ['रायपुर'],
            event_type: 'बैठक',
            schemes_mentioned: ['PM-Kisan'],
            hashtags: ['#किसान'],
            people_mentioned: []
          })
        })
      });

      const result = await engine.parseTweet(mockTweet);

      expect(result.final_result).toBeDefined();
      expect(result.layer_results.gemini).toBeDefined();
      expect(result.layer_results.ollama).toBeDefined();
      expect(result.layer_results.custom).toBeDefined();
      expect(result.consensus_score).toBeGreaterThan(0);
      expect(result.agreement_level).toMatch(/high|medium|low/);
    });

    test('should handle partial layer failures gracefully', async () => {
      // Mock Ollama failure
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Connection refused'
      });

      const result = await engine.parseTweet(mockTweet);

      expect(result.final_result).toBeDefined();
      expect(result.layer_results.gemini).toBeDefined();
      expect(result.layer_results.ollama).toBeNull();
      expect(result.layer_results.custom).toBeDefined();
      expect(result.consensus_score).toBeGreaterThan(0);
    });

    test('should handle all layer failures', async () => {
      // Mock all failures
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Connection refused'
      });

      const engineWithoutGemini = new ThreeLayerConsensusEngine();
      // Don't initialize Gemini
      
      // Mock custom engine to also fail
      jest.spyOn(engineWithoutGemini as any, 'parseWithCustomEngine').mockResolvedValueOnce(null);

      await expect(engineWithoutGemini.parseTweet(mockTweet))
        .rejects.toThrow('All parsing layers failed');
    });
  });

  describe('Performance Tests', () => {
    test('should parse tweet within acceptable time', async () => {
      const startTime = Date.now();
      
      await engine.parseTweet(mockTweet);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // 5 seconds max
    });

    test('should handle multiple tweets efficiently', async () => {
      const tweets = Array.from({ length: 5 }, (_, i) => ({
        ...mockTweet,
        tweet_id: `test_${i}`,
        tweet_text: `Test tweet ${i} रायपुर में बैठक #test${i}`
      }));

      const startTime = Date.now();
      
      const results = await Promise.all(
        tweets.map(tweet => engine.parseTweet(tweet))
      );
      
      const processingTime = Date.now() - startTime;
      
      expect(results).toHaveLength(5);
      expect(processingTime).toBeLessThan(10000); // 10 seconds max for 5 tweets
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty tweet text', async () => {
      const emptyTweet = {
        ...mockTweet,
        tweet_text: ''
      };

      // Mock all layers to return empty results for empty text
      jest.spyOn(engine as any, 'parseWithGemini').mockResolvedValueOnce({
        locations: [],
        event_type: null,
        schemes_mentioned: [],
        hashtags: [],
        people_mentioned: [],
        geo_hierarchy: [],
        confidence: 0.0,
        parser_source: 'gemini',
        raw_response: 'empty'
      });
      jest.spyOn(engine as any, 'parseWithOllama').mockResolvedValueOnce({
        locations: [],
        event_type: null,
        schemes_mentioned: [],
        hashtags: [],
        people_mentioned: [],
        geo_hierarchy: [],
        confidence: 0.0,
        parser_source: 'ollama',
        raw_response: 'empty'
      });
      jest.spyOn(engine as any, 'parseWithCustomEngine').mockResolvedValueOnce({
        locations: [],
        event_type: null,
        schemes_mentioned: [],
        hashtags: [],
        people_mentioned: [],
        geo_hierarchy: [],
        confidence: 0.0,
        parser_source: 'custom',
        raw_response: 'empty'
      });

      const result = await engine.parseTweet(emptyTweet);

      expect(result.final_result.locations).toEqual([]);
      expect(result.final_result.event_type).toBeNull();
    });

    test('should handle very long tweet text', async () => {
      const longTweet = {
        ...mockTweet,
        tweet_text: 'रायपुर '.repeat(100) + 'बैठक #test'
      };

      const result = await engine.parseTweet(longTweet);

      expect(result.final_result).toBeDefined();
      expect(result.final_result.locations).toContain('रायपुर');
    });

    test('should handle special characters and emojis', async () => {
      const specialTweet = {
        ...mockTweet,
        tweet_text: 'रायपुर में बैठक हुई! 🎉 #किसान #farmer #test @user'
      };

      // Mock layers to return results with special characters
      jest.spyOn(engine as any, 'parseWithGemini').mockResolvedValueOnce({
        locations: ['रायपुर'],
        event_type: 'बैठक',
        schemes_mentioned: [],
        hashtags: ['#किसान', '#farmer', '#test'],
        people_mentioned: [],
        geo_hierarchy: [],
        confidence: 0.9,
        parser_source: 'gemini',
        raw_response: 'gemini response'
      });
      jest.spyOn(engine as any, 'parseWithOllama').mockResolvedValueOnce({
        locations: ['रायपुर'],
        event_type: 'बैठक',
        schemes_mentioned: [],
        hashtags: ['#किसान', '#farmer'],
        people_mentioned: [],
        geo_hierarchy: [],
        confidence: 0.7,
        parser_source: 'ollama',
        raw_response: 'ollama response'
      });
      jest.spyOn(engine as any, 'parseWithCustomEngine').mockResolvedValueOnce({
        locations: ['रायपुर'],
        event_type: 'बैठक',
        schemes_mentioned: [],
        hashtags: ['#किसान', '#farmer', '#test'],
        people_mentioned: [],
        geo_hierarchy: [],
        confidence: 0.6,
        parser_source: 'custom',
        raw_response: 'custom response'
      });

      const result = await engine.parseTweet(specialTweet);

      expect(result.final_result).toBeDefined();
      expect(result.final_result.hashtags).toContain('#किसान');
    });
  });
});
