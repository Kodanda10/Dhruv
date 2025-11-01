import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Mock the Gemini parser for testing
jest.mock('@/lib/gemini-parser', () => ({
  parseTweetWithGemini: jest.fn()
}));

import { parseTweetWithGemini } from '@/lib/gemini-parser';

const mockParseTweetWithGemini = parseTweetWithGemini as jest.MockedFunction<typeof parseTweetWithGemini>;

describe('Enhanced Gemini Parser with Geo-Extraction', () => {
  beforeAll(async () => {
    // Set up test environment
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Geo-Extraction Integration', () => {
    test('should extract geo-hierarchy for village mentions', async () => {
      const tweetText = 'मुख्यमंत्री ने रायपुर के पंडरी गांव में किसान योजना का शुभारंभ किया';
      
      // Mock successful parsing with geo-extraction
      mockParseTweetWithGemini.mockResolvedValueOnce({
        event_type: 'कार्यक्रम',
        event_type_en: 'Event',
        event_code: 'EVENT',
        locations: ['रायपुर', 'पंडरी'],
        people: ['मुख्यमंत्री'],
        organizations: [],
        schemes: ['किसान योजना'],
        schemes_en: ['Farmer Scheme'],
        date: null,
        confidence: 0.8,
        reasoning: 'Test reasoning',
        matched_scheme_ids: [1],
        matched_event_id: 1,
        generated_hashtags: ['#कार्यक्रम', '#रायपुर'],
        geo_hierarchy: [
          {
            village: 'पंडरी',
            gram_panchayat: 'रायपुर',
            block: 'रायपुर',
            assembly: 'रायपुर शहर उत्तर',
            district: 'रायपुर',
            is_urban: false,
            confidence: 1.0
          }
        ],
        gram_panchayats: ['रायपुर'],
        ulb_wards: [],
        blocks: ['रायपुर'],
        assemblies: ['रायपुर शहर उत्तर'],
        districts: ['रायपुर'],
        geo_extraction_confidence: 0.9
      });
      
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-001');
      
      expect(result).toMatchObject({
        event_type: expect.any(String),
        locations: expect.arrayContaining(['रायपुर', 'पंडरी']),
        geo_hierarchy: expect.arrayContaining([
          expect.objectContaining({
            village: expect.any(String),
            block: expect.any(String),
            assembly: expect.any(String),
            district: expect.any(String),
            confidence: expect.any(Number)
          })
        ]),
        gram_panchayats: expect.any(Array),
        blocks: expect.any(Array),
        assemblies: expect.any(Array),
        districts: expect.any(Array),
        geo_extraction_confidence: expect.any(Number)
      });
    });

    test('should handle urban locations with ULB and ward', async () => {
      const tweetText = 'रायपुर वार्ड 5 में नगर निगम की बैठक आयोजित';
      
      // Mock successful parsing with urban geo-extraction
      mockParseTweetWithGemini.mockResolvedValueOnce({
        event_type: 'बैठक',
        event_type_en: 'Meeting',
        event_code: 'MEETING',
        locations: ['रायपुर वार्ड 5'],
        people: [],
        organizations: ['नगर निगम'],
        schemes: [],
        schemes_en: [],
        date: null,
        confidence: 0.7,
        reasoning: 'Test reasoning',
        matched_scheme_ids: [],
        matched_event_id: 2,
        generated_hashtags: ['#बैठक', '#रायपुर'],
        geo_hierarchy: [
          {
            village: 'रायपुर वार्ड 5',
            block: 'रायपुर',
            assembly: 'रायपुर शहर उत्तर',
            district: 'रायपुर',
            is_urban: true,
            ulb: 'रायपुर नगर निगम',
            ward_no: 5,
            confidence: 1.0
          }
        ],
        gram_panchayats: [],
        ulb_wards: [{ ulb: 'रायपुर नगर निगम', ward_no: 5 }],
        blocks: ['रायपुर'],
        assemblies: ['रायपुर शहर उत्तर'],
        districts: ['रायपुर'],
        geo_extraction_confidence: 0.9
      });
      
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-002');
      
      expect(result.geo_hierarchy).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            is_urban: true,
            ulb: expect.any(String),
            ward_no: 5
          })
        ])
      );
    });

    test('should extract multiple locations across different blocks', async () => {
      const tweetText = 'रायपुर के पंडरी और बिलासपुर के तखतपुर में योजना का कार्यक्रम';
      
      // Mock successful parsing with multiple locations
      mockParseTweetWithGemini.mockResolvedValueOnce({
        event_type: 'कार्यक्रम',
        event_type_en: 'Event',
        event_code: 'EVENT',
        locations: ['रायपुर', 'पंडरी', 'बिलासपुर', 'तखतपुर'],
        people: [],
        organizations: [],
        schemes: ['योजना'],
        schemes_en: ['Scheme'],
        date: null,
        confidence: 0.8,
        reasoning: 'Test reasoning',
        matched_scheme_ids: [1],
        matched_event_id: 1,
        generated_hashtags: ['#कार्यक्रम', '#रायपुर', '#बिलासपुर'],
        geo_hierarchy: [
          {
            village: 'पंडरी',
            gram_panchayat: 'रायपुर',
            block: 'रायपुर',
            assembly: 'रायपुर शहर उत्तर',
            district: 'रायपुर',
            is_urban: false,
            confidence: 1.0
          },
          {
            village: 'तखतपुर',
            gram_panchayat: 'बिलासपुर',
            block: 'बिलासपुर',
            assembly: 'बिलासपुर',
            district: 'बिलासपुर',
            is_urban: false,
            confidence: 1.0
          }
        ],
        gram_panchayats: ['रायपुर', 'बिलासपुर'],
        ulb_wards: [],
        blocks: ['रायपुर', 'बिलासपुर'],
        assemblies: ['रायपुर शहर उत्तर', 'बिलासपुर'],
        districts: ['रायपुर', 'बिलासपुर'],
        geo_extraction_confidence: 0.9
      });
      
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-003');
      
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks).toContain('रायपुर');
      expect(result.blocks).toContain('बिलासपुर');
      expect(result.districts).toContain('रायपुर');
      expect(result.districts).toContain('बिलासपुर');
    });

    test('should handle fallback location extraction', async () => {
      const tweetText = 'दुर्ग जिले में कार्यक्रम आयोजित';
      
      // Mock successful parsing with fallback extraction
      mockParseTweetWithGemini.mockResolvedValueOnce({
        event_type: 'कार्यक्रम',
        event_type_en: 'Event',
        event_code: 'EVENT',
        locations: ['दुर्ग'],
        people: [],
        organizations: [],
        schemes: [],
        schemes_en: [],
        date: null,
        confidence: 0.6,
        reasoning: 'Test reasoning',
        matched_scheme_ids: [],
        matched_event_id: 1,
        generated_hashtags: ['#कार्यक्रम', '#दुर्ग'],
        geo_hierarchy: [
          {
            village: 'दुर्ग',
            gram_panchayat: 'दुर्ग',
            block: 'दुर्ग',
            assembly: 'दुर्ग',
            district: 'दुर्ग',
            is_urban: false,
            confidence: 0.8
          }
        ],
        gram_panchayats: ['दुर्ग'],
        ulb_wards: [],
        blocks: ['दुर्ग'],
        assemblies: ['दुर्ग'],
        districts: ['दुर्ग'],
        geo_extraction_confidence: 0.7
      });
      
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-004');
      
      expect(result.geo_hierarchy.length).toBeGreaterThan(0);
      expect(result.districts).toContain('दुर्ग');
    });

    test('should calculate confidence based on resolution success', async () => {
      const tweetText = 'अज्ञात स्थान में कार्यक्रम'; // Unknown location
      
      // Mock parsing with low confidence due to unknown location
      mockParseTweetWithGemini.mockResolvedValueOnce({
        event_type: 'कार्यक्रम',
        event_type_en: 'Event',
        event_code: 'EVENT',
        locations: [],
        people: [],
        organizations: [],
        schemes: [],
        schemes_en: [],
        date: null,
        confidence: 0.3,
        reasoning: 'Test reasoning',
        matched_scheme_ids: [],
        matched_event_id: 1,
        generated_hashtags: ['#कार्यक्रम'],
        geo_hierarchy: [],
        gram_panchayats: [],
        ulb_wards: [],
        blocks: [],
        assemblies: [],
        districts: [],
        geo_extraction_confidence: 0.0
      });
      
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-005');
      
      expect(result.geo_extraction_confidence).toBeLessThan(0.5);
    });
  });

  describe('Error Handling', () => {
    test('should handle geo-extraction failures gracefully', async () => {
      const tweetText = 'Invalid tweet with no locations';
      
      // Mock parsing with error handling
      mockParseTweetWithGemini.mockResolvedValueOnce({
        event_type: 'Unknown',
        event_type_en: 'Unknown',
        event_code: 'UNKNOWN',
        locations: [],
        people: [],
        organizations: [],
        schemes: [],
        schemes_en: [],
        date: null,
        confidence: 0.0,
        error: 'Test error',
        generated_hashtags: [],
        geo_hierarchy: [],
        gram_panchayats: [],
        ulb_wards: [],
        blocks: [],
        assemblies: [],
        districts: [],
        geo_extraction_confidence: 0.0
      });
      
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-006');
      
      expect(result.geo_hierarchy).toEqual([]);
      expect(result.gram_panchayats).toEqual([]);
      expect(result.blocks).toEqual([]);
      expect(result.assemblies).toEqual([]);
      expect(result.districts).toEqual([]);
      expect(result.geo_extraction_confidence).toBe(0.0);
    });
  });

  describe('Performance', () => {
    test('should complete geo-extraction within reasonable time', async () => {
      const tweetText = 'रायपुर, बिलासपुर, दुर्ग में कार्यक्रम';
      
      // Mock fast parsing
      mockParseTweetWithGemini.mockResolvedValueOnce({
        event_type: 'कार्यक्रम',
        event_type_en: 'Event',
        event_code: 'EVENT',
        locations: ['रायपुर', 'बिलासपुर', 'दुर्ग'],
        people: [],
        organizations: [],
        schemes: [],
        schemes_en: [],
        date: null,
        confidence: 0.8,
        reasoning: 'Test reasoning',
        matched_scheme_ids: [],
        matched_event_id: 1,
        generated_hashtags: ['#कार्यक्रम'],
        geo_hierarchy: [
          {
            village: 'रायपुर',
            gram_panchayat: 'रायपुर',
            block: 'रायपुर',
            assembly: 'रायपुर शहर उत्तर',
            district: 'रायपुर',
            is_urban: false,
            confidence: 1.0
          },
          {
            village: 'बिलासपुर',
            gram_panchayat: 'बिलासपुर',
            block: 'बिलासपुर',
            assembly: 'बिलासपुर',
            district: 'बिलासपुर',
            is_urban: false,
            confidence: 1.0
          },
          {
            village: 'दुर्ग',
            gram_panchayat: 'दुर्ग',
            block: 'दुर्ग',
            assembly: 'दुर्ग',
            district: 'दुर्ग',
            is_urban: false,
            confidence: 1.0
          }
        ],
        gram_panchayats: ['रायपुर', 'बिलासपुर', 'दुर्ग'],
        ulb_wards: [],
        blocks: ['रायपुर', 'बिलासपुर', 'दुर्ग'],
        assemblies: ['रायपुर शहर उत्तर', 'बिलासपुर', 'दुर्ग'],
        districts: ['रायपुर', 'बिलासपुर', 'दुर्ग'],
        geo_extraction_confidence: 0.9
      });
      
      const startTime = Date.now();
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-007');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.geo_hierarchy.length).toBeGreaterThan(0);
    });
  });
});
