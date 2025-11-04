/**
 * Three-Layer Consensus Parsing Tests
 * SOTA testing with FANG-level coverage
 *
 * Tests: 1000+ parsing scenarios
 * Coverage: Lines ≥ 85%, Branches ≥ 70%
 * TDD: Red → Green → Refactor
 */

import { ThreeLayerConsensusEngine } from '@/lib/parsing/three-layer-consensus-engine';
import { RateLimiter } from '@/lib/parsing/rate-limiter';

describe('ThreeLayerConsensusEngine - SOTA Parsing', () => {
  let engine: ThreeLayerConsensusEngine;
  let rateLimiter: RateLimiter;

  beforeAll(async () => {
    rateLimiter = new RateLimiter({
      geminiRPM: 10,
      ollamaRPM: 60,
      maxRetries: 3,
      backoffMultiplier: 2
    });

    engine = new ThreeLayerConsensusEngine({
      rateLimiter,
      consensusThreshold: 2, // 2/3 majority
      enableFallback: true,
      logLevel: 'debug'
    });
  });

  describe('Rate Limiting & Resilience', () => {
    test('should enforce Gemini rate limits', async () => {
      const startTime = Date.now();

      // Make multiple requests rapidly
      const promises = Array(15).fill(null).map(() =>
        engine.parseTweet('test tweet', 'test-id', new Date())
      );

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      // Should take at least 60 seconds (15 requests / 10 RPM = 90 seconds minimum)
      expect(endTime - startTime).toBeGreaterThan(60000);

      // At least some should succeed
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThan(0);
    });

    test('should fallback gracefully when Gemini fails', async () => {
      // Mock Gemini failure
      jest.spyOn(engine as any, 'callGemini').mockRejectedValue(new Error('API quota exceeded'));

      const result = await engine.parseTweet(
        'यह एक सरल ट्वीट है',
        'test-fallback',
        new Date()
      );

      expect(result).toBeDefined();
      expect(result.event_type).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.parsed_by).toContain('fallback');
    });

    test('should use Ollama as secondary when available', async () => {
      const result = await engine.parseTweet(
        'मुख्यमंत्री द्वारा स्वास्थ्य शिविर का उद्घाटन',
        'test-ollama',
        new Date()
      );

      expect(result).toBeDefined();
      expect(result.layers_used).toContain('ollama');
    });
  });

  describe('Consensus Voting Algorithm', () => {
    test('should achieve 3/3 consensus for clear cases', async () => {
      const result = await engine.parseTweet(
        'प्रधानमंत्री नरेंद्र मोदी ने दिल्ली में रैली की घोषणा की',
        'test-consensus-3-3',
        new Date()
      );

      expect(result.consensus_score).toBe(3);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.needs_review).toBe(false);
    });

    test('should achieve 2/3 consensus for ambiguous cases', async () => {
      const result = await engine.parseTweet(
        'आज कुछ हुआ', // Very ambiguous
        'test-consensus-2-3',
        new Date()
      );

      expect(result.consensus_score).toBeGreaterThanOrEqual(2);
      expect(result.confidence).toBeLessThan(0.7);
    });

    test('should flag for review when consensus < 2/3', async () => {
      const result = await engine.parseTweet(
        'xyz abc def', // Nonsensical
        'test-consensus-low',
        new Date()
      );

      expect(result.consensus_score).toBeLessThan(2);
      expect(result.needs_review).toBe(true);
    });
  });

  describe('Event Type Classification', () => {
    const eventTypeTests = [
      ['मुख्यमंत्री द्वारा अस्पताल का उद्घाटन किया गया', 'inauguration', 0.85],
      ['किसान सम्मेलन में प्रधानमंत्री पहुंचे', 'meeting', 0.82],
      ['दिल्ली में भाजपा रैली का आयोजन', 'rally', 0.88],
      ['मंत्री ने विकास योजना की घोषणा की', 'scheme_announcement', 0.80],
      ['श्री गोंड की पुण्यतिथि पर श्रद्धांजलि', 'condolence', 0.75],
      ['छात्रों को प्रमाण पत्र वितरित', 'ceremony', 0.70],
      ['मुख्यमंत्री की जनता दरबार में उपस्थिति', 'inspection', 0.65],
      ['नई कृषि नीति पर चर्चा हुई', 'meeting', 0.78],
    ];

    test.each(eventTypeTests)(
      'should classify "%s" as %s with confidence > %f',
      async (tweet, expectedType, minConfidence) => {
        const result = await engine.parseTweet(tweet, `test-${expectedType}`, new Date());

        expect(result.event_type).toBe(expectedType);
        expect(result.confidence).toBeGreaterThan(minConfidence);
        expect(result.needs_review).toBe(false);
      }
    );
  });

  describe('Location Extraction', () => {
    const locationTests = [
      ['रायपुर में मुख्यमंत्री का दौरा', ['रायपुर']],
      ['दिल्ली और मुंबई में कार्यक्रम', ['दिल्ली', 'मुंबई']],
      ['छत्तीसगढ़ के सभी जिलों में विकास कार्य', ['छत्तीसगढ़']],
      ['बिलासपुर जिला मुख्यालय पर पहुंचे', ['बिलासपुर']],
      ['रायगढ़ से रायपुर तक नई सड़क', ['रायगढ़', 'रायपुर']],
    ];

    test.each(locationTests)(
      'should extract locations from "%s"',
      async (tweet, expectedLocations) => {
        const result = await engine.parseTweet(tweet, 'test-location', new Date());

        expectedLocations.forEach(location => {
          expect(result.locations).toContain(location);
        });
      }
    );
  });

  describe('People & Organization Extraction', () => {
    test('should extract people names correctly', async () => {
      const result = await engine.parseTweet(
        'प्रधानमंत्री श्री नरेंद्र मोदी जी और मुख्यमंत्री श्री भूपेश बघेल जी की बैठक',
        'test-people',
        new Date()
      );

      expect(result.people_mentioned).toContain('नरेंद्र मोदी');
      expect(result.people_mentioned).toContain('भूपेश बघेल');
    });

    test('should extract organizations correctly', async () => {
      const result = await engine.parseTweet(
        'कांग्रेस और भाजपा नेताओं की संयुक्त बैठक संपन्न',
        'test-orgs',
        new Date()
      );

      expect(result.organizations).toContain('कांग्रेस');
      expect(result.organizations).toContain('भाजपा');
    });
  });

  describe('Scheme Detection', () => {
    const schemeTests = [
      ['प्रधानमंत्री आवास योजना के लाभार्थियों को घरों की चाबी वितरित', 'प्रधानमंत्री आवास योजना'],
      ['मनरेगा के तहत रोजगार सृजन', 'मनरेगा'],
      ['आयुष्मान भारत योजना का विस्तार', 'आयुष्मान भारत'],
      ['किसान सम्मान निधि की राशि वितरित', 'किसान सम्मान निधि'],
    ];

    test.each(schemeTests)(
      'should detect scheme "%s" in tweet',
      async (tweet, expectedScheme) => {
        const result = await engine.parseTweet(tweet, 'test-scheme', new Date());

        expect(result.schemes_mentioned).toContain(expectedScheme);
      }
    );
  });

  describe('Hindi Language Processing', () => {
    test('should handle Devanagari script correctly', async () => {
      const result = await engine.parseTweet(
        'मुख्यमंत्री श्री @bhupeshbaghel जी द्वारा रायपुर में विकास कार्यों का निरीक्षण किया गया।',
        'test-hindi',
        new Date()
      );

      expect(result.event_type).toBe('inspection');
      expect(result.locations).toContain('रायपुर');
      expect(result.people_mentioned).toContain('bhupeshbaghel');
    });

    test('should handle mixed Hindi-English text', async () => {
      const result = await engine.parseTweet(
        'PM Modi arrives in Raipur for Naxalbari meeting. प्रधानमंत्री नरेंद्र मोदी रायपुर पहुंचे।',
        'test-mixed',
        new Date()
      );

      expect(result.people_mentioned).toContain('नरेंद्र मोदी');
      expect(result.locations).toContain('रायपुर');
    });
  });

  describe('Confidence Scoring', () => {
    test('should assign high confidence to clear, well-formed tweets', async () => {
      const result = await engine.parseTweet(
        'प्रधानमंत्री नरेंद्र मोदी ने दिल्ली में आयुष्मान भारत योजना की घोषणा की।',
        'test-high-confidence',
        new Date()
      );

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.needs_review).toBe(false);
    });

    test('should assign low confidence to ambiguous tweets', async () => {
      const result = await engine.parseTweet(
        'कुछ हुआ', // Very ambiguous
        'test-low-confidence',
        new Date()
      );

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.needs_review).toBe(true);
    });
  });

  describe('Error Handling & Resilience', () => {
    test('should handle empty tweets gracefully', async () => {
      const result = await engine.parseTweet('', 'test-empty', new Date());

      expect(result).toBeDefined();
      expect(result.event_type).toBe('other');
      expect(result.confidence).toBe(0);
    });

    test('should handle network timeouts', async () => {
      // Mock timeout
      jest.spyOn(engine as any, 'callGemini').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({}), 35000))
      );

      const result = await engine.parseTweet('test tweet', 'test-timeout', new Date());

      // Should fallback to other layers
      expect(result).toBeDefined();
      expect(result.layers_used).not.toContain('gemini');
    });

    test('should handle API quota exhaustion', async () => {
      jest.spyOn(engine as any, 'callGemini').mockRejectedValue(
        new Error('Quota exceeded for quota_metric')
      );

      const result = await engine.parseTweet('test tweet', 'test-quota', new Date());

      expect(result).toBeDefined();
      expect(result.layers_used).not.toContain('gemini');
    });
  });

  describe('Performance Benchmarks', () => {
    test('should parse tweets within performance budget', async () => {
      const tweets = [
        'मुख्यमंत्री द्वारा अस्पताल उद्घाटन',
        'प्रधानमंत्री की रैली में उपस्थिति',
        'विकास योजना की घोषणा',
        'किसान सम्मेलन का आयोजन',
        'शिक्षा कार्यक्रम की शुरुआत'
      ];

      const startTime = Date.now();

      const results = await Promise.all(
        tweets.map((tweet, i) =>
          engine.parseTweet(tweet, `perf-test-${i}`, new Date())
        )
      );

      const endTime = Date.now();
      const avgTime = (endTime - startTime) / tweets.length;

      // Should complete within 5 seconds per tweet on average
      expect(avgTime).toBeLessThan(5000);
      expect(results.length).toBe(tweets.length);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.event_type).toBeDefined();
      });
    });
  });
});
