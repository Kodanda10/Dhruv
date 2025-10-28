import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { GeoHierarchyResolver, GeoHierarchy } from '@/lib/geo-extraction/hierarchy-resolver';

describe('GeoHierarchyResolver', () => {
  let resolver: GeoHierarchyResolver;
  
  beforeAll(async () => {
    resolver = new GeoHierarchyResolver();
    await resolver.initialize();
  });
  
  afterAll(async () => {
    await resolver.cleanup();
  });
  
  describe('Scenario Group 1: Valid Locations', () => {
    test('should resolve single village mention', async () => {
      const result = await resolver.resolveVillage('पंडरी');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        village: 'पंडरी',
        gram_panchayat: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: false,
        confidence: expect.any(Number)
      });
      expect(result[0].confidence).toBeGreaterThan(0.8);
    });
    
    test('should resolve multiple villages in same block', async () => {
      const villages = ['पंडरी', 'कोटा', 'महासमुंद'];
      const results = await Promise.all(
        villages.map(village => resolver.resolveVillage(village))
      );
      
      // All should be in same block and assembly
      const firstResult = results[0][0];
      results.forEach(result => {
        expect(result[0].block).toBe(firstResult.block);
        expect(result[0].assembly).toBe(firstResult.assembly);
        expect(result[0].district).toBe(firstResult.district);
      });
    });
    
    test('should resolve villages across different blocks', async () => {
      const result1 = await resolver.resolveVillage('पंडरी'); // रायपुर block
      const result2 = await resolver.resolveVillage('तखतपुर'); // बिलासपुर block (different block)
      
      expect(result1[0].block).not.toBe(result2[0].block);
      expect(result1[0].assembly).not.toBe(result2[0].assembly); // Different assemblies
    });
    
    test('should handle urban locations with ULB and ward', async () => {
      const result = await resolver.resolveVillage('रायपुर');
      
      expect(result[0]).toMatchObject({
        village: 'रायपुर',
        is_urban: true,
        ulb: expect.any(String),
        ward_no: expect.any(Number)
      });
    });
  });
  
  describe('Scenario Group 2: Ambiguous Names', () => {
    test('should handle villages with same name in different blocks', async () => {
      const result = await resolver.resolveAmbiguousLocation('रायपुर', 'रायपुर शहर उत्तर');
      
      expect(result).toMatchObject({
        village: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        confidence: expect.any(Number)
      });
    });
    
    test('should use context for disambiguation', async () => {
      const result = await resolver.resolveAmbiguousLocation('रायपुर', 'पंडरी के पास');
      
      // Should prefer the village near पंडरी
      expect(result.village).toBe('रायपुर');
      expect(result.block).toBe('रायपुर'); // Same block as पंडरी
    });
    
    test('should handle Hindi/English spelling variations', async () => {
      const hindiResult = await resolver.resolveVillage('रायपुर');
      const englishResult = await resolver.resolveVillage('Raipur');
      
      expect(hindiResult[0].village).toBe(englishResult[0].village);
      expect(hindiResult[0].district).toBe(englishResult[0].district);
    });
    
    test('should handle partial names requiring context', async () => {
      const result = await resolver.resolveAmbiguousLocation('राय', 'रायपुर जिले में');
      
      expect(result.village).toBe('रायपुर');
      expect(result.district).toBe('रायपुर');
    });
  });
  
  describe('Scenario Group 3: Edge Cases', () => {
    test('should handle tweets with 5+ villages mentioned', async () => {
      const villages = ['पंडरी', 'कोटा', 'महासमुंद', 'अरंग', 'धरसीवाँ', 'खैरगढ़'];
      const startTime = Date.now();
      
      const results = await Promise.all(
        villages.map(village => resolver.resolveVillage(village))
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(6);
      expect(results.every(result => result.length > 0)).toBe(true);
      expect(duration).toBeLessThan(300); // < 300ms for 6 villages
    });
    
    test('should handle only block/district mentioned (no village)', async () => {
      const result = await resolver.resolveAmbiguousLocation('रायपुर ब्लॉक', '');
      
      expect(result).toMatchObject({
        block: 'रायपुर',
        district: 'रायपुर',
        confidence: expect.any(Number)
      });
    });
    
    test('should handle invalid/non-existent village names', async () => {
      const result = await resolver.resolveVillage('अस्तित्वहीन_गाँव');
      
      expect(result).toHaveLength(0);
    });
    
    test('should handle mixed Hindi/English/transliteration', async () => {
      const variations = ['रायपुर', 'Raipur', 'raipur', 'रायपूर'];
      const results = await Promise.all(
        variations.map(variation => resolver.resolveVillage(variation))
      );
      
      // All should resolve to same location
      const firstVillage = results[0][0]?.village;
      results.forEach(result => {
        if (result.length > 0) {
          expect(result[0].village).toBe(firstVillage);
        }
      });
    });
  });
  
  describe('Scenario Group 4: Urban Locations', () => {
    test('should resolve ULB with ward number', async () => {
      const result = await resolver.resolveVillage('रायपुर वार्ड 5');
      
      expect(result[0]).toMatchObject({
        is_urban: true,
        ulb: expect.any(String),
        ward_no: 5
      });
    });
    
    test('should resolve ULB without ward (resolve to all wards)', async () => {
      const result = await resolver.resolveVillage('रायपुर नगर निगम');
      
      expect(result[0]).toMatchObject({
        is_urban: true,
        ulb: 'रायपुर नगर निगम',
        ward_no: expect.any(Number)
      });
    });
    
    test('should handle mix of ULB and village names', async () => {
      const urbanResult = await resolver.resolveVillage('रायपुर');
      const ruralResult = await resolver.resolveVillage('पंडरी');
      
      expect(urbanResult[0].is_urban).toBe(true);
      expect(ruralResult[0].is_urban).toBe(false);
    });
  });
  
  describe('Scenario Group 5: Complex Hierarchies', () => {
    test('should handle villages spanning multiple GPs', async () => {
      const result = await resolver.resolveVillage('तिल्दा');
      
      expect(result[0]).toMatchObject({
        village: 'तिल्दा',
        gram_panchayat: 'तिल्दा',
        block: expect.any(String),
        assembly: expect.any(String),
        district: expect.any(String)
      });
    });
    
    test('should handle assembly boundary changes', async () => {
      // Test villages that might be in different assemblies
      const result1 = await resolver.resolveVillage('पंडरी');
      const result2 = await resolver.resolveVillage('तिल्दा');
      
      // Both should have valid assembly assignments
      expect(result1[0].assembly).toBeTruthy();
      expect(result2[0].assembly).toBeTruthy();
    });
  });
  
  describe('Performance Tests', () => {
    test('single village lookup should be < 50ms', async () => {
      const startTime = Date.now();
      await resolver.resolveVillage('पंडरी');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(50);
    });
    
    test('fuzzy matching should be < 100ms per name', async () => {
      const startTime = Date.now();
      await resolver.fuzzyMatch('राय');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100);
    });
    
    test('ambiguous resolution should be < 200ms', async () => {
      const startTime = Date.now();
      await resolver.resolveAmbiguousLocation('रायपुर', 'रायपुर शहर उत्तर');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(200);
    });
  });
  
  describe('Error Handling', () => {
    test('should handle empty input gracefully', async () => {
      const result = await resolver.resolveVillage('');
      expect(result).toHaveLength(0);
    });
    
    test('should handle null/undefined input', async () => {
      const result1 = await resolver.resolveVillage(null as any);
      const result2 = await resolver.resolveVillage(undefined as any);
      
      expect(result1).toHaveLength(0);
      expect(result2).toHaveLength(0);
    });
    
    test('should handle malformed geography data', async () => {
      // This test would require mocking corrupted data
      // For now, just ensure the resolver doesn't crash
      const result = await resolver.resolveVillage('test');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
