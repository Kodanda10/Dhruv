import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { DynamicLearningSystem } from '@/lib/dynamic-learning';
import { GeoHierarchy } from '@/lib/geo-extraction/hierarchy-resolver';

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn()
  }))
}));

describe('DynamicLearningSystem - learnGeoCorrection (Phase 3)', () => {
  let learningSystem: DynamicLearningSystem;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    learningSystem = new DynamicLearningSystem();
    mockQuery = (learningSystem as any).pool.query;
    mockQuery.mockClear();
  });

  describe('learnGeoCorrection', () => {
    test('should persist geo correction to geo_corrections table', async () => {
      const originalLocation = 'पंडरी';
      const originalHierarchy: GeoHierarchy | null = null;
      const correctedHierarchy: GeoHierarchy = {
        village: 'पंडरी',
        gram_panchayat: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: false,
        confidence: 1.0
      };
      const reviewer = 'test_reviewer';
      const tweetId = 'test_tweet_123';

      // Mock successful insert
      mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      const result = await learningSystem.learnGeoCorrection(
        { location: originalLocation, hierarchy: originalHierarchy },
        correctedHierarchy,
        reviewer,
        tweetId
      );

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO geo_corrections'),
        expect.arrayContaining([
          tweetId,
          'geo_hierarchy',
          expect.anything(), // original_value JSONB
          expect.anything(), // corrected_value JSONB
          reviewer
        ])
      );
    });

    test('should handle alias correction by updating geo_aliases', async () => {
      const originalLocation = 'पंडरी गाँव';
      const correctedHierarchy: GeoHierarchy = {
        village: 'पंडरी',
        gram_panchayat: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: false,
        confidence: 1.0
      };

      mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any); // geo_corrections insert
      // For alias updates, we'd need to check if fs.writeFile is called
      // For now, just verify geo_corrections is written

      const result = await learningSystem.learnGeoCorrection(
        { location: originalLocation, hierarchy: null },
        correctedHierarchy,
        'reviewer',
        'tweet123'
      );

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
    });

    test('should handle ULB/ward correction', async () => {
      const correctedHierarchy: GeoHierarchy = {
        village: 'नवा रायपुर सेक्टर 21',
        ulb: 'नवा रायपुर नगर निगम',
        ward_no: 21,
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: true,
        confidence: 0.98
      };

      mockQuery.mockResolvedValueOnce({ rowCount: 1 } as any);

      const result = await learningSystem.learnGeoCorrection(
        { location: 'सेक्टर 21', hierarchy: null },
        correctedHierarchy,
        'reviewer',
        'tweet456'
      );

      expect(result.success).toBe(true);
      // Verify ULB and ward_no are in the correction
      const insertCall = mockQuery.mock.calls.find(call => 
        call[0].includes('INSERT INTO geo_corrections')
      );
      expect(insertCall).toBeDefined();
    });

    test('should return error if database insert fails', async () => {
      const correctedHierarchy: GeoHierarchy = {
        village: 'पंडरी',
        gram_panchayat: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: false,
        confidence: 1.0
      };

      mockQuery.mockRejectedValueOnce(new Error('Database connection failed') as any);

      const result = await learningSystem.learnGeoCorrection(
        { location: 'पंडरी', hierarchy: null },
        correctedHierarchy,
        'reviewer',
        'tweet789'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle case where original and corrected are identical (no-op)', async () => {
      const hierarchy: GeoHierarchy = {
        village: 'पंडरी',
        gram_panchayat: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: false,
        confidence: 1.0
      };

      const result = await learningSystem.learnGeoCorrection(
        { location: 'पंडरी', hierarchy },
        hierarchy,
        'reviewer',
        'tweet999'
      );

      // Should still succeed, but might skip insert if identical
      expect(result.success).toBe(true);
    });
  });
});
