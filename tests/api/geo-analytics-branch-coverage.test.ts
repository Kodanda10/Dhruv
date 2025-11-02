/**
 * Geo Analytics API - Branch Coverage Tests
 * 
 * Focus: Exercise all conditional branches and code paths
 * Target: 70%+ branch coverage
 * 
 * Tests all:
 * - If/else branches
 * - Ternary operators
 * - Null coalescing
 * - Type conversions (edge cases)
 * - Conditional formatting
 * - Error path variations
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET as getSummary } from '@/app/api/geo-analytics/summary/route';
import { GET as getByDistrict } from '@/app/api/geo-analytics/by-district/route';
import { GET as getByAssembly } from '@/app/api/geo-analytics/by-assembly/route';

jest.mock('@/lib/db/pool', () => ({
  getDBPool: jest.fn(() => ({
    query: jest.fn()
  }))
}));

describe('Geo Analytics - Branch Coverage Tests', () => {
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
  // WHERE CLAUSE BRANCH COVERAGE
  // ============================================================

  describe('WHERE Clause Branch Coverage', () => {
    test('should include startDate in WHERE when provided', async () => {
      const startDate = '2024-01-01';
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getSummary(new NextRequest(`http://localhost:3000/api/geo-analytics/summary?startDate=${startDate}`));

      const query = mockQuery.mock.calls[0][0] as string;
      expect(query).toContain('parsed_at >=');
      expect(query).toContain('$1');
    });

    test('should NOT include startDate in WHERE when NOT provided', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getSummary(new NextRequest('http://localhost:3000/api/geo-analytics/summary'));

      const query = mockQuery.mock.calls[0][0] as string;
      // When startDate is not provided, should not have parsed_at >= clause
      // But it will have the base WHERE clause, so we check it doesn't have the date param
      const params = mockQuery.mock.calls[0][1] as any[];
      const hasStartDate = params.some(p => p === '2024-01-01' || p?.includes('2024'));
      expect(hasStartDate).toBe(false);
    });

    test('should include endDate in WHERE when provided', async () => {
      const endDate = '2024-12-31';
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getSummary(new NextRequest(`http://localhost:3000/api/geo-analytics/summary?endDate=${endDate}`));

      const query = mockQuery.mock.calls[0][0] as string;
      expect(query).toContain('parsed_at <=');
    });

    test('should NOT include endDate in WHERE when NOT provided', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getSummary(new NextRequest('http://localhost:3000/api/geo-analytics/summary'));

      // Verify no endDate param
      const params = mockQuery.mock.calls[0][1] as any[];
      expect(params.length).toBe(0); // Only base WHERE, no date params
    });

    test('should include event_type in WHERE when provided', async () => {
      const eventType = 'बैठक';
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getSummary(new NextRequest(`http://localhost:3000/api/geo-analytics/summary?event_type=${encodeURIComponent(eventType)}`));

      const query = mockQuery.mock.calls[0][0] as string;
      expect(query).toContain('event_type =');
    });

    test('should NOT include event_type in WHERE when NOT provided', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getSummary(new NextRequest('http://localhost:3000/api/geo-analytics/summary'));

      const params = mockQuery.mock.calls[0][1] as any[];
      // Should not have event_type in params when not provided
      const hasEventType = params.some(p => p === 'बैठक' || p?.includes('बैठक'));
      expect(hasEventType).toBe(false);
    });

    test('should handle all three optional filters together', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const eventType = 'बैठक';

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getSummary(new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?startDate=${startDate}&endDate=${endDate}&event_type=${encodeURIComponent(eventType)}`
      ));

      const params = mockQuery.mock.calls[0][1] as any[];
      expect(params).toContain(startDate);
      expect(params).toContain(endDate);
      expect(params).toContain(eventType);
      expect(params.length).toBe(3);
    });

    test('should handle parameter index incrementing correctly', async () => {
      // Test that paramIndex increments properly for each filter
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const eventType = 'बैठक';

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getSummary(new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?startDate=${startDate}&endDate=${endDate}&event_type=${encodeURIComponent(eventType)}`
      ));

      const query = mockQuery.mock.calls[0][0] as string;
      // Should use $1, $2, $3 for the three parameters
      expect(query).toMatch(/\$1.*\$2.*\$3/);
    });
  });

  // ============================================================
  // BY-DISTRICT BRANCH COVERAGE
  // ============================================================

  describe('By-District Branch Coverage', () => {
    test('should return 400 when district is null', async () => {
      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-district');
      const response = await getByDistrict(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('district parameter is required');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('should execute queries when district is provided', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-district?district=रायपुर');
      await getByDistrict(request);

      expect(mockQuery).toHaveBeenCalled();
    });

    test('should handle startDate filter in by-district', async () => {
      const district = 'रायपुर';
      const startDate = '2024-01-01';

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getByDistrict(new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(district)}&startDate=${startDate}`
      ));

      const params = mockQuery.mock.calls[0][1] as any[];
      expect(params).toContain(district);
      expect(params).toContain(startDate);
    });

    test('should handle endDate filter in by-district', async () => {
      const district = 'रायपुर';
      const endDate = '2024-12-31';

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getByDistrict(new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(district)}&endDate=${endDate}`
      ));

      const params = mockQuery.mock.calls[0][1] as any[];
      expect(params).toContain(endDate);
    });

    test('should handle event_type filter in by-district', async () => {
      const district = 'रायपुर';
      const eventType = 'बैठक';

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getByDistrict(new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(district)}&event_type=${encodeURIComponent(eventType)}`
      ));

      const query = mockQuery.mock.calls[0][0] as string;
      expect(query).toContain('event_type =');
    });

    test('should use correct parameter index starting from $2 (district is $1)', async () => {
      const district = 'रायपुर';
      const startDate = '2024-01-01';

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getByDistrict(new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(district)}&startDate=${startDate}`
      ));

      const query = mockQuery.mock.calls[0][0] as string;
      // District should be $1, startDate should be $2
      expect(query).toContain('$1');
      expect(query).toContain('$2');
    });
  });

  // ============================================================
  // BY-ASSEMBLY BRANCH COVERAGE
  // ============================================================

  describe('By-Assembly Branch Coverage', () => {
    test('should return 400 when district is null', async () => {
      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?assembly=रायपुर शहर उत्तर');
      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('district and assembly parameters are required');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('should return 400 when assembly is null', async () => {
      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर');
      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('district and assembly parameters are required');
    });

    test('should return 400 when both district and assembly are null', async () => {
      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly');
      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    test('should execute queries when both district and assembly are provided', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=रायपुर शहर उत्तर');
      await getByAssembly(request);

      expect(mockQuery).toHaveBeenCalled();
    });

    test('should use correct parameter indices ($1=district, $2=assembly, $3+=optional)', async () => {
      const district = 'रायपुर';
      const assembly = 'रायपुर शहर उत्तर';
      const startDate = '2024-01-01';

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await getByAssembly(new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-assembly?district=${encodeURIComponent(district)}&assembly=${encodeURIComponent(assembly)}&startDate=${startDate}`
      ));

      const query = mockQuery.mock.calls[0][0] as string;
      // Should use $1, $2, $3
      expect(query).toMatch(/\$1.*\$2.*\$3/);
    });
  });

  // ============================================================
  // RESULT FORMATTING BRANCH COVERAGE
  // ============================================================

  describe('Result Formatting Branch Coverage', () => {
    test('should handle null ulb in top_locations', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '1' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            location: 'पंडरी',
            district: 'रायपुर',
            ulb: null, // Null ULB
            is_urban: 'false',
            event_count: '1'
          }]
        });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.top_locations[0].ulb).toBeNull();
    });

    test('should handle non-null ulb in top_locations', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '1' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            location: 'पंडरी',
            district: 'रायपुर',
            ulb: 'रायपुर नगर निगम', // Non-null ULB
            is_urban: 'true',
            event_count: '1'
          }]
        });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.top_locations[0].ulb).toBe('रायपुर नगर निगम');
    });

    test('should handle null gram_panchayat in villages', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ assembly: 'रायपुर शहर उत्तर', event_count: '1' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            assembly: 'रायपुर शहर उत्तर',
            block: 'रायपुर',
            gram_panchayat: null, // Null GP
            ulb: null,
            ward_no: null,
            is_urban: 'false',
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-district?district=रायपुर');
      const response = await getByDistrict(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.villages[0].gram_panchayat).toBeNull();
    });

    test('should handle non-null gram_panchayat in villages', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            assembly: 'रायपुर शहर उत्तर',
            block: 'रायपुर',
            gram_panchayat: 'रायपुर', // Non-null GP
            ulb: null,
            ward_no: null,
            is_urban: 'false',
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-district?district=रायपुर');
      const response = await getByDistrict(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.villages[0].gram_panchayat).toBe('रायपुर');
    });

    test('should convert ward_no to number when present', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            assembly: 'रायपुर शहर उत्तर',
            block: 'रायपुर',
            gram_panchayat: null,
            ulb: 'रायपुर नगर निगम',
            ward_no: '10', // String from DB
            is_urban: 'true',
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=रायपुर शहर उत्तर');
      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.data.villages[0].ward_no).toBe('number');
      expect(data.data.villages[0].ward_no).toBe(10);
    });

    test('should handle null ward_no', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            assembly: 'रायपुर शहर उत्तर',
            block: 'रायपुर',
            gram_panchayat: null,
            ulb: null,
            ward_no: null, // Null ward_no
            is_urban: 'false',
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=रायपुर शहर उत्तर');
      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.villages[0].ward_no).toBeNull();
    });

    test('should convert is_urban string true to boolean true', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            block: 'रायपुर',
            gram_panchayat: null,
            ulb: 'रायपुर नगर निगम',
            ward_no: '5',
            is_urban: 'true', // String 'true'
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=रायपुर शहर उत्तर');
      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.villages[0].is_urban).toBe(true);
      expect(typeof data.data.villages[0].is_urban).toBe('boolean');
    });

    test('should convert is_urban string false to boolean false', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            village: 'पंडरी',
            block: 'रायपुर',
            gram_panchayat: 'रायपुर',
            ulb: null,
            ward_no: null,
            is_urban: 'false', // String 'false'
            event_count: '1'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-assembly?district=रायपुर&assembly=रायपुर शहर उत्तर');
      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.villages[0].is_urban).toBe(false);
    });

    test('should handle filters object with null values', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.filters.start_date).toBeNull();
      expect(data.data.filters.end_date).toBeNull();
      expect(data.data.filters.event_type).toBeNull();
    });

    test('should handle filters object with non-null values', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const eventType = 'बैठक';

      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?startDate=${startDate}&endDate=${endDate}&event_type=${encodeURIComponent(eventType)}`
      );
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.filters.start_date).toBe(startDate);
      expect(data.data.filters.end_date).toBe(endDate);
      expect(data.data.filters.event_type).toBe(eventType);
    });

    test('should handle urban_rural reduce with empty array', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '0' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // Empty urban_rural result
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.urban_rural).toEqual({});
    });

    test('should handle urban_rural reduce with single result', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '10' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ area_type: 'urban', event_count: '10' }] // Single result
        })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.urban_rural).toEqual({ urban: 10 });
    });

    test('should handle urban_rural reduce with multiple results', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ district: 'रायपुर', event_count: '10' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            { area_type: 'urban', event_count: '6' },
            { area_type: 'rural', event_count: '4' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.urban_rural).toEqual({ urban: 6, rural: 4 });
    });
  });

  // ============================================================
  // ERROR HANDLING BRANCH COVERAGE
  // ============================================================

  describe('Error Handling Branch Coverage', () => {
    test('should handle Error instance in catch block', async () => {
      const error = new Error('Specific error message');
      mockQuery.mockRejectedValueOnce(error);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Specific error message');
      expect(data.error).not.toBe('Unknown error');
    });

    test('should handle non-Error exception in catch block', async () => {
      mockQuery.mockRejectedValueOnce('String error');

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Unknown error');
    });

    test('should handle undefined error in catch block', async () => {
      mockQuery.mockRejectedValueOnce(undefined);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    test('should handle null error in catch block', async () => {
      mockQuery.mockRejectedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});

