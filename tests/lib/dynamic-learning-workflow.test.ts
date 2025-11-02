import { DynamicLearningSystem } from '@/lib/dynamic-learning';

// Skip database integration tests in CI if DATABASE_URL is not available
const shouldSkip = process.env.CI === 'true' && !process.env.DATABASE_URL;

// Use describe.skip to properly skip in CI
const describeOrSkip = shouldSkip ? describe.skip : describe;

// Use real database connection for testing with actual data
const realDatabaseUrl = 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db';

describeOrSkip('Complete Dynamic Learning Workflow with Real Data', () => {
  let learningSystem: DynamicLearningSystem;

  beforeAll(() => {
    if (shouldSkip) {
      return;
    }
    // Use real database connection
    process.env.DATABASE_URL = realDatabaseUrl;
    learningSystem = new DynamicLearningSystem();
  });

  describe('End-to-End Learning Workflow', () => {
    it('should complete full learning cycle with real data', async () => {
      if (shouldSkip) {
        return;
      }
      // Step 1: Get initial learning insights
      const initialInsights = await learningSystem.getLearningInsights();
      console.log('Initial learning insights:', initialInsights);

      // Step 2: Learn from human feedback using real tweet
      const realTweetId = '1979041171952283807'; // Real tweet ID from our database
      
      const humanFeedback = {
        tweetId: realTweetId,
        originalParsed: {
          event_type: 'Unknown',
          event_type_en: 'Unknown',
          event_code: 'UNKNOWN',
          schemes: [],
          schemes_en: [],
          locations: ['रायपुर'],
          generated_hashtags: ['#छत्तीसगढ़']
        },
        humanCorrection: {
          event_type: 'जन चौपाल',
          event_type_en: 'Public Gathering',
          event_code: 'PUBLIC_GATHERING',
          schemes: ['मुख्यमंत्री स्लम स्वास्थ्य योजना'],
          schemes_en: ['CM Slum Health Scheme'],
          locations: ['रायपुर', 'धमतरी'],
          generated_hashtags: ['#छत्तीसगढ़', '#जनचौपाल', '#स्लमस्वास्थ्य']
        },
        reviewer: 'human'
      };

      const learningResult = await learningSystem.learnFromHumanFeedback(humanFeedback);
      expect(learningResult.success).toBe(true);
      expect(learningResult.learnedEntities.length).toBeGreaterThan(0);
      console.log('Learning result:', learningResult);

      // Step 3: Get intelligent suggestions based on learned data
      const suggestions = await learningSystem.getIntelligentSuggestions({
        tweetText: 'मुख्यमंत्री ने किसानों से मुलाकात की',
        currentParsed: {
          event_type: 'Unknown',
          locations: ['रायपुर']
        }
      });

      expect(suggestions.eventTypes.length).toBeGreaterThan(0);
      expect(suggestions.schemes.length).toBeGreaterThan(0);
      expect(suggestions.locations.length).toBeGreaterThan(0);
      expect(suggestions.hashtags.length).toBeGreaterThan(0);
      console.log('Intelligent suggestions:', suggestions);

      // Step 4: Update reference datasets when approved
      const updateResult = await learningSystem.updateReferenceDatasets({
        entityType: 'event_type',
        entityId: 1, // Assuming event type ID 1 exists
        tweetId: realTweetId
      });

      expect(updateResult.success).toBe(true);
      console.log('Update result:', updateResult);

      // Step 5: Get final learning insights to see improvement
      const finalInsights = await learningSystem.getLearningInsights();
      console.log('Final learning insights:', finalInsights);

      // Verify that learning has occurred
      expect(finalInsights.totalLearnedEntities).toBeGreaterThanOrEqual(initialInsights.totalLearnedEntities);
    });

    it('should learn multiple entity types from single feedback', async () => {
      if (shouldSkip) {
        return;
      }
      const realTweetId = '1979041758345322688'; // Another real tweet ID
      
      const humanFeedback = {
        tweetId: realTweetId,
        originalParsed: {
          event_type: 'Unknown',
          schemes: [],
          locations: ['रायपुर'],
          generated_hashtags: ['#छत्तीसगढ़']
        },
        humanCorrection: {
          event_type: 'खेल महोत्सव',
          event_type_en: 'Sports Festival',
          event_code: 'SPORTS_FESTIVAL',
          schemes: ['खेलबो जीतबो योजना'],
          schemes_en: ['Khelbo Jeetbo Yojana'],
          locations: ['रायपुर', 'धमतरी', 'बिलासपुर'],
          generated_hashtags: ['#छत्तीसगढ़', '#खेलबो_जीतबो', '#स्पोर्ट्स']
        },
        reviewer: 'human'
      };

      const result = await learningSystem.learnFromHumanFeedback(humanFeedback);

      expect(result.success).toBe(true);
      expect(result.learnedEntities).toContain('event_type');
      expect(result.learnedEntities).toContain('scheme');
      expect(result.learnedEntities).toContain('location');
      expect(result.learnedEntities).toContain('hashtag');
      console.log('Multi-entity learning result:', result);
    });

    it('should provide contextual suggestions based on learned patterns', async () => {
      if (shouldSkip) {
        return;
      }
      // Test different contexts to see how suggestions adapt
      const contexts = [
        {
          tweetText: 'किसानों को लाभ पहुंचाने के लिए योजना',
          currentParsed: { event_type: 'Unknown', schemes: [] }
        },
        {
          tweetText: 'खेल कार्यक्रम का आयोजन',
          currentParsed: { event_type: 'Unknown', locations: ['रायपुर'] }
        },
        {
          tweetText: 'मुख्यमंत्री ने निरीक्षण किया',
          currentParsed: { event_type: 'Unknown', people: ['मुख्यमंत्री'] }
        }
      ];

      for (const context of contexts) {
        const suggestions = await learningSystem.getIntelligentSuggestions(context);
        
        expect(suggestions.eventTypes.length).toBeGreaterThan(0);
        expect(suggestions.schemes.length).toBeGreaterThan(0);
        expect(suggestions.locations.length).toBeGreaterThan(0);
        expect(suggestions.hashtags.length).toBeGreaterThan(0);
        
        console.log(`Suggestions for "${context.tweetText}":`, suggestions);
      }
    });
  });

  describe('Learning System Performance', () => {
    it('should handle multiple learning requests efficiently', async () => {
      if (shouldSkip) {
        return;
      }
      const realTweetIds = [
        '1979011985879527669',
        '1979041171952283807',
        '1979041758345322688'
      ];

      const startTime = Date.now();

      // Process multiple learning requests
      const learningPromises = realTweetIds.map((tweetId, index) => 
        learningSystem.learnFromHumanFeedback({
          tweetId,
          originalParsed: { event_type: 'Unknown' },
          humanCorrection: { 
            event_type: `Test Event ${index}`,
            event_type_en: `Test Event ${index}`,
            event_code: `TEST_${index}`
          },
          reviewer: 'human'
        })
      );

      const results = await Promise.all(learningPromises);
      const endTime = Date.now();

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      console.log(`Processed ${realTweetIds.length} learning requests in ${endTime - startTime}ms`);
    });
  });
});
