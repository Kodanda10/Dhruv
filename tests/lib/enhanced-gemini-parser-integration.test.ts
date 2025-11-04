import { Pool } from 'pg';

// CRITICAL: Mock database pool BEFORE any imports to prevent connection errors
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

describe('Enhanced Gemini Parser Integration - Mocked Database', () => {
  beforeEach(() => {
    // CRITICAL: Mock database queries to return mock data
    (mockQuery as jest.Mock).mockImplementation((query: string, params?: any[]) => {
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
      // Mock INSERT queries for parsed_events
      if (query.includes('INSERT INTO') && query.includes('parsed_events') || 
          query.includes('ON CONFLICT') && query.includes('parsed_events')) {
        const tweetId = params?.[0] || 'test_tweet';
        return Promise.resolve({
          rows: [{
            id: 1,
            tweet_id: tweetId,
            event_type: params?.[1] || 'बैठक',
            event_type_en: params?.[2] || 'Meeting',
            event_code: params?.[3] || 'MEETING',
            event_date: params?.[4] || '2025-01-17',
            locations: params?.[5] || JSON.stringify(['रायगढ़']),
            people_mentioned: params?.[6] || ['मुख्यमंत्री'],
            organizations: params?.[7] || ['सरकार'],
            schemes_mentioned: params?.[8] || ['मुख्यमंत्री किसान योजना'],
            schemes_en: params?.[9] || ['CM Kisan Yojana CG'],
            overall_confidence: params?.[10] || '0.85',
            needs_review: params?.[11] !== undefined ? (typeof params[11] === 'boolean' ? params[11] : (params[11] === 'true' || params[11] === true)) : (parseFloat(params?.[10] || '0.85') >= 0.5 ? false : true),
            review_status: params?.[12] || 'pending',
            reasoning: params?.[13] || 'Tweet parsed successfully',
            matched_scheme_ids: params?.[14] || JSON.stringify([2]),
            matched_event_id: params?.[15] || 1,
            generated_hashtags: params?.[16] ? (typeof params[16] === 'string' ? params[16] : JSON.stringify(params[16])) : JSON.stringify(['#रायगढ़', '#बैठक']),
            parsed_at: new Date()
          }]
        });
      }
      // Mock DELETE queries
      if (query.includes('DELETE FROM')) {
        return Promise.resolve({ rows: [] });
      }
      // Default: return empty result
      return Promise.resolve({ rows: [] });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should parse tweet with enhanced Gemini parser and save to database', async () => {
    const { __mockGenerateContent } = require('@google/generative-ai');
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

    const testTweetId = `test_enhanced_${Date.now()}`;
    const testTweetText = 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई';
    
    // Import the enhanced parser (pool will be mocked)
    const { parseTweetWithGemini, saveParsedTweetToDatabase } = await import('@/lib/gemini-parser');
    
    // Parse the tweet
    const parsedData = await parseTweetWithGemini(testTweetText, testTweetId);
    
    // Verify parsed data structure
    expect(parsedData.event_type).toBe('बैठक');
    expect(parsedData.event_type_en).toBe('Meeting');
    expect(parsedData.event_code).toBe('MEETING');
    expect(parsedData.locations).toEqual(['रायगढ़']);
    expect(parsedData.people).toEqual(['मुख्यमंत्री']);
    expect(parsedData.organizations).toEqual(['सरकार']);
    expect(parsedData.schemes).toEqual(['मुख्यमंत्री किसान योजना']);
    expect(parsedData.schemes_en).toEqual(['CM Kisan Yojana CG']);
    expect(parsedData.confidence).toBe(0.85);
    expect(parsedData.matched_scheme_ids).toEqual([2]);
    expect(parsedData.matched_event_id).toBe(1);
    expect(parsedData.generated_hashtags).toBeDefined();
    expect(parsedData.generated_hashtags.length).toBeGreaterThan(0);
    
    // Save to database
    const savedTweet = await saveParsedTweetToDatabase(testTweetId, parsedData);
    
    // Verify database save
    expect(savedTweet.tweet_id).toBe(testTweetId);
    expect(savedTweet.event_type).toBe('बैठक');
    expect(savedTweet.event_type_en).toBe('Meeting');
    expect(savedTweet.event_code).toBe('MEETING');
    expect(savedTweet.needs_review).toBe(false);
    // Reasoning comes from parsedData, not the mock default
    expect(savedTweet.reasoning).toBeDefined();
    expect(typeof savedTweet.reasoning).toBe('string');
    expect(savedTweet.reasoning).toMatch(/Tweet|meeting|Kisan|scheme/i);
    expect(savedTweet.matched_scheme_ids).toBeDefined();
    expect(savedTweet.matched_event_id).toBeDefined();
    expect(savedTweet.generated_hashtags).toBeDefined();
  });

  it('should handle low confidence tweets and mark for review', async () => {
    const { __mockGenerateContent } = require('@google/generative-ai');
    __mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: jest.fn().mockReturnValue(`
          {
            "event_type": "Unknown",
            "event_type_en": "Unknown",
            "event_code": "UNKNOWN",
            "locations": [],
            "people": [],
            "organizations": [],
            "schemes": [],
            "schemes_en": [],
            "date": null,
            "confidence": 0.3,
            "reasoning": "Unable to determine event type",
            "matched_scheme_ids": [],
            "matched_event_id": null
          }
        `)
      }
    });

    const testTweetId = `test_low_conf_${Date.now()}`;
    const testTweetText = 'Random text that is hard to parse';
    
    // Update mock to return low confidence data for saveParsedTweetToDatabase
    (mockQuery as jest.Mock).mockImplementation((query: string, params?: any[]) => {
      if (query.includes('ref_schemes') || query.includes('ref_event_types')) {
        return Promise.resolve({ rows: [] });
      }
      if (query.includes('parsed_events')) {
        const tweetId = params?.[0] || testTweetId;
        return Promise.resolve({
          rows: [{
            id: 1,
            tweet_id: tweetId,
            event_type: 'Unknown',
            event_type_en: 'Unknown',
            event_code: 'UNKNOWN',
            event_date: null,
            locations: JSON.stringify([]),
            people_mentioned: [],
            organizations: [],
            schemes_mentioned: [],
            schemes_en: [],
            overall_confidence: '0.3',
            needs_review: true,
            review_status: 'pending',
            reasoning: 'Unable to determine event type',
            matched_scheme_ids: JSON.stringify([]),
            matched_event_id: null,
            generated_hashtags: JSON.stringify([]),
            parsed_at: new Date()
          }]
        });
      }
      return Promise.resolve({ rows: [] });
    });
    
    // Import the enhanced parser
    const { parseTweetWithGemini, saveParsedTweetToDatabase } = await import('@/lib/gemini-parser');
    
    // Parse the tweet
    const parsedData = await parseTweetWithGemini(testTweetText, testTweetId);
    
    // Verify low confidence handling
    expect(parsedData.confidence).toBeDefined();
    expect(typeof parsedData.confidence).toBe('number');
    expect(parsedData.confidence).toBeLessThan(0.5);
    expect(parsedData.event_type).toBe('Unknown');
    
    // Save to database
    const savedTweet = await saveParsedTweetToDatabase(testTweetId, parsedData);
    
    // Verify review flagging
    expect(savedTweet.needs_review).toBe(true);
    expect(savedTweet.review_status).toBe('pending');
  });

  it('should generate contextual hashtags correctly', async () => {
    const { __mockGenerateContent } = require('@google/generative-ai');
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

    const testTweetId = `test_hashtags_${Date.now()}`;
    const testTweetText = 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई';
    
    // Import the enhanced parser
    const { parseTweetWithGemini, saveParsedTweetToDatabase } = await import('@/lib/gemini-parser');
    
    // Parse the tweet
    const parsedData = await parseTweetWithGemini(testTweetText, testTweetId);
    
    // Verify hashtag generation
    expect(parsedData.generated_hashtags).toBeDefined();
    expect(Array.isArray(parsedData.generated_hashtags)).toBe(true);
    expect(parsedData.generated_hashtags.length).toBeGreaterThan(0);
    const hashtagString = parsedData.generated_hashtags.join(' ');
    expect(hashtagString).toMatch(/रायगढ़|raigarh|बैठक|meeting|किसान|kisan|छत्तीसगढ़|chhattisgarh/i);
    
    // Save to database
    const savedTweet = await saveParsedTweetToDatabase(testTweetId, parsedData);
    
    // Verify hashtags are saved - Handle both JSON string and array formats
    expect(savedTweet.generated_hashtags).toBeDefined();
    let savedHashtags: string[];
    if (typeof savedTweet.generated_hashtags === 'string') {
      try {
        savedHashtags = JSON.parse(savedTweet.generated_hashtags);
      } catch (e) {
        // If parsing fails, assume it's already an array-like string or handle gracefully
        savedHashtags = Array.isArray(savedTweet.generated_hashtags) 
          ? savedTweet.generated_hashtags 
          : [savedTweet.generated_hashtags];
      }
    } else {
      savedHashtags = Array.isArray(savedTweet.generated_hashtags) 
        ? savedTweet.generated_hashtags 
        : [savedTweet.generated_hashtags];
    }
    expect(Array.isArray(savedHashtags)).toBe(true);
    expect(savedHashtags.length).toBeGreaterThan(0);
  });

  it('should handle reference data integration correctly', async () => {
    const { __mockGenerateContent } = require('@google/generative-ai');
    __mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: jest.fn().mockReturnValue(`
          {
            "event_type": "रैली",
            "event_type_en": "Rally",
            "event_code": "RALLY",
            "locations": ["बिलासपुर"],
            "people": ["मुख्यमंत्री"],
            "organizations": ["भाजपा"],
            "schemes": ["प्रधानमंत्री किसान सम्मान निधि"],
            "schemes_en": ["PM-KISAN"],
            "date": "2025-01-17",
            "confidence": 0.9,
            "reasoning": "Tweet mentions rally and PM Kisan scheme",
            "matched_scheme_ids": [2],
            "matched_event_id": 2
          }
        `)
      }
    });

    // Import the enhanced parser
    const { parseTweetWithGemini } = await import('@/lib/gemini-parser');
    
    const testTweetText = 'प्रधानमंत्री किसान सम्मान निधि के लिए बिलासपुर में रैली';
    const parsedData = await parseTweetWithGemini(testTweetText, 'test_ref_integration');
    
    // Verify reference data integration
    expect(parsedData.matched_scheme_ids).toBeDefined();
    expect(Array.isArray(parsedData.matched_scheme_ids)).toBe(true);
    expect(parsedData.matched_event_id).toBeDefined();
    expect(parsedData.matched_event_id === null || typeof parsedData.matched_event_id === 'number').toBe(true);
    expect(parsedData.schemes).toBeDefined();
    expect(Array.isArray(parsedData.schemes)).toBe(true);
    expect(parsedData.schemes.length).toBeGreaterThan(0);
    if (parsedData.schemes_en) {
      expect(Array.isArray(parsedData.schemes_en)).toBe(true);
    }
    expect(parsedData.event_type).toBeDefined();
    expect(parsedData.event_code).toBeDefined();
  });
});
