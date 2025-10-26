import { DynamicLearningSystem } from '@/lib/dynamic-learning';

// Use real database connection for testing with actual data
const realDatabaseUrl = 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db';

describe('DynamicLearningSystem with Real Data', () => {
  let learningSystem: DynamicLearningSystem;

  beforeEach(() => {
    // Use real database connection
    process.env.DATABASE_URL = realDatabaseUrl;
    learningSystem = new DynamicLearningSystem();
  });

  describe('learnFromHumanFeedback with Real Data', () => {
    it('should learn new event type from real human correction', async () => {
      // Get a real tweet from the database
      const realTweetId = '1979074268907606480'; // Use actual tweet ID from our data
      
      const humanFeedback = {
        tweetId: realTweetId,
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

      const result = await learningSystem.learnFromHumanFeedback(humanFeedback);

      expect(result.success).toBe(true);
      expect(result.learnedEntities).toContain('event_type');
    });

    it('should learn new scheme from real human correction', async () => {
      const realTweetId = '1979049036633010349';
      
      const humanFeedback = {
        tweetId: realTweetId,
        originalParsed: {
          schemes: [],
          schemes_en: []
        },
        humanCorrection: {
          schemes: ['मुख्यमंत्री स्लम स्वास्थ्य योजना'],
          schemes_en: ['CM Slum Health Scheme']
        },
        reviewer: 'human'
      };

      const result = await learningSystem.learnFromHumanFeedback(humanFeedback);

      expect(result.success).toBe(true);
      expect(result.learnedEntities).toContain('scheme');
    });
  });

  describe('getIntelligentSuggestions with Real Data', () => {
    it('should provide suggestions based on real learned patterns', async () => {
      const context = {
        tweetText: 'मुख्यमंत्री ने किसानों से मुलाकात की',
        currentParsed: {
          event_type: 'Unknown',
          locations: ['रायपुर']
        }
      };

      const suggestions = await learningSystem.getIntelligentSuggestions(context);

      // Should have suggestions based on real data
      expect(suggestions.eventTypes.length).toBeGreaterThan(0);
      expect(suggestions.schemes.length).toBeGreaterThan(0);
      expect(suggestions.locations.length).toBeGreaterThan(0);
      expect(suggestions.hashtags.length).toBeGreaterThan(0);
    });
  });

  describe('getLearningInsights with Real Data', () => {
    it('should provide real learning insights', async () => {
      const insights = await learningSystem.getLearningInsights();

      expect(insights.totalLearnedEntities).toBeGreaterThanOrEqual(0);
      expect(insights.eventTypesLearned).toBeGreaterThanOrEqual(0);
      expect(insights.schemesLearned).toBeGreaterThanOrEqual(0);
      expect(insights.hashtagsLearned).toBeGreaterThanOrEqual(0);
    });
  });
});

