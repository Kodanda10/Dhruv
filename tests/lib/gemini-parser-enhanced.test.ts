/**
 * @jest-environment node
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { parseTweetWithGemini } from '@/lib/gemini-parser';

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
      
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-003');
      
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks).toContain('रायपुर');
      expect(result.blocks).toContain('बिलासपुर');
      expect(result.districts).toContain('रायपुर');
      expect(result.districts).toContain('बिलासपुर');
    });

    test('should handle fallback location extraction', async () => {
      const tweetText = 'दुर्ग जिले में कार्यक्रम आयोजित';
      
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-004');
      
      expect(result.geo_hierarchy.length).toBeGreaterThan(0);
      expect(result.districts).toContain('दुर्ग');
    });

    test('should calculate confidence based on resolution success', async () => {
      const tweetText = 'अज्ञात स्थान में कार्यक्रम'; // Unknown location
      
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-005');
      
      expect(result.geo_extraction_confidence).toBeLessThan(0.5);
    });
  });

  describe('Error Handling', () => {
    test('should handle geo-extraction failures gracefully', async () => {
      const tweetText = 'Invalid tweet with no locations';
      
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
      
      const startTime = Date.now();
      const result = await parseTweetWithGemini(tweetText, 'test-tweet-007');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.geo_hierarchy.length).toBeGreaterThan(0);
    });
  });
});
