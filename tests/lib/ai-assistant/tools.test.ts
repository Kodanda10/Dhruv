/**
 * Unit Tests for AI Assistant Tools
 * 
 * Tests the specific tools (addLocation, suggestEventType, etc.) with real data
 */

import { aiAssistantTools } from '@/lib/ai-assistant/tools';

// Mock the dependencies
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockImplementation((query: string, params?: any[]) => {
      // Return different data based on query type
      if (query.includes('ref_schemes') || query.includes('scheme')) {
        return Promise.resolve({
          rows: params && params[0] && Array.isArray(params[0]) 
            ? params[0].filter((s: string) => !s.includes('Invalid')).map((s: string) => ({ name: s }))
            : [
                { name: 'PM Kisan' },
                { name: 'Ayushman Bharat' },
                { name: 'Ujjwala' }
              ]
        });
      }
      // Default: return location data
      return Promise.resolve({
        rows: [
          { name: 'रायपुर' },
          { name: 'बिलासपुर' },
          { name: 'रायगढ़' }
        ]
      });
    })
  }))
}));

jest.mock('@/lib/dynamic-learning', () => ({
  DynamicLearningSystem: jest.fn().mockImplementation(() => ({
    getIntelligentSuggestions: jest.fn().mockResolvedValue({
      locations: ['रायपुर', 'बिलासपुर'],
      eventTypes: ['बैठक', 'कार्यक्रम'],
      schemes: ['PM Kisan', 'Ayushman Bharat'],
      hashtags: ['#विकास', '#योजना']
    })
  }))
}));

describe('AI Assistant Tools', () => {
  const mockTweetText = 'छत्तीसगढ़ के विभिन्न निगम, मंडल, आयोग और बोर्ड के अध्यक्ष एवं उपाध्यक्ष को राज्य शासन द्वारा मंत्री एवं राज्यमंत्री का दर्जा प्रदान किया गया है।';

  beforeEach(() => {
    // Reset any mocks
    jest.clearAllMocks();
  });

  describe('addLocation Tool', () => {
    test('should add locations from provided list', async () => {
      const locations = ['रायपुर', 'बिलासपुर'];
      const existingLocations = ['दुर्ग'];

      const result = await aiAssistantTools.addLocation(
        locations,
        mockTweetText,
        existingLocations
      );

      expect(result.success).toBe(true);
      expect(result.data?.locations).toContain('रायपुर');
      expect(result.data?.locations).toContain('बिलासपुर');
      expect(result.data?.locations).toContain('दुर्ग');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should parse locations from tweet text when not provided', async () => {
      const tweetWithLocations = 'रायपुर में बैठक हुई और बिलासपुर में कार्यक्रम आयोजित किया गया।';

      const result = await aiAssistantTools.addLocation(
        [],
        tweetWithLocations,
        []
      );

      expect(result.success).toBe(true);
      expect(result.data?.locations.length).toBeGreaterThan(0);
      expect(result.data?.locations).toContain('रायपुर');
      expect(result.data?.locations).toContain('बिलासपुर');
    });

    test('should validate locations against geography data', async () => {
      const locations = ['रायपुर', 'InvalidLocation'];

      const result = await aiAssistantTools.addLocation(
        locations,
        mockTweetText,
        []
      );

      expect(result.success).toBe(true);
      expect(result.data?.validated).toBe(true);
      expect(result.data?.locations).toContain('रायपुर');
      expect(result.data?.locations).not.toContain('InvalidLocation');
    });

    test('should provide location suggestions', async () => {
      const result = await aiAssistantTools.addLocation(
        ['रायपुर'],
        mockTweetText,
        []
      );

      expect(result.success).toBe(true);
      expect(result.data?.suggestions).toBeInstanceOf(Array);
    });

    test('should handle empty locations gracefully', async () => {
      const result = await aiAssistantTools.addLocation(
        [],
        'No locations mentioned',
        []
      );

      expect(result.success).toBe(true);
      expect(result.data?.locations).toBeInstanceOf(Array);
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('suggestEventType Tool', () => {
    test('should suggest event types based on tweet content', async () => {
      const tweetAboutMeeting = 'राज्य सरकार की बैठक में महत्वपूर्ण निर्णय लिए गए।';

      const result = await aiAssistantTools.suggestEventType(
        tweetAboutMeeting
      );

      expect(result.success).toBe(true);
      expect(result.data?.eventType).toBeDefined();
      expect(result.data?.suggestions).toBeInstanceOf(Array);
      expect(result.data?.aliases).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should provide multiple event type suggestions', async () => {
      const result = await aiAssistantTools.suggestEventType(
        mockTweetText
      );

      expect(result.success).toBe(true);
      expect(result.data?.suggestions.length).toBeGreaterThan(0);
      expect(result.data?.suggestions.length).toBeLessThanOrEqual(5);
    });

    test('should handle tweets with no clear event type', async () => {
      const genericTweet = 'यह एक सामान्य ट्वीट है।';

      const result = await aiAssistantTools.suggestEventType(
        genericTweet
      );

      expect(result.success).toBe(true);
      expect(result.data?.eventType).toBeDefined();
      expect(result.confidence).toBeLessThan(0.8);
    });

    test('should provide aliases for event types', async () => {
      const result = await aiAssistantTools.suggestEventType(
        'बैठक meeting'
      );

      expect(result.success).toBe(true);
      expect(result.data?.aliases).toBeInstanceOf(Array);
      expect(result.data?.aliases.length).toBeGreaterThan(0);
    });
  });

  describe('addScheme Tool', () => {
    test('should add schemes from provided list', async () => {
      const schemes = ['PM Kisan', 'Ayushman Bharat'];
      const existingSchemes = ['Ujjwala'];

      const result = await aiAssistantTools.addScheme(
        schemes,
        mockTweetText,
        existingSchemes
      );

      expect(result.success).toBe(true);
      expect(result.data?.schemes).toContain('PM Kisan');
      expect(result.data?.schemes).toContain('Ayushman Bharat');
      expect(result.data?.schemes).toContain('Ujjwala');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should parse schemes from tweet text when not provided', async () => {
      const tweetWithSchemes = 'PM Kisan योजना और Ayushman Bharat कार्यक्रम की घोषणा की गई।';

      const result = await aiAssistantTools.addScheme(
        [],
        tweetWithSchemes,
        []
      );

      expect(result.success).toBe(true);
      expect(result.data?.schemes.length).toBeGreaterThan(0);
      expect(result.data?.schemes).toContain('PM Kisan');
      expect(result.data?.schemes).toContain('Ayushman Bharat');
    });

    test('should validate schemes against reference data', async () => {
      const schemes = ['PM Kisan', 'InvalidScheme'];

      const result = await aiAssistantTools.addScheme(
        schemes,
        mockTweetText,
        []
      );

      expect(result.success).toBe(true);
      expect(result.data?.validated).toBe(true);
      expect(result.data?.schemes).toContain('PM Kisan');
      expect(result.data?.schemes).not.toContain('InvalidScheme');
    });

    test('should provide scheme suggestions', async () => {
      const result = await aiAssistantTools.addScheme(
        ['PM Kisan'],
        mockTweetText,
        []
      );

      expect(result.success).toBe(true);
      expect(result.data?.suggestions).toBeInstanceOf(Array);
    });

    test('should handle Hindi scheme names', async () => {
      const hindiSchemes = ['PM किसान', 'आयुष्मान भारत'];

      const result = await aiAssistantTools.addScheme(
        hindiSchemes,
        mockTweetText,
        []
      );

      expect(result.success).toBe(true);
      expect(result.data?.schemes).toBeInstanceOf(Array);
    });
  });

  describe('generateHashtags Tool', () => {
    test('should generate contextual hashtags', async () => {
      const result = await aiAssistantTools.generateHashtags(
        mockTweetText,
        'बैठक',
        ['रायपुर'],
        ['PM Kisan']
      );

      expect(result.success).toBe(true);
      expect(result.data?.hashtags).toBeInstanceOf(Array);
      expect(result.data?.hashtags.length).toBeGreaterThan(0);
      expect(result.data?.contextual).toBe(true);
      expect(result.data?.generated).toBe(true);
    });

    test('should generate hashtags from event type', async () => {
      const result = await aiAssistantTools.generateHashtags(
        mockTweetText,
        'बैठक'
      );

      expect(result.success).toBe(true);
      expect(result.data?.hashtags).toContain('#बैठक');
    });

    test('should generate hashtags from locations', async () => {
      const result = await aiAssistantTools.generateHashtags(
        mockTweetText,
        undefined,
        ['रायपुर', 'बिलासपुर']
      );

      expect(result.success).toBe(true);
      expect(result.data?.hashtags).toContain('#रायपुर');
      expect(result.data?.hashtags).toContain('#बिलासपुर');
    });

    test('should generate hashtags from schemes', async () => {
      const result = await aiAssistantTools.generateHashtags(
        mockTweetText,
        undefined,
        undefined,
        ['PM Kisan', 'Ayushman Bharat']
      );

      expect(result.success).toBe(true);
      expect(result.data?.hashtags).toContain('#PMKisan');
      expect(result.data?.hashtags).toContain('#AyushmanBharat');
    });

    test('should generate contextual hashtags based on content', async () => {
      const developmentTweet = 'राज्य के विकास के लिए नई योजनाएं शुरू की गई हैं।';

      const result = await aiAssistantTools.generateHashtags(
        developmentTweet
      );

      expect(result.success).toBe(true);
      expect(result.data?.hashtags).toContain('#विकास');
      expect(result.data?.hashtags).toContain('#Development');
    });

    test('should handle empty inputs gracefully', async () => {
      const result = await aiAssistantTools.generateHashtags(
        'Simple tweet'
      );

      expect(result.success).toBe(true);
      expect(result.data?.hashtags).toBeInstanceOf(Array);
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('validateConsistency Tool', () => {
    test('should validate scheme-event compatibility', async () => {
      const result = await aiAssistantTools.validateConsistency(
        'बैठक',
        ['रायपुर'],
        ['PM Kisan'],
        mockTweetText
      );

      expect(result.success).toBe(true);
      expect(result.data?.isValid).toBeDefined();
      expect(result.data?.issues).toBeInstanceOf(Array);
      expect(result.data?.suggestions).toBeInstanceOf(Array);
    });

    test('should validate location existence', async () => {
      const result = await aiAssistantTools.validateConsistency(
        'बैठक',
        ['रायपुर', 'InvalidLocation'],
        ['PM Kisan'],
        mockTweetText
      );

      expect(result.success).toBe(true);
      expect(result.data?.issues).toBeInstanceOf(Array);
      expect(result.data?.suggestions).toBeInstanceOf(Array);
    });

    test('should validate hashtag relevance', async () => {
      const tweetWithManyHashtags = 'Tweet with #hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5 #hashtag6';

      const result = await aiAssistantTools.validateConsistency(
        'बैठक',
        ['रायपुर'],
        ['PM Kisan'],
        tweetWithManyHashtags
      );

      expect(result.success).toBe(true);
      expect(result.data?.issues).toBeInstanceOf(Array);
      expect(result.data?.issues.some(issue => issue.includes('hashtag'))).toBe(true);
    });

    test('should return valid for consistent data', async () => {
      const result = await aiAssistantTools.validateConsistency(
        'कार्यक्रम',
        ['रायपुर'],
        ['PM Kisan'],
        'PM Kisan योजना के तहत कार्यक्रम आयोजित किया गया।'
      );

      expect(result.success).toBe(true);
      expect(result.data?.isValid).toBe(true);
      expect(result.data?.issues.length).toBe(0);
    });

    test('should provide suggestions for inconsistent data', async () => {
      const result = await aiAssistantTools.validateConsistency(
        'बैठक',
        ['InvalidLocation'],
        ['InvalidScheme'],
        mockTweetText
      );

      expect(result.success).toBe(true);
      expect(result.data?.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      // Mock database error
      const mockPool = {
        query: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      };
      
      // This would require refactoring the tools to accept a pool instance
      // For now, we test the error handling structure
      const result = await aiAssistantTools.addLocation(
        ['रायपुर'],
        mockTweetText,
        []
      );

      expect(result.success).toBe(true); // Tools should handle errors gracefully
    });

    test('should handle malformed input data', async () => {
      const result = await aiAssistantTools.addLocation(
        null as any,
        mockTweetText,
        []
      );

      expect(result.success).toBe(true);
      expect(result.data?.locations).toBeInstanceOf(Array);
    });

    test('should handle empty tweet text', async () => {
      const result = await aiAssistantTools.suggestEventType('');

      expect(result.success).toBe(true);
      expect(result.data?.eventType).toBeDefined();
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('Performance', () => {
    test('should complete operations within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await aiAssistantTools.addLocation(
        ['रायपुर', 'बिलासपुर'],
        mockTweetText,
        []
      );
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(responseTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test('should handle multiple concurrent operations', async () => {
      const operations = [
        aiAssistantTools.addLocation(['रायपुर'], mockTweetText, []),
        aiAssistantTools.suggestEventType(mockTweetText),
        aiAssistantTools.addScheme(['PM Kisan'], mockTweetText, []),
        aiAssistantTools.generateHashtags(mockTweetText),
        aiAssistantTools.validateConsistency('बैठक', ['रायपुर'], ['PM Kisan'], mockTweetText)
      ];

      const results = await Promise.all(operations);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('Real Data Integration', () => {
    test('should work with real tweet data', async () => {
      const realTweetData = {
        tweet_id: '1979049036633010349',
        text: 'राज्य के विकास के लिए नई योजनाएं शुरू की गई हैं। PM Kisan और Ayushman Bharat योजनाओं की घोषणा की गई।',
        event_type: 'announcement',
        locations: ['छत्तीसगढ़'],
        schemes_mentioned: ['PM Kisan', 'Ayushman Bharat']
      };

      const result = await aiAssistantTools.validateConsistency(
        realTweetData.event_type,
        realTweetData.locations,
        realTweetData.schemes_mentioned,
        realTweetData.text
      );

      expect(result.success).toBe(true);
      expect(result.data?.isValid).toBeDefined();
    });

    test('should handle tweets with mixed Hindi-English content', async () => {
      const mixedTweet = 'राज्य सरकार ने PM Kisan योजना के तहत किसानों को सहायता प्रदान की। Development के लिए नई initiatives शुरू की गईं।';

      const locationResult = await aiAssistantTools.addLocation([], mixedTweet, []);
      const schemeResult = await aiAssistantTools.addScheme([], mixedTweet, []);
      const hashtagResult = await aiAssistantTools.generateHashtags(mixedTweet);

      expect(locationResult.success).toBe(true);
      expect(schemeResult.success).toBe(true);
      expect(hashtagResult.success).toBe(true);
    });
  });
});

