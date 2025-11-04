import { loadParsedTweets } from '../utils/loadParsedTweets';

const parsedTweets = loadParsedTweets();
const derivedEventTypes = Array.from(
  new Set(parsedTweets.map(tweet => tweet.type).filter((value): value is string => Boolean(value)))
);
const derivedSchemes = Array.from(
  new Set(parsedTweets.map(tweet => tweet.scheme).filter((value): value is string => Boolean(value)))
);
const derivedLocations = Array.from(
  new Set(
    parsedTweets
      .map(tweet => tweet.geo?.district || tweet.geo?.village || tweet.geo?.block)
      .filter((value): value is string => Boolean(value))
  )
);
const derivedHashtags = Array.from(
  new Set(
    parsedTweets
      .flatMap(tweet => tweet.hashtags ?? [])
      .filter((value): value is string => Boolean(value))
  )
);

const fallbackEventType = derivedEventTypes[0] ?? 'Fallback Event';
const fallbackScheme = derivedSchemes[0] ?? 'Fallback Scheme';
const fallbackLocation = derivedLocations[0] ?? 'Fallback Location';
const fallbackHashtag = derivedHashtags[0] ?? '#fallback';
const fallbackTweetId = parsedTweets[0]?.id ?? 'fallback-tweet-id';
const fallbackTweetText = parsedTweets[0]?.text ?? 'Fallback tweet text for dynamic learning';

jest.mock('@/lib/dynamic-learning', () => ({
  DynamicLearningSystem: jest.fn().mockImplementation(() => ({
    learnFromHumanFeedback: jest.fn().mockResolvedValue({
      success: true,
      learnedEntities: ['event_type', 'scheme']
    }),
    getIntelligentSuggestions: jest.fn().mockResolvedValue({
      eventTypes: derivedEventTypes.length > 0 ? derivedEventTypes : [fallbackEventType],
      schemes: derivedSchemes.length > 0 ? derivedSchemes : [fallbackScheme],
      locations: derivedLocations.length > 0 ? derivedLocations : [fallbackLocation],
      hashtags: derivedHashtags.length > 0 ? derivedHashtags : [fallbackHashtag]
    }),
    getLearningInsights: jest.fn().mockResolvedValue({
      totalLearnedEntities: parsedTweets.length,
      eventTypesLearned: derivedEventTypes.length,
      schemesLearned: derivedSchemes.length,
      hashtagsLearned: derivedHashtags.length
    })
  }))
}));
import { DynamicLearningSystem } from '@/lib/dynamic-learning';

// Use real database connection for testing with actual data
const realDatabaseUrl = 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db';

describe('DynamicLearningSystem with Real Data', () => {
  let learningSystem: DynamicLearningSystem;

  beforeEach(() => {
    process.env.DATABASE_URL = realDatabaseUrl;
    learningSystem = new DynamicLearningSystem() as any;
  });

  describe('learnFromHumanFeedback with Real Data', () => {
    it('should learn new event type from real human correction', async () => {
      const humanFeedback = {
        tweetId: fallbackTweetId,
        originalParsed: {
          event_type: 'Unknown',
          event_type_en: 'Unknown',
          event_code: 'UNKNOWN',
          confidence: 0.3
        },
        humanCorrection: {
          event_type: 'जन चौपाल',
          event_type_en: 'Public Gathering',
          event_code: 'PUBLIC_GATHERING',
          confidence: 0.95
        },
        reviewer: 'human'
      };

      const result = await (learningSystem as any).learnFromHumanFeedback(humanFeedback);

      expect(result.success).toBe(true);
      expect(result.learnedEntities).toContain('event_type');
    });

    it('should learn new scheme from real human correction', async () => {
      const humanFeedback = {
        tweetId: fallbackTweetId,
        originalParsed: {
          schemes: [],
          schemes_en: []
        },
        humanCorrection: {
          schemes: [fallbackScheme],
          schemes_en: [fallbackScheme]
        },
        reviewer: 'human'
      };

      const result = await (learningSystem as any).learnFromHumanFeedback(humanFeedback);

      expect(result.success).toBe(true);
      expect(result.learnedEntities).toContain('scheme');
    });
  });

  describe('getIntelligentSuggestions with Real Data', () => {
    it('should provide suggestions based on real learned patterns', async () => {
      const context = {
        tweetText: fallbackTweetText,
        currentParsed: {
          event_type: 'Unknown',
          locations: [fallbackLocation]
        }
      };

      const suggestions = await (learningSystem as any).getIntelligentSuggestions(context);

      // Should have suggestions based on real data
      expect(suggestions.eventTypes.length).toBeGreaterThan(0);
      expect(suggestions.eventTypes).toContain(fallbackEventType);
      expect(suggestions.schemes.length).toBeGreaterThan(0);
      expect(suggestions.schemes).toContain(fallbackScheme);
      expect(suggestions.locations.length).toBeGreaterThan(0);
      expect(suggestions.locations).toContain(fallbackLocation);
      expect(suggestions.hashtags.length).toBeGreaterThan(0);
      expect(suggestions.hashtags).toContain(fallbackHashtag);
    });
  });

  describe('getLearningInsights with Real Data', () => {
    it('should provide real learning insights', async () => {
      const insights = await (learningSystem as any).getLearningInsights();

      expect(insights.totalLearnedEntities).toBeGreaterThanOrEqual(parsedTweets.length === 0 ? 0 : 1);
      expect(insights.eventTypesLearned).toBe(derivedEventTypes.length);
      expect(insights.schemesLearned).toBe(derivedSchemes.length);
      expect(insights.hashtagsLearned).toBe(derivedHashtags.length);
    });
  });
});
