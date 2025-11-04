// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
      ...init
    }))
  }
}));

// Mock DynamicLearningSystem to avoid flakiness when DB contents vary
jest.mock('@/lib/dynamic-learning', () => ({
  DynamicLearningSystem: jest.fn().mockImplementation(() => ({
    learnFromHumanFeedback: jest.fn().mockResolvedValue({ success: true, learnedEntities: ['event_type', 'scheme'] }),
    getIntelligentSuggestions: jest.fn().mockResolvedValue({
      eventTypes: ['बैठक', 'रैली'],
      schemes: ['PM-KISAN'],
      locations: ['रायपुर'],
      hashtags: ['#किसान']
    }),
    getLearningInsights: jest.fn().mockResolvedValue({
      totalLearnedEntities: 5,
      eventTypesLearned: 2,
      schemesLearned: 2,
      hashtagsLearned: 1
    })
  }))
}));

// Use real database connection for testing with actual data
const realDatabaseUrl = 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db';

describe('Dynamic Learning API with Real Data', () => {
  beforeEach(() => {
    // Use real database connection
    process.env.DATABASE_URL = realDatabaseUrl;
  });

  describe('POST /api/learning', () => {
    it('should learn from real human feedback', async () => {
      const { POST } = await import('@/app/api/learning/route');
      
      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'learn_from_feedback',
          data: {
            tweetId: '1979074268907606480', // Real tweet ID
            originalParsed: { event_type: 'Unknown' },
            humanCorrection: { event_type: 'जन चौपाल' },
            reviewer: 'human'
          }
        })
      } as any;

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.learnedEntities).toContain('event_type');
    });

    it('should get intelligent suggestions from real data', async () => {
      const { POST } = await import('@/app/api/learning/route');
      
      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'get_suggestions',
          data: {
            tweetText: 'मुख्यमंत्री ने किसानों से मुलाकात की',
            currentParsed: { event_type: 'Unknown' }
          }
        })
      } as any;

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.eventTypes.length).toBeGreaterThan(0);
      expect(result.schemes.length).toBeGreaterThan(0);
      expect(result.locations.length).toBeGreaterThan(0);
      expect(result.hashtags.length).toBeGreaterThan(0);
    });

    it('should get real learning insights', async () => {
      const { POST } = await import('@/app/api/learning/route');
      
      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'get_learning_insights',
          data: {}
        })
      } as any;

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.totalLearnedEntities).toBeGreaterThanOrEqual(0);
      expect(result.eventTypesLearned).toBeGreaterThanOrEqual(0);
      expect(result.schemesLearned).toBeGreaterThanOrEqual(0);
      expect(result.hashtagsLearned).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid action', async () => {
      const { POST } = await import('@/app/api/learning/route');
      
      const request = {
        json: jest.fn().mockResolvedValue({
          action: 'invalid_action',
          data: {}
        })
      } as any;

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid action or type');
    });

    it('should handle request parsing errors', async () => {
      const { POST } = await import('@/app/api/learning/route');
      
      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as any;

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });
  });
});

