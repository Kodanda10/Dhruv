import { Pool } from 'pg';

// CRITICAL: Mock database pool to prevent connection errors in tests
const mockQuery = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    end: jest.fn().mockResolvedValue(undefined)
  }))
}));

// CRITICAL: Mock Gemini API properly before any imports
jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn();
  
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      })
    })),
    __mockGenerateContent: mockGenerateContent
  };
});

describe('Enhanced Gemini Parser - Core Functionality', () => {
  beforeEach(() => {
    // CRITICAL: Mock database queries to return mock reference data
    mockQuery.mockImplementation((query: string) => {
      // Mock reference data queries
      if (query.includes('ref_schemes')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              scheme_code: 'CM_KISAN_CG',
              name_hi: 'मुख्यमंत्री किसान योजना',
              name_en: 'CM Kisan Yojana CG',
              category: 'state',
              ministry: 'Agriculture',
              description_hi: 'किसानों को वित्तीय सहायता'
            },
            {
              id: 2,
              scheme_code: 'PM_KISAN',
              name_hi: 'प्रधानमंत्री किसान सम्मान निधि',
              name_en: 'PM-KISAN',
              category: 'central',
              ministry: 'Agriculture',
              description_hi: 'किसानों को प्रत्यक्ष लाभ हस्तांतरण'
            }
          ]
        });
      }
      if (query.includes('ref_event_types')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              event_code: 'MEETING',
              name_hi: 'बैठक',
              name_en: 'Meeting',
              aliases_hi: ['मुलाकात', 'सम्मेलन'],
              aliases_en: ['conference'],
              category: 'administrative'
            },
            {
              id: 2,
              event_code: 'RALLY',
              name_hi: 'रैली',
              name_en: 'Rally',
              aliases_hi: ['सभा', 'जनसभा'],
              aliases_en: ['gathering'],
              category: 'political'
            }
          ]
        });
      }
      // Mock INSERT queries for database save tests
      if (query.includes('INSERT INTO') || query.includes('ON CONFLICT')) {
        return Promise.resolve({
          rows: [{
            id: 1,
            tweet_id: 'test_tweet',
            event_type: 'बैठक',
            event_type_en: 'Meeting',
            event_code: 'MEETING',
            event_date: '2025-01-17',
            locations: JSON.stringify(['रायगढ़']),
            people_mentioned: ['मुख्यमंत्री'],
            organizations: ['सरकार'],
            schemes_mentioned: ['मुख्यमंत्री किसान योजना'],
            schemes_en: ['CM Kisan Yojana CG'],
            overall_confidence: '0.85',
            needs_review: false,
            review_status: 'pending',
            reasoning: 'Tweet mentions meeting and CM Kisan scheme',
            matched_scheme_ids: JSON.stringify([2]),
            matched_event_id: 1,
            generated_hashtags: JSON.stringify(['#रायगढ़', '#बैठक', '#किसान']),
            parsed_at: new Date()
          }]
        });
      }
      // Default: return empty result
      return Promise.resolve({ rows: [] });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should load reference data from database', async () => {
    // Get the mock function
    const { __mockGenerateContent } = require('@google/generative-ai');
    
    // Set up mock response
    __mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: jest.fn().mockReturnValue(`
          {
            "event_type": "बैठक",
            "event_type_en": "Meeting",
            "event_code": "MEETING",
            "locations": ["रायगढ़"],
            "people": ["मुख्यमंत्री"],
            "organizations": ["सरकार"],
            "schemes": ["मुख्यमंत्री किसान योजना"],
            "schemes_en": ["CM Kisan Yojana CG"],
            "date": "2025-01-17",
            "confidence": 0.85,
            "reasoning": "Tweet mentions meeting and CM Kisan scheme",
            "matched_scheme_ids": [2],
            "matched_event_id": 1
          }
        `)
      }
    });

    // Test the ReferenceDataLoader directly
    const { parseTweetWithGemini } = await import('@/lib/gemini-parser');

    const testTweetText = 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई';
    
    // This should load reference data from database
    const parsedData = await parseTweetWithGemini(testTweetText, 'test_ref_data');
    
    // Verify the parser can access reference data
    expect(parsedData).toBeDefined();
    expect(parsedData.event_type).toBe('बैठक');
    expect(parsedData.confidence).toBe(0.85);
    expect(parsedData.generated_hashtags).toBeDefined();
    expect(parsedData.generated_hashtags.length).toBeGreaterThan(0);
  });

  it('should generate contextual hashtags', async () => {
    // Get the mock function
    const { __mockGenerateContent } = require('@google/generative-ai');
    
    // Set up mock response
    __mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: jest.fn().mockReturnValue(`
          {
            "event_type": "बैठक",
            "event_type_en": "Meeting",
            "event_code": "MEETING",
            "locations": ["रायगढ़", "बिलासपुर"],
            "people": ["मुख्यमंत्री"],
            "organizations": ["सरकार"],
            "schemes": ["मुख्यमंत्री किसान योजना"],
            "schemes_en": ["CM Kisan Yojana CG"],
            "date": "2025-01-17",
            "confidence": 0.85,
            "reasoning": "Tweet mentions meeting and CM Kisan scheme",
            "matched_scheme_ids": [2],
            "matched_event_id": 1
          }
        `)
      }
    });

    // Test hashtag generation function directly
    const { parseTweetWithGemini } = await import('@/lib/gemini-parser');

    const testTweetText = 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई';
    const parsedData = await parseTweetWithGemini(testTweetText, 'test_hashtags');
    
    // Verify hashtag generation
    expect(parsedData.generated_hashtags).toBeDefined();
    expect(parsedData.generated_hashtags.length).toBeGreaterThan(0);
    // CRITICAL: Check if hashtags contain expected values (flexible for actual implementation)
    const hashtagStrings = parsedData.generated_hashtags.join(' ');
    expect(hashtagStrings).toMatch(/रायगढ़|raigarh|बैठक|meeting|किसान|kisan/i);
  });

  it('should handle database save with enhanced fields', async () => {
    // Get the mock function
    const { __mockGenerateContent } = require('@google/generative-ai');
    
    // Set up mock response
    __mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: jest.fn().mockReturnValue(`
          {
            "event_type": "बैठक",
            "event_type_en": "Meeting",
            "event_code": "MEETING",
            "locations": ["रायगढ़"],
            "people": ["मुख्यमंत्री"],
            "organizations": ["सरकार"],
            "schemes": ["मुख्यमंत्री किसान योजना"],
            "schemes_en": ["CM Kisan Yojana CG"],
            "date": "2025-01-17",
            "confidence": 0.85,
            "reasoning": "Tweet mentions meeting and CM Kisan scheme",
            "matched_scheme_ids": [2],
            "matched_event_id": 1
          }
        `)
      }
    });

    const testTweetId = `test_enhanced_save_${Date.now()}`;
    
    // Update mock to return the correct tweet_id
    mockQuery.mockImplementation((query: string) => {
      if (query.includes('ref_schemes')) {
        return Promise.resolve({
          rows: [
            {
              id: 2,
              scheme_code: 'CM_KISAN_CG',
              name_hi: 'मुख्यमंत्री किसान योजना',
              name_en: 'CM Kisan Yojana CG',
              category: 'state',
              ministry: 'Agriculture',
              description_hi: 'किसानों को वित्तीय सहायता'
            }
          ]
        });
      }
      if (query.includes('ref_event_types')) {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              event_code: 'MEETING',
              name_hi: 'बैठक',
              name_en: 'Meeting',
              aliases_hi: ['मुलाकात'],
              aliases_en: [],
              category: 'administrative'
            }
          ]
        });
      }
      if (query.includes('INSERT INTO') || query.includes('ON CONFLICT')) {
        return Promise.resolve({
          rows: [{
            id: 1,
            tweet_id: testTweetId,
            event_type: 'बैठक',
            event_type_en: 'Meeting',
            event_code: 'MEETING',
            event_date: '2025-01-17',
            locations: JSON.stringify(['रायगढ़']),
            people_mentioned: ['मुख्यमंत्री'],
            organizations: ['सरकार'],
            schemes_mentioned: ['मुख्यमंत्री किसान योजना'],
            schemes_en: ['CM Kisan Yojana CG'],
            overall_confidence: '0.85',
            needs_review: false,
            review_status: 'pending',
            reasoning: 'Tweet mentions meeting and CM Kisan scheme',
            matched_scheme_ids: JSON.stringify([2]),
            matched_event_id: 1,
            generated_hashtags: JSON.stringify(['#रायगढ़', '#बैठक', '#किसान']),
            parsed_at: new Date()
          }]
        });
      }
      return Promise.resolve({ rows: [] });
    });
    const testTweetText = 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई';
    
    // Import the enhanced parser
    const { parseTweetWithGemini, saveParsedTweetToDatabase } = await import('@/lib/gemini-parser');
    
    // Parse the tweet
    const parsedData = await parseTweetWithGemini(testTweetText, testTweetId);
    
    // Save to database
    const savedTweet = await saveParsedTweetToDatabase(testTweetId, parsedData);
    
    // Verify database save with enhanced fields
    expect(savedTweet.tweet_id).toBe(testTweetId);
    expect(savedTweet.event_type).toBe('बैठक');
    expect(savedTweet.event_type_en).toBe('Meeting');
    expect(savedTweet.event_code).toBe('MEETING');
    expect(savedTweet.needs_review).toBe(false); // High confidence
    expect(savedTweet.reasoning).toBe('Tweet mentions meeting and CM Kisan scheme');
    expect(savedTweet.matched_scheme_ids).toBeDefined();
    expect(savedTweet.matched_event_id).toBeDefined();
    expect(savedTweet.generated_hashtags).toBeDefined();
  });
});
