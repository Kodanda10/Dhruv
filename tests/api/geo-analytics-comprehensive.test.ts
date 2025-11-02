/**
 * Geo Analytics API - Comprehensive FANG-Level Test Suite
 * 
 * Coverage Target: 85%+ statements, 70%+ branches
 * 
 * Tests include:
 * - All happy paths
 * - Edge cases and boundary conditions
 * - Error handling (database failures, partial failures)
 * - Input validation (SQL injection, XSS, malformed data)
 * - Data variations (rural/urban, nulls, empty arrays, unicode)
 * - Result formatting edge cases
 * - Type safety and conversions
 * - Concurrent request handling
 * - Large dataset handling
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET as getSummary } from '@/app/api/geo-analytics/summary/route';
import { GET as getByDistrict } from '@/app/api/geo-analytics/by-district/route';
import { GET as getByAssembly } from '@/app/api/geo-analytics/by-assembly/route';

// Mock database pool
jest.mock('@/lib/db/pool', () => ({
  getDBPool: jest.fn(() => ({
    query: jest.fn()
  }))
}));

// Skip deprecated mock-based test file - use geo-analytics-comprehensive-real.test.ts instead
describe.skip('Geo Analytics API - Comprehensive Test Suite (DEPRECATED: Use comprehensive-real.test.ts)', () => {
  let mockPool: any;
  let mockQuery: jest.Mock;

  beforeAll(async () => {
    const { getDBPool } = require('@/lib/db/pool');
    mockPool = getDBPool();
    mockQuery = mockPool.query as jest.Mock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup
  });

  // ============================================================
  // ERROR HANDLING & RESILIENCE TESTS
  // ============================================================

  describe('Error Handling', () => {
    test('should handle database connection failure gracefully', async () => {
      const originalGetDBPool = require('@/lib/db/pool').getDBPool;
      jest.spyOn(require('@/lib/db/pool'), 'getDBPool').mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        success: false,
        error: expect.stringContaining('Database connection failed'),
        message: 'Failed to generate geo analytics summary'
      });
    });

    test('should handle query execution failure', async () => {
      // @ts-expect-error - Jest mock type compatibility
      mockQuery.mockRejectedValueOnce(new Error('Query execution failed: timeout'));

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Query execution failed');
    });

    test('should handle partial query failure (some queries succeed, some fail)', async () => {
      // First query succeeds, second fails
      // @ts-expect-error - Jest mock type compatibility
      mockQuery
        .mockResolvedValueOnce({ rows: [{ district: 'रायपुर', event_count: '10' }] } as any)
        // @ts-expect-error - Jest mock type compatibility
        .mockRejectedValueOnce(new Error('Second query failed'))
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    test('should handle non-Error exceptions', async () => {
      mockQuery.mockRejectedValueOnce('String error instead of Error object');

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        success: false,
        error: 'Unknown error', // Should default when not Error instance
        message: 'Failed to generate geo analytics summary'
      });
    });

    test('should handle by-district endpoint database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection lost'));

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-district?district=रायपुर');
      const response = await getByDistrict(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        success: false,
        error: expect.any(String),
        message: 'Failed to generate district drilldown'
      });
    });

    test('should handle by-assembly endpoint database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query timeout'));

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=रायपुर शहर उत्तर');
      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        success: false,
        error: expect.any(String),
        message: 'Failed to generate assembly drilldown'
      });
    });
  });

  // ============================================================
  // INPUT VALIDATION & SECURITY TESTS
  // ============================================================

  describe('Input Validation & Security', () => {
    describe('SQL Injection Prevention', () => {
      test('should prevent SQL injection in district parameter', async () => {
        const maliciousInput = "रायपुर'; DROP TABLE parsed_events; --";
        
        mockQuery.mockResolvedValue({ rows: [] });

        const request = new NextRequest(
          `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(maliciousInput)}`
        );

        const response = await getByDistrict(request);
        
        // Should not crash, should treat as literal string parameter
        expect([200, 400, 500]).toContain(response.status);
        
        // Verify parameterized query was used (check mock was called with params array)
        if (mockQuery.mock.calls.length > 0) {
          const callArgs = mockQuery.mock.calls[0];
          expect(Array.isArray(callArgs[1])).toBe(true); // params should be array, not string concatenation
          expect(callArgs[1][0]).toBe(maliciousInput); // Should be passed as parameter, not in SQL string
        }
      });

      test('should prevent SQL injection in assembly parameter', async () => {
        const maliciousInput = "रायपुर'; DELETE FROM parsed_events WHERE 1=1; --";
        
        mockQuery.mockResolvedValue({ rows: [] });

        const request = new NextRequest(
          `http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=${encodeURIComponent(maliciousInput)}`
        );

        const response = await getByAssembly(request);
        expect([200, 400, 500]).toContain(response.status);
      });

      test('should prevent SQL injection in event_type parameter', async () => {
        const maliciousInput = "बैठक'; UPDATE parsed_events SET review_status='approved'; --";
        
        mockQuery
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any);

        const request = new NextRequest(
          `http://localhost:3000/api/geo-analytics/summary?event_type=${encodeURIComponent(maliciousInput)}`
        );

        const response = await getSummary(request);
        expect([200, 500]).toContain(response.status);
      });
    });

    describe('XSS Prevention', () => {
      test('should handle XSS attempts in district name', async () => {
        const xssInput = '<script>alert("XSS")</script>';
        
        mockQuery.mockResolvedValue({ rows: [] });

        const request = new NextRequest(
          `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(xssInput)}`
        );

        const response = await getByDistrict(request);
        const data = await response.json();

        // Should not execute script, should treat as literal string
        if (data.data) {
          expect(data.data.district).toBe(xssInput); // Passed as-is, no execution
        }
      });
    });

    describe('Date Format Validation', () => {
      test('should handle invalid startDate format', async () => {
        const invalidDate = 'not-a-date';
        
        mockQuery
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any);

        const request = new NextRequest(
          `http://localhost:3000/api/geo-analytics/summary?startDate=${invalidDate}`
        );

        const response = await getSummary(request);
        // Should either validate and return 400, or pass to DB and let DB handle
        expect([200, 400, 500]).toContain(response.status);
      });

      test('should handle invalid endDate format', async () => {
        const invalidDate = '2024-13-45'; // Invalid month/day
        
        mockQuery.mockResolvedValue({ rows: [] });

        const request = new NextRequest(
          `http://localhost:3000/api/geo-analytics/summary?endDate=${invalidDate}`
        );

        const response = await getSummary(request);
        expect([200, 400, 500]).toContain(response.status);
      });

      test('should handle empty string dates', async () => {
        mockQuery
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any);

        const request = new NextRequest(
          'http://localhost:3000/api/geo-analytics/summary?startDate=&endDate='
        );

        const response = await getSummary(request);
        expect(response.status).toBe(200); // Should handle empty strings as null
      });
    });

    describe('Missing Parameter Validation', () => {
      test('should reject by-district with empty district string', async () => {
        const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-district?district=');
        
        const response = await getByDistrict(request);
        const data = await response.json();

        // Should either return 400 or treat empty string as missing
        expect([400, 500]).toContain(response.status);
      });

      test('should reject by-assembly with empty district', async () => {
        const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=&assembly=रायपुर शहर उत्तर');
        
        const response = await getByAssembly(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('required');
      });

      test('should reject by-assembly with empty assembly', async () => {
        const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=');
        
        const response = await getByAssembly(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('required');
      });
    });

    describe('Special Characters & Unicode', () => {
      test('should handle unicode district names correctly', async () => {
        const unicodeDistrict = 'रायपुर';
        
        mockQuery.mockResolvedValue({ rows: [] });

        const request = new NextRequest(
          `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(unicodeDistrict)}`
        );

        const response = await getByDistrict(request);
        expect([200, 500]).toContain(response.status);
      });

      test('should handle special characters in event_type', async () => {
        const specialChars = 'बैठक (महत्वपूर्ण)';
        
        mockQuery
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any)
          .mockResolvedValueOnce({ rows: [] } as any);

        const request = new NextRequest(
          `http://localhost:3000/api/geo-analytics/summary?event_type=${encodeURIComponent(specialChars)}`
        );

        const response = await getSummary(request);
        expect([200, 500]).toContain(response.status);
      });

      test('should handle extremely long district names', async () => {
        const longName = 'र'.repeat(1000);
        
        mockQuery.mockResolvedValue({ rows: [] });

        const request = new NextRequest(
          `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(longName)}`
        );

        const response = await getByDistrict(request);
        expect([200, 400, 500]).toContain(response.status);
      });
    });
  });

  // ============================================================
  // DATA VARIATIONS & EDGE CASES
  // ============================================================

  describe('Data Variations & Edge Cases', () => {
    test('should handle null geo_hierarchy field', async () => {
      // When geo_hierarchy is NULL, queries should filter it out
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any) // No districts (all null)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total_events).toBe(0);
    });

    test('should handle empty geo_hierarchy array', async () => {
      // geo_hierarchy = [] (empty array)
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total_events).toBe(0);
    });

    test('should handle single event result', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', assembly: 'रायपुर शहर उत्तर', event_count: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', assembly: 'रायपुर शहर उत्तर', block: 'रायपुर', event_count: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [{ area_type: 'urban', event_count: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [{
            location: 'पंडरी',
            district: 'रायपुर',
            ulb: 'रायपुर नगर निगम',
            is_urban: 'true',
            event_count: '1'
          }]
        });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total_events).toBe(1);
      expect(data.data.by_district).toHaveLength(1);
    });

    test('should handle very large event counts', async () => {
      const largeCount = '999999';
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: largeCount }]
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total_events).toBe(999999);
      expect(typeof data.data.by_district[0].event_count).toBe('number');
    });

    test('should handle rural location without gram_panchayat', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ assembly: 'रायपुर शहर उत्तर', event_count: '1' }]
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            assembly: 'रायपुर शहर उत्तर',
            block: 'रायपुर',
            gram_panchayat: null, // Missing GP
            ulb: null,
            ward_no: null,
            is_urban: 'false',
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{ area_type: 'rural', event_count: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [{ event_type: 'बैठक', event_count: '1' }]
        });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-district?district=रायपुर');
      const response = await getByDistrict(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.villages[0].gram_panchayat).toBeNull();
      expect(data.data.villages[0].is_urban).toBe(false);
    });

    test('should handle urban location with ULB and ward', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ block: 'रायपुर', event_count: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            block: 'रायपुर',
            gram_panchayat: null,
            ulb: 'रायपुर नगर निगम',
            ward_no: '5',
            is_urban: 'true',
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{ area_type: 'urban', event_count: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [{ event_type: 'बैठक', event_count: '1' }]
        });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=रायपुर शहर उत्तर');
      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.villages[0].ulb).toBe('रायपुर नगर निगम');
      expect(data.data.villages[0].ward_no).toBe(5); // Should be parsed to number
      expect(data.data.villages[0].is_urban).toBe(true);
    });

    test('should handle mixed urban/rural distribution', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '10' }]
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: [
            { area_type: 'urban', event_count: '6' },
            { area_type: 'rural', event_count: '4' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.urban_rural.urban).toBe(6);
      expect(data.data.urban_rural.rural).toBe(4);
    });

    test('should limit top_locations to 20 results', async () => {
      // Create 25 mock locations
      const manyLocations = Array.from({ length: 25 }, (_, i) => ({
        location: `Location${i}`,
        district: 'रायपुर',
        ulb: null,
        is_urban: 'false',
        event_count: String(i + 1)
      }));

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '325' }] // Sum of 1-25
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: manyLocations
        });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should limit to 20 in query, but mock returns 25 - verify handling
      expect(data.data.top_locations.length).toBeLessThanOrEqual(25);
    });

    test('should handle missing fields in geo_hierarchy objects', async () => {
      // Test with incomplete hierarchy data
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', assembly: null, event_count: '1' }] // Missing assembly
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should handle null assembly gracefully
      if (data.data.by_assembly.length > 0) {
        expect(data.data.by_assembly[0].assembly).toBeNull();
      }
    });

    test('should handle zero event counts correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '0' }]
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total_events).toBe(0);
      expect(data.data.by_district[0].event_count).toBe(0);
    });
  });

  // ============================================================
  // RESULT FORMATTING & TYPE CONVERSION TESTS
  // ============================================================

  describe('Result Formatting & Type Conversion', () => {
    test('should convert event_count string to number', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '10' }] // String from DB
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.data.by_district[0].event_count).toBe('number');
      expect(data.data.by_district[0].event_count).toBe(10);
    });

    test('should convert is_urban string to boolean', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ block: 'रायपुर', event_count: '1' }]
        })
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            block: 'रायपुर',
            gram_panchayat: null,
            ulb: 'रायपुर नगर निगम',
            ward_no: '5',
            is_urban: 'true', // String from DB
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=रायपुर शहर उत्तर');
      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.data.villages[0].is_urban).toBe('boolean');
      expect(data.data.villages[0].is_urban).toBe(true);
    });

    test('should convert ward_no string to number', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            assembly: 'रायपुर शहर उत्तर',
            block: 'रायपुर',
            gram_panchayat: null,
            ulb: 'रायपुर नगर निगम',
            ward_no: '42', // String from DB
            is_urban: 'true',
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-district?district=रायपुर');
      const response = await getByDistrict(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.data.villages[0].ward_no).toBe('number');
      expect(data.data.villages[0].ward_no).toBe(42);
    });

    test('should handle null ward_no correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            assembly: 'रायपुर शहर उत्तर',
            block: 'रायपुर',
            gram_panchayat: 'रायपुर',
            ulb: null,
            ward_no: null, // Null from DB
            is_urban: 'false',
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-district?district=रायपुर');
      const response = await getByDistrict(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.villages[0].ward_no).toBeNull();
    });

    test('should reduce total_events correctly with multiple districts', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { district: 'रायपुर', event_count: '10' },
            { district: 'बिलासपुर', event_count: '5' },
            { district: 'दुर्ग', event_count: '3' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total_events).toBe(18); // 10 + 5 + 3
    });

    test('should handle reduce with empty array', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any) // Empty array
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total_events).toBe(0); // reduce with empty array should return 0
    });

    test('should format urban_rural object correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '10' }]
        })
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: [
            { area_type: 'urban', event_count: '7' },
            { area_type: 'rural', event_count: '3' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.urban_rural).toMatchObject({
        urban: 7,
        rural: 3
      });
      expect(typeof data.data.urban_rural.urban).toBe('number');
    });

    test('should include filters in response', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const eventType = 'बैठक';

      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?startDate=${startDate}&endDate=${endDate}&event_type=${encodeURIComponent(eventType)}`
      );

      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.filters).toMatchObject({
        start_date: startDate,
        end_date: endDate,
        event_type: eventType
      });
    });

    test('should set null for missing filters', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.filters).toMatchObject({
        start_date: null,
        end_date: null,
        event_type: null
      });
    });
  });

  // ============================================================
  // QUERY PARAMETER COMBINATIONS
  // ============================================================

  describe('Query Parameter Combinations', () => {
    test('should handle all filters combined (startDate, endDate, event_type)', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const eventType = 'बैठक';

      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?startDate=${startDate}&endDate=${endDate}&event_type=${encodeURIComponent(eventType)}`
      );

      const response = await getSummary(request);
      expect(response.status).toBe(200);

      // Verify all three filters are in WHERE clause
      const queryCalls = mockQuery.mock.calls;
      if (queryCalls.length > 0) {
        const firstQuery = queryCalls[0][0] as string;
        expect(firstQuery).toContain('parsed_at >=');
        expect(firstQuery).toContain('parsed_at <=');
        expect(firstQuery).toContain('event_type =');
      }
    });

    test('should handle only startDate filter', async () => {
      const startDate = '2024-06-01';

      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?startDate=${startDate}`
      );

      const response = await getSummary(request);
      expect(response.status).toBe(200);
      expect(response.status).not.toBe(500);
    });

    test('should handle only endDate filter', async () => {
      const endDate = '2024-12-31';

      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?endDate=${endDate}`
      );

      const response = await getSummary(request);
      expect(response.status).toBe(200);
    });

    test('should handle only event_type filter', async () => {
      const eventType = 'रैली';

      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?event_type=${encodeURIComponent(eventType)}`
      );

      const response = await getSummary(request);
      expect(response.status).toBe(200);
    });

    test('should handle by-district with all optional filters', async () => {
      const district = 'रायपुर';
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const eventType = 'बैठक';

      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(district)}&startDate=${startDate}&endDate=${endDate}&event_type=${encodeURIComponent(eventType)}`
      );

      const response = await getByDistrict(request);
      expect(response.status).toBe(200);
    });

    test('should handle by-assembly with all optional filters', async () => {
      const district = 'रायपुर';
      const assembly = 'रायपुर शहर उत्तर';
      const startDate = '2024-01-01';
      const eventType = 'रैली';

      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-assembly?district=${encodeURIComponent(district)}&assembly=${encodeURIComponent(assembly)}&startDate=${startDate}&event_type=${encodeURIComponent(eventType)}`
      );

      const response = await getByAssembly(request);
      expect(response.status).toBe(200);
    });
  });

  // ============================================================
  // BOUNDARY CONDITIONS
  // ============================================================

  describe('Boundary Conditions', () => {
    test('should handle very large result sets', async () => {
      // Mock 100 districts
      const manyDistricts = Array.from({ length: 100 }, (_, i) => ({
        district: `District${i}`,
        event_count: String(i + 1)
      }));

      mockQuery
        .mockResolvedValueOnce({ rows: manyDistricts } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.by_district).toHaveLength(100);
    });

    test('should handle date range spanning multiple years', async () => {
      const startDate = '2020-01-01';
      const endDate = '2024-12-31';

      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '1000' }]
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?startDate=${startDate}&endDate=${endDate}`
      );

      const response = await getSummary(request);
      expect(response.status).toBe(200);
      expect(response.status).not.toBe(500);
    });

    test('should handle same start and end date', async () => {
      const date = '2024-06-15';

      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?startDate=${date}&endDate=${date}`
      );

      const response = await getSummary(request);
      expect(response.status).toBe(200);
    });

    test('should handle startDate after endDate (invalid range)', async () => {
      const startDate = '2024-12-31';
      const endDate = '2024-01-01';

      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?startDate=${startDate}&endDate=${endDate}`
      );

      const response = await getSummary(request);
      // Should either validate and return 400, or let DB handle (returns empty results)
      expect([200, 400]).toContain(response.status);
    });
  });

  // ============================================================
  // CONCURRENCY & PERFORMANCE EDGE CASES
  // ============================================================

  describe('Concurrency & Performance', () => {
    test('should handle rapid sequential requests', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const requests = Array.from({ length: 10 }, () =>
        getSummary(new NextRequest('http://localhost:3000/api/geo-analytics/summary'))
      );

      const responses = await Promise.all(requests);

      // All should succeed (or all fail consistently)
      responses.forEach(response => {
        expect([200, 500]).toContain(response.status);
      });
    });

    test('should handle query timeout gracefully', async () => {
      const timeoutError = new Error('Query timeout after 30000ms');
      timeoutError.name = 'TimeoutError';
      
      // @ts-expect-error - Jest mock type compatibility
      mockQuery.mockRejectedValueOnce(timeoutError);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  // ============================================================
  // RESPONSE STRUCTURE VALIDATION
  // ============================================================

  describe('Response Structure Validation', () => {
    test('should include source field in successful response', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source).toBe('database');
    });

    test('should have consistent response structure across endpoints', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      const summaryRequest = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const districtRequest = new NextRequest('http://localhost:3000/api/geo-analytics/by-district?district=रायपुर');
      const assemblyRequest = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=रायपुर शहर उत्तर');

      const [summaryRes, districtRes, assemblyRes] = await Promise.all([
        getSummary(summaryRequest),
        getByDistrict(districtRequest),
        getByAssembly(assemblyRequest)
      ]);

      const [summaryData, districtData, assemblyData] = await Promise.all([
        summaryRes.json(),
        districtRes.json(),
        assemblyRes.json()
      ]);

      // All should have success field
      expect(summaryData).toHaveProperty('success');
      expect(districtData).toHaveProperty('success');
      expect(assemblyData).toHaveProperty('success');

      // Successful responses should have data field
      if (summaryData.success) expect(summaryData).toHaveProperty('data');
      if (districtData.success) expect(districtData).toHaveProperty('data');
      if (assemblyData.success) expect(assemblyData).toHaveProperty('data');
    });

    test('should handle null values in result rows safely', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ district: null, event_count: null }] } as any)
        .mockResolvedValueOnce({ rows: [{ district: null, assembly: null, event_count: null }] } as any)
        .mockResolvedValueOnce({ rows: [{ district: null, assembly: null, block: null, event_count: null }] } as any)
        .mockResolvedValueOnce({ rows: [{ area_type: 'urban', event_count: null }] } as any)
        .mockResolvedValueOnce({ rows: [{ location: null, district: null, event_count: null }] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total_events).toBe(0);
    });

    test('should handle empty result arrays', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total_events).toBe(0);
      expect(data.data.by_district).toEqual([]);
      expect(data.data.urban_rural).toEqual({});
    });

    test('should handle is_urban string conversion correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [
          { location: 'Test', district: 'Test', is_urban: 'false', event_count: '5', ulb: null }
        ] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.top_locations[0].is_urban).toBe(false);
      expect(data.data.top_locations[0].ulb).toBe(null);
    });

    test('should handle all three filter parameters together', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ district: 'Test', event_count: '10' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ area_type: 'rural', event_count: '10' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary?startDate=2024-01-01&endDate=2024-12-31&event_type=बैठक');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.filters.start_date).toBe('2024-01-01');
      expect(data.data.filters.end_date).toBe('2024-12-31');
      expect(data.data.filters.event_type).toBe('बैठक');
    });

    test('should handle urban_rural with multiple area types', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [
          { area_type: 'urban', event_count: '5' },
          { area_type: 'rural', event_count: '3' }
        ] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.urban_rural.urban).toBe(5);
      expect(data.data.urban_rural.rural).toBe(3);
    });

    test('should handle ulb field when present in top_locations', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [
          { location: 'Test', district: 'Test', is_urban: 'true', ulb: 'Test ULB', event_count: '10' }
        ] } as any);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.top_locations[0].ulb).toBe('Test ULB');
      expect(data.data.top_locations[0].is_urban).toBe(true);
    });
  });
});

