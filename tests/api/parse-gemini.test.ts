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

// Mock the Gemini API for testing
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn()
    })
  }))
}));

// Mock the database connection
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn()
  }))
}));

// Mock the Gemini parser module
jest.mock('@/lib/gemini-parser', () => ({
  parseTweetWithGemini: jest.fn(),
  saveParsedTweetToDatabase: jest.fn()
}));

describe('Gemini Parser Integration', () => {
  let mockParseTweetWithGemini: jest.Mock;
  let mockSaveParsedTweetToDatabase: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked functions
    const geminiParser = require('@/lib/gemini-parser');
    mockParseTweetWithGemini = geminiParser.parseTweetWithGemini as jest.Mock;
    mockSaveParsedTweetToDatabase = geminiParser.saveParsedTweetToDatabase as jest.Mock;
  });

  it('should parse tweet with Gemini API and save to database', async () => {
    // Mock parsed data from Gemini
    const mockParsedData = {
      event_type: "बैठक",
      event_type_en: "Meeting",
      event_code: "MEETING",
      locations: ["रायगढ़"],
      people: ["मुख्यमंत्री"],
      organizations: ["सरकार"],
      schemes: ["मुख्यमंत्री किसान योजना"],
      schemes_en: ["CM Kisan Yojana CG"],
      date: "2025-01-17",
      confidence: 0.85,
      reasoning: "Tweet mentions meeting and CM Kisan scheme",
      matched_scheme_ids: [5],
      matched_event_id: 1
    };

    // Mock saved tweet from database
    const mockSavedTweet = {
      id: 1,
      tweet_id: '123456789',
      event_type: 'बैठक',
      event_date: '2025-01-17',
      locations: '["रायगढ़"]',
      people_mentioned: ['मुख्यमंत्री'],
      organizations: ['सरकार'],
      schemes_mentioned: ['मुख्यमंत्री किसान योजना'],
      overall_confidence: '0.85',
      needs_review: false,
      review_status: 'pending',
      parsed_at: '2025-01-17T10:00:00Z'
    };

    // Setup mocks
    mockParseTweetWithGemini.mockResolvedValue(mockParsedData);
    mockSaveParsedTweetToDatabase.mockResolvedValue(mockSavedTweet);

    // Import the API route handler
    const { POST } = await import('@/app/api/parse/route');
    
    // Create mock request
    const request = {
      json: jest.fn().mockResolvedValue({
        tweet_id: '123456789',
        text: 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई'
      })
    } as any;

    // Call the API
    const response = await POST(request);
    const result = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.parsed_tweet).toBeDefined();
    expect(result.parsed_tweet.event_type).toBe('बैठक');
    expect(result.parsed_tweet.locations).toBe('["रायगढ़"]');
    expect(result.parsed_tweet.schemes_mentioned).toEqual(['मुख्यमंत्री किसान योजना']);
    expect(result.parsed_tweet.overall_confidence).toBe('0.85');
    expect(result.parsed_tweet.needs_review).toBe(false); // High confidence

    // Verify Gemini parser was called
    expect(mockParseTweetWithGemini).toHaveBeenCalledWith(
      'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई',
      '123456789'
    );

    // Verify database save was called
    expect(mockSaveParsedTweetToDatabase).toHaveBeenCalledWith(
      '123456789',
      mockParsedData
    );
  });

  it('should handle Gemini API errors gracefully', async () => {
    // Mock Gemini API error
    mockParseTweetWithGemini.mockRejectedValue(new Error('API rate limit exceeded'));

    // Import the API route handler
    const { POST } = await import('@/app/api/parse/route');
    
    // Create mock request
    const request = {
      json: jest.fn().mockResolvedValue({
        tweet_id: '123456789',
        text: 'Test tweet'
      })
    } as any;

    // Call the API
    const response = await POST(request);
    const result = await response.json();

    // Assertions
    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.error).toContain('API rate limit exceeded');
  });

  it('should mark low confidence tweets for review', async () => {
    // Mock parsed data with low confidence
    const mockParsedData = {
      event_type: "Unknown",
      event_type_en: "Unknown",
      event_code: "UNKNOWN",
      locations: [],
      people: [],
      organizations: [],
      schemes: [],
      schemes_en: [],
      date: null,
      confidence: 0.3,
      reasoning: "Unable to determine event type",
      matched_scheme_ids: [],
      matched_event_id: null
    };

    // Mock saved tweet from database
    const mockSavedTweet = {
      id: 1,
      tweet_id: '123456789',
      event_type: 'Unknown',
      event_date: null,
      locations: '[]',
      people_mentioned: [],
      organizations: [],
      schemes_mentioned: [],
      overall_confidence: '0.30',
      needs_review: true, // Low confidence
      review_status: 'pending',
      parsed_at: '2025-01-17T10:00:00Z'
    };

    // Setup mocks
    mockParseTweetWithGemini.mockResolvedValue(mockParsedData);
    mockSaveParsedTweetToDatabase.mockResolvedValue(mockSavedTweet);

    // Import the API route handler
    const { POST } = await import('@/app/api/parse/route');
    
    // Create mock request
    const request = {
      json: jest.fn().mockResolvedValue({
        tweet_id: '123456789',
        text: 'Random text that is hard to parse'
      })
    } as any;

    // Call the API
    const response = await POST(request);
    const result = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.parsed_tweet.needs_review).toBe(true); // Low confidence
    expect(result.parsed_tweet.overall_confidence).toBe('0.30');
  });

  it('should validate required fields', async () => {
    // Import the API route handler
    const { POST } = await import('@/app/api/parse/route');
    
    // Create mock request without tweet_id
    const request = {
      json: jest.fn().mockResolvedValue({
        text: 'Test tweet'
      })
    } as any;

    // Call the API
    const response = await POST(request);
    const result = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.error).toContain('tweet_id and text are required');
  });
});
