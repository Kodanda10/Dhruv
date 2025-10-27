/**
 * Unit Tests for Natural Language Parser
 * 
 * Tests Hindi/English mixed request parsing with real tweet examples
 */

import { nlParser } from '@/lib/ai-assistant/nl-parser';

// Mock the dependencies
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockResolvedValue(JSON.stringify({
            intent: 'add_location',
            entities: {
              locations: [{ text: 'रायपुर', confidence: 0.9, startIndex: 4, endIndex: 10, normalized: 'रायपुर' }],
              eventTypes: [],
              schemes: [],
              people: [],
              hashtags: [],
              numbers: [],
              dates: []
            },
            actions: ['addLocation'],
            confidence: 0.8,
            language: 'mixed',
            complexity: 'simple'
          }))
        }
      })
    })
  }))
}));

describe('Natural Language Parser', () => {
  const realTweetExamples = [
    'राज्य सरकार ने रायपुर में बैठक की और PM Kisan योजना की घोषणा की।',
    'बिलासपुर में कार्यक्रम आयोजित किया गया जिसमें कई मंत्रियों ने भाग लिया।',
    'छत्तीसगढ़ के विकास के लिए नई योजनाएं शुरू की गई हैं।',
    'रायगढ़ में Ayushman Bharat कार्यक्रम का उद्घाटन किया गया।',
    'दुर्ग में किसानों के लिए विशेष बैठक आयोजित की गई।'
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Parsing', () => {
    test('should parse simple Hindi requests', async () => {
      const result = await nlParser.parseRequest('रायपुर जोड़ें');

      expect(result.intent).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.actions).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.language).toBe('hindi');
    });

    test('should parse simple English requests', async () => {
      const result = await nlParser.parseRequest('add raipur location');

      expect(result.intent).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.actions).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.language).toBe('english');
    });

    test('should parse mixed Hindi-English requests', async () => {
      const result = await nlParser.parseRequest('add रायपुर as location');

      expect(result.intent).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.actions).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.language).toBe('mixed');
    });

    test('should detect language correctly', async () => {
      const hindiResult = await nlParser.parseRequest('रायपुर जोड़ें');
      const englishResult = await nlParser.parseRequest('add raipur');
      const mixedResult = await nlParser.parseRequest('add रायपुर location');

      expect(hindiResult.language).toBe('hindi');
      expect(englishResult.language).toBe('english');
      expect(mixedResult.language).toBe('mixed');
    });
  });

  describe('Intent Recognition', () => {
    test('should recognize add location intent', async () => {
      const result = await nlParser.parseRequest('add रायपुर location');

      expect(result.intent).toBe('add_location');
      expect(result.actions).toContain('addLocation');
    });

    test('should recognize change event intent', async () => {
      const result = await nlParser.parseRequest('change event to बैठक');

      expect(result.intent).toBe('change_event');
      expect(result.actions).toContain('changeEventType');
    });

    test('should recognize add scheme intent', async () => {
      const result = await nlParser.parseRequest('add PM Kisan scheme');

      expect(result.intent).toBe('add_scheme');
      expect(result.actions).toContain('addScheme');
    });

    test('should recognize generate hashtags intent', async () => {
      const result = await nlParser.parseRequest('generate hashtags');

      expect(result.intent).toBe('generate_hashtags');
      expect(result.actions).toContain('generateHashtags');
    });

    test('should recognize validate data intent', async () => {
      const result = await nlParser.parseRequest('validate data');

      expect(result.intent).toBe('validate_data');
      expect(result.actions).toContain('validateData');
    });

    test('should recognize get suggestions intent', async () => {
      const result = await nlParser.parseRequest('get suggestions');

      expect(result.intent).toBe('get_suggestions');
      expect(result.actions).toContain('generateSuggestions');
    });

    test('should recognize help intent', async () => {
      const result = await nlParser.parseRequest('help me');

      expect(result.intent).toBe('help');
      expect(result.actions).toContain('showHelp');
    });
  });

  describe('Entity Extraction', () => {
    test('should extract locations from Hindi text', async () => {
      const result = await nlParser.parseRequest('add रायपुर, बिलासपुर as locations');

      expect(result.entities.locations.length).toBeGreaterThan(0);
      expect(result.entities.locations.some(loc => loc.text.includes('रायपुर'))).toBe(true);
      expect(result.entities.locations.some(loc => loc.text.includes('बिलासपुर'))).toBe(true);
    });

    test('should extract locations from English text', async () => {
      const result = await nlParser.parseRequest('add raipur, bilaspur as locations');

      expect(result.entities.locations.length).toBeGreaterThan(0);
      expect(result.entities.locations.some(loc => loc.text.toLowerCase().includes('raipur'))).toBe(true);
      expect(result.entities.locations.some(loc => loc.text.toLowerCase().includes('bilaspur'))).toBe(true);
    });

    test('should extract event types', async () => {
      const result = await nlParser.parseRequest('change to बैठक meeting');

      expect(result.entities.eventTypes.length).toBeGreaterThan(0);
      expect(result.entities.eventTypes.some(event => event.text.includes('बैठक'))).toBe(true);
    });

    test('should extract schemes', async () => {
      const result = await nlParser.parseRequest('add PM Kisan scheme');

      expect(result.entities.schemes.length).toBeGreaterThan(0);
      expect(result.entities.schemes.some(scheme => scheme.text.includes('PM Kisan'))).toBe(true);
    });

    test('should extract hashtags', async () => {
      const result = await nlParser.parseRequest('add #विकास hashtag');

      expect(result.entities.hashtags.length).toBeGreaterThan(0);
      expect(result.entities.hashtags.some(tag => tag.text.includes('#विकास'))).toBe(true);
    });

    test('should extract numbers', async () => {
      const result = await nlParser.parseRequest('add 3 schemes');

      expect(result.entities.numbers.length).toBeGreaterThan(0);
      expect(result.entities.numbers.some(num => num.text.includes('3'))).toBe(true);
    });

    test('should extract dates', async () => {
      const result = await nlParser.parseRequest('event on 15/01/2024');

      expect(result.entities.dates.length).toBeGreaterThan(0);
      expect(result.entities.dates.some(date => date.text.includes('15/01/2024'))).toBe(true);
    });
  });

  describe('Complex Requests', () => {
    test('should handle multiple actions in one request', async () => {
      const result = await nlParser.parseRequest('add रायपुर location and PM Kisan scheme');

      expect(result.actions.length).toBeGreaterThan(1);
      expect(result.actions).toContain('addLocation');
      expect(result.actions).toContain('addScheme');
    });

    test('should handle complex Hindi requests', async () => {
      const result = await nlParser.parseRequest('रायपुर और बिलासपुर में बैठक के लिए PM Kisan योजना जोड़ें');

      expect(result.intent).toBeDefined();
      expect(result.entities.locations.length).toBeGreaterThan(0);
      expect(result.entities.schemes.length).toBeGreaterThan(0);
      expect(result.complexity).toBe('complex');
    });

    test('should handle requests with multiple entities', async () => {
      const result = await nlParser.parseRequest('add रायपुर, बिलासपुर locations and PM Kisan, Ayushman Bharat schemes');

      expect(result.entities.locations.length).toBeGreaterThan(1);
      expect(result.entities.schemes.length).toBeGreaterThan(1);
      expect(result.complexity).toBe('complex');
    });

    test('should handle malformed requests gracefully', async () => {
      const result = await nlParser.parseRequest('asdfghjkl qwertyuiop');

      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.complexity).toBe('simple');
    });
  });

  describe('Real Tweet Integration', () => {
    test('should parse requests related to real tweets', async () => {
      for (const tweet of realTweetExamples) {
        const result = await nlParser.parseRequest(`add information for: ${tweet}`);

        expect(result.intent).toBeDefined();
        expect(result.entities).toBeDefined();
        expect(result.actions).toBeInstanceOf(Array);
        expect(result.confidence).toBeGreaterThan(0);
      }
    });

    test('should extract entities from real tweet content', async () => {
      const tweet = 'राज्य सरकार ने रायपुर में बैठक की और PM Kisan योजना की घोषणा की।';
      const result = await nlParser.parseRequest(`add ${tweet}`);

      expect(result.entities.locations.length).toBeGreaterThan(0);
      expect(result.entities.eventTypes.length).toBeGreaterThan(0);
      expect(result.entities.schemes.length).toBeGreaterThan(0);
    });

    test('should handle requests about specific tweet fields', async () => {
      const requests = [
        'add रायपुर as location for this tweet',
        'change event type to बैठक for this tweet',
        'add PM Kisan scheme to this tweet',
        'generate hashtags for this tweet',
        'validate data for this tweet'
      ];

      for (const request of requests) {
        const result = await nlParser.parseRequest(request);

        expect(result.intent).toBeDefined();
        expect(result.actions).toBeInstanceOf(Array);
        expect(result.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('Confidence Scoring', () => {
    test('should provide higher confidence for clear requests', async () => {
      const clearRequest = await nlParser.parseRequest('add रायपुर location');
      const unclearRequest = await nlParser.parseRequest('maybe something about places');

      expect(clearRequest.confidence).toBeGreaterThan(unclearRequest.confidence);
    });

    test('should provide confidence scores for all entities', async () => {
      const result = await nlParser.parseRequest('add रायपुर location and PM Kisan scheme');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);

      if (result.entities.locations.length > 0) {
        result.entities.locations.forEach(location => {
          expect(location.confidence).toBeGreaterThan(0);
          expect(location.confidence).toBeLessThanOrEqual(1);
        });
      }
    });

    test('should have lower confidence for complex requests', async () => {
      const simpleRequest = await nlParser.parseRequest('add रायपुर');
      const complexRequest = await nlParser.parseRequest('add रायपुर, बिलासपुर, दुर्ग locations and PM Kisan, Ayushman Bharat, Ujjwala schemes and change event to बैठक meeting');

      expect(complexRequest.confidence).toBeLessThanOrEqual(simpleRequest.confidence);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty requests', async () => {
      const result = await nlParser.parseRequest('');

      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeLessThan(0.5);
    });

    test('should handle null/undefined input', async () => {
      const result = await nlParser.parseRequest(null as any);

      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeLessThan(0.5);
    });

    test('should handle very long requests', async () => {
      const longRequest = 'add '.repeat(100) + 'रायपुर location';
      const result = await nlParser.parseRequest(longRequest);

      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle requests with special characters', async () => {
      const specialRequest = 'add रायपुर@#$%^&*() location!!!';
      const result = await nlParser.parseRequest(specialRequest);

      expect(result.intent).toBeDefined();
      expect(result.entities.locations.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('should parse requests within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await nlParser.parseRequest('add रायपुर location');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(result.intent).toBeDefined();
      expect(responseTime).toBeLessThan(3000); // Should parse within 3 seconds
    });

    test('should handle multiple concurrent parsing requests', async () => {
      const requests = [
        'add रायपुर location',
        'change event to बैठक',
        'add PM Kisan scheme',
        'generate hashtags',
        'validate data'
      ];

      const startTime = Date.now();
      const results = await Promise.all(requests.map(req => nlParser.parseRequest(req)));
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      results.forEach(result => {
        expect(result.intent).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      });

      expect(totalTime).toBeLessThan(10000); // All requests should complete within 10 seconds
    });
  });

  describe('Language Detection', () => {
    test('should correctly detect Hindi text', async () => {
      const hindiTexts = [
        'रायपुर जोड़ें',
        'बैठक बदलें',
        'योजना जोड़ें',
        'हैशटैग बनाएं'
      ];

      for (const text of hindiTexts) {
        const result = await nlParser.parseRequest(text);
        expect(result.language).toBe('hindi');
      }
    });

    test('should correctly detect English text', async () => {
      const englishTexts = [
        'add raipur',
        'change event',
        'add scheme',
        'generate hashtags'
      ];

      for (const text of englishTexts) {
        const result = await nlParser.parseRequest(text);
        expect(result.language).toBe('english');
      }
    });

    test('should correctly detect mixed text', async () => {
      const mixedTexts = [
        'add रायपुर location',
        'change event to बैठक',
        'add PM Kisan योजना',
        'generate #विकास hashtags'
      ];

      for (const text of mixedTexts) {
        const result = await nlParser.parseRequest(text);
        expect(result.language).toBe('mixed');
      }
    });
  });
});

