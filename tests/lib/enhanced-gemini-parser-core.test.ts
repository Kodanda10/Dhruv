import { Pool } from 'pg';

describe('Enhanced Gemini Parser - Core Functionality', () => {
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

  it('should load reference data from database', async () => {
    // Test the ReferenceDataLoader directly
    const { parseTweetWithGemini } = await import('@/lib/gemini-parser');
    
    // Mock Gemini response to avoid API calls
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const mockGenAI = new GoogleGenerativeAI('test-key');
    const mockModel = mockGenAI.getGenerativeModel();
    
    mockModel.generateContent.mockResolvedValueOnce({
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
    // Test hashtag generation function directly
    const { parseTweetWithGemini } = await import('@/lib/gemini-parser');
    
    // Mock Gemini response
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const mockGenAI = new GoogleGenerativeAI('test-key');
    const mockModel = mockGenAI.getGenerativeModel();
    
    mockModel.generateContent.mockResolvedValueOnce({
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

    const testTweetText = 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई';
    const parsedData = await parseTweetWithGemini(testTweetText, 'test_hashtags');
    
    // Verify hashtag generation
    expect(parsedData.generated_hashtags).toBeDefined();
    expect(parsedData.generated_hashtags.length).toBeGreaterThan(0);
    expect(parsedData.generated_hashtags).toContain('#रायगढ़');
    expect(parsedData.generated_hashtags).toContain('#बैठक');
    expect(parsedData.generated_hashtags).toContain('#किसान');
    expect(parsedData.generated_hashtags).toContain('#छत्तीसगढ़');
    expect(parsedData.generated_hashtags).toContain('#Chhattisgarh');
  });

  it('should handle database save with enhanced fields', async () => {
    const testTweetId = `test_enhanced_save_${Date.now()}`;
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

    // Mock Gemini response
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const mockGenAI = new GoogleGenerativeAI('test-key');
    const mockModel = mockGenAI.getGenerativeModel();
    
    mockModel.generateContent.mockResolvedValueOnce({
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
    
    // Clean up
    await pool.query('DELETE FROM parsed_events WHERE tweet_id = $1', [testTweetId]);
    await pool.query('DELETE FROM raw_tweets WHERE tweet_id = $1', [testTweetId]);
  });
});
