import { Pool } from 'pg';

// Mock the Gemini API
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
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
      })
    })
  }))
}));

describe('Enhanced Gemini Parser Integration - Real Database', () => {
  let pool: Pool;

  beforeAll(() => {
    // Use real database connection for integration testing
    pool = new Pool({
      connectionString: 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db'
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should parse tweet with enhanced Gemini parser and save to database', async () => {
    const testTweetId = `test_enhanced_${Date.now()}`;
    const testTweetText = 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई';
    
    // First insert a raw tweet
    await pool.query(`
      INSERT INTO raw_tweets (tweet_id, text, created_at, author_handle, retweet_count, reply_count, like_count, quote_count, hashtags, mentions, urls)
      VALUES ($1, $2, NOW(), $3, 0, 0, 0, 0, $4, $5, $6)
    `, [
      testTweetId,
      testTweetText,
      'test_user',
      [],
      [],
      []
    ]);

    // Import the enhanced parser
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
    expect(savedTweet.needs_review).toBe(false); // High confidence
    expect(savedTweet.reasoning).toBe('Tweet mentions meeting and CM Kisan scheme');
    
    // Clean up
    await pool.query('DELETE FROM parsed_events WHERE tweet_id = $1', [testTweetId]);
    await pool.query('DELETE FROM raw_tweets WHERE tweet_id = $1', [testTweetId]);
  });

  it('should handle low confidence tweets and mark for review', async () => {
    const testTweetId = `test_low_conf_${Date.now()}`;
    const testTweetText = 'Random text that is hard to parse';
    
    // Mock low confidence response
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const mockGenAI = new GoogleGenerativeAI('test-key');
    const mockModel = mockGenAI.getGenerativeModel();
    
    mockModel.generateContent.mockResolvedValueOnce({
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

    // First insert a raw tweet
    await pool.query(`
      INSERT INTO raw_tweets (tweet_id, text, created_at, author_handle, retweet_count, reply_count, like_count, quote_count, hashtags, mentions, urls)
      VALUES ($1, $2, NOW(), $3, 0, 0, 0, 0, $4, $5, $6)
    `, [
      testTweetId,
      testTweetText,
      'test_user',
      [],
      [],
      []
    ]);

    // Import the enhanced parser
    const { parseTweetWithGemini, saveParsedTweetToDatabase } = await import('@/lib/gemini-parser');
    
    // Parse the tweet
    const parsedData = await parseTweetWithGemini(testTweetText, testTweetId);
    
    // Verify low confidence handling
    expect(parsedData.confidence).toBe(0.3);
    expect(parsedData.event_type).toBe('Unknown');
    
    // Save to database
    const savedTweet = await saveParsedTweetToDatabase(testTweetId, parsedData);
    
    // Verify review flagging
    expect(savedTweet.needs_review).toBe(true); // Low confidence
    expect(savedTweet.review_status).toBe('pending');
    
    // Clean up
    await pool.query('DELETE FROM parsed_events WHERE tweet_id = $1', [testTweetId]);
    await pool.query('DELETE FROM raw_tweets WHERE tweet_id = $1', [testTweetId]);
  });

  it('should generate contextual hashtags correctly', async () => {
    const testTweetId = `test_hashtags_${Date.now()}`;
    const testTweetText = 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई';
    
    // First insert a raw tweet
    await pool.query(`
      INSERT INTO raw_tweets (tweet_id, text, created_at, author_handle, retweet_count, reply_count, like_count, quote_count, hashtags, mentions, urls)
      VALUES ($1, $2, NOW(), $3, 0, 0, 0, 0, $4, $5, $6)
    `, [
      testTweetId,
      testTweetText,
      'test_user',
      [],
      [],
      []
    ]);

    // Import the enhanced parser
    const { parseTweetWithGemini, saveParsedTweetToDatabase } = await import('@/lib/gemini-parser');
    
    // Parse the tweet
    const parsedData = await parseTweetWithGemini(testTweetText, testTweetId);
    
    // Verify hashtag generation
    expect(parsedData.generated_hashtags).toBeDefined();
    expect(parsedData.generated_hashtags.length).toBeGreaterThan(0);
    expect(parsedData.generated_hashtags).toContain('#रायगढ़');
    expect(parsedData.generated_hashtags).toContain('#बैठक');
    expect(parsedData.generated_hashtags).toContain('#किसान');
    expect(parsedData.generated_hashtags).toContain('#छत्तीसगढ़');
    expect(parsedData.generated_hashtags).toContain('#Chhattisgarh');
    
    // Save to database
    const savedTweet = await saveParsedTweetToDatabase(testTweetId, parsedData);
    
    // Verify hashtags are saved
    expect(savedTweet.generated_hashtags).toBeDefined();
    const savedHashtags = JSON.parse(savedTweet.generated_hashtags);
    expect(savedHashtags).toContain('#रायगढ़');
    expect(savedHashtags).toContain('#बैठक');
    
    // Clean up
    await pool.query('DELETE FROM parsed_events WHERE tweet_id = $1', [testTweetId]);
    await pool.query('DELETE FROM raw_tweets WHERE tweet_id = $1', [testTweetId]);
  });

  it('should handle reference data integration correctly', async () => {
    // Test that the parser can access reference data
    const { parseTweetWithGemini } = await import('@/lib/gemini-parser');
    
    // Mock a response that shows reference data integration
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const mockGenAI = new GoogleGenerativeAI('test-key');
    const mockModel = mockGenAI.getGenerativeModel();
    
    mockModel.generateContent.mockResolvedValueOnce({
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

    const testTweetText = 'प्रधानमंत्री किसान सम्मान निधि के लिए बिलासपुर में रैली';
    const parsedData = await parseTweetWithGemini(testTweetText, 'test_ref_integration');
    
    // Verify reference data integration
    // Note: matched_event_id may be overridden by matchEventType if it finds a different event
    // The mock returns matched_event_id: 2, but matchEventType may return a different ID
    expect(parsedData.matched_scheme_ids).toEqual([2]); // CM_KISAN_CG is ID 2
    expect(parsedData.matched_event_id).toBeDefined(); // Should be set (either from mock or matchEventType)
    expect(typeof parsedData.matched_event_id).toBe('number');
    expect(parsedData.schemes).toEqual(['प्रधानमंत्री किसान सम्मान निधि']);
    expect(parsedData.schemes_en).toEqual(['PM-KISAN']);
    expect(parsedData.event_type).toBe('रैली');
    expect(parsedData.event_code).toBe('RALLY');
  });
});
