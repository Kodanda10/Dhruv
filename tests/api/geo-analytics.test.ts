/**
 * Geo Analytics API Endpoint Tests
 * 
 * TDD: Failing tests first, then implement fixes to pass
 * Tests cover all three endpoints:
 * - GET /api/geo-analytics/summary
 * - GET /api/geo-analytics/by-district
 * - GET /api/geo-analytics/by-assembly
 * 
 * Note: geo_hierarchy is stored as JSONB array, not single object
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
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

describe('Geo Analytics API Endpoints', () => {
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

  describe('GET /api/geo-analytics/summary', () => {
    test('should return hierarchical drilldown with proper structure', async () => {
      // Mock database responses for summary queries (5 queries in parallel)
      // Each query call returns the next mock result
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { district: 'रायपुर', event_count: '10' },
            { district: 'बिलासपुर', event_count: '5' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { district: 'रायपुर', assembly: 'रायपुर शहर उत्तर', event_count: '6' },
            { district: 'रायपुर', assembly: 'रायपुर शहर दक्षिण', event_count: '4' },
            { district: 'बिलासपुर', assembly: 'बिलासपुर', event_count: '5' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { district: 'रायपुर', assembly: 'रायपुर शहर उत्तर', block: 'रायपुर', event_count: '6' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { area_type: 'urban', event_count: '8' },
            { area_type: 'rural', event_count: '7' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              location: 'पंडरी',
              district: 'रायपुर',
              ulb: 'रायपुर नगर निगम',
              is_urban: 'true',
              event_count: '5'
            }
          ]
        });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        data: {
          total_events: expect.any(Number),
          by_district: expect.arrayContaining([
            expect.objectContaining({
              district: expect.any(String),
              event_count: expect.any(Number)
            })
          ]),
          by_assembly: expect.arrayContaining([
            expect.objectContaining({
              district: expect.any(String),
              assembly: expect.any(String),
              event_count: expect.any(Number)
            })
          ]),
          by_block: expect.arrayContaining([
            expect.objectContaining({
              district: expect.any(String),
              assembly: expect.any(String),
              block: expect.any(String),
              event_count: expect.any(Number)
            })
          ]),
          urban_rural: expect.objectContaining({
            urban: expect.any(Number),
            rural: expect.any(Number)
          }),
          top_locations: expect.arrayContaining([
            expect.objectContaining({
              location: expect.any(String),
              district: expect.any(String),
              event_count: expect.any(Number)
            })
          ])
        }
      });

      // Verify total_events is sum of district counts
      expect(data.data.total_events).toBe(15); // 10 + 5
    });

    test('should filter by startDate and endDate', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      // Mock all 5 queries with empty results
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?startDate=${startDate}&endDate=${endDate}`
      );

      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Verify query was called with date parameters
      const queryCalls = mockQuery.mock.calls;
      expect(queryCalls.length).toBeGreaterThan(0);
      
      // Verify date filters are in WHERE clause (check SQL query string)
      const firstQuery = queryCalls[0][0] as string;
      expect(firstQuery).toContain('parsed_at >=');
      expect(firstQuery).toContain('parsed_at <=');
    });

    test('should filter by event_type', async () => {
      const eventType = 'बैठक';

      // Mock all 5 queries with empty results
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/summary?event_type=${encodeURIComponent(eventType)}`
      );

      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Verify query includes event_type filter
      const queryCalls = mockQuery.mock.calls;
      const firstQuery = queryCalls[0][0] as string;
      expect(firstQuery).toContain('event_type =');
    });

    test('should only return approved events (review_status = approved)', async () => {
      // Mock all 5 queries with empty results
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      await getSummary(request);

      // Verify WHERE clause includes review_status filter
      const queryCalls = mockQuery.mock.calls;
      const firstQuery = queryCalls[0][0] as string;
      expect(firstQuery).toContain("review_status = 'approved'");
      expect(firstQuery).toContain('needs_review = false');
    });

    test('should handle empty results gracefully', async () => {
      // Mock all 5 queries with empty results
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
      expect(data.data.total_events).toBe(0);
      expect(data.data.by_district).toEqual([]);
    });
  });

  describe('GET /api/geo-analytics/by-district', () => {
    test('should return drilldown for specific district', async () => {
      const district = 'रायपुर';

      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { assembly: 'रायपुर शहर उत्तर', event_count: '6' },
            { assembly: 'रायपुर शहर दक्षिण', event_count: '4' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { assembly: 'रायपुर शहर उत्तर', block: 'रायपुर', event_count: '6' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              village: 'पंडरी',
              assembly: 'रायपुर शहर उत्तर',
              block: 'रायपुर',
              gram_panchayat: null,
              ulb: 'रायपुर नगर निगम',
              ward_no: '5',
              is_urban: 'true',
              event_count: '5'
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { area_type: 'urban', event_count: '10' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { event_type: 'बैठक', event_count: '6' },
            { event_type: 'रैली', event_count: '4' }
          ]
        });

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(district)}`
      );

      const response = await getByDistrict(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        data: {
          district: district,
          total_events: expect.any(Number),
          assemblies: expect.arrayContaining([
            expect.objectContaining({
              assembly: expect.any(String),
              event_count: expect.any(Number)
            })
          ]),
          blocks: expect.arrayContaining([
            expect.objectContaining({
              assembly: expect.any(String),
              block: expect.any(String),
              event_count: expect.any(Number)
            })
          ]),
          villages: expect.arrayContaining([
            expect.objectContaining({
              village: expect.any(String),
              event_count: expect.any(Number)
            })
          ]),
          urban_rural: expect.any(Object),
          event_types: expect.arrayContaining([
            expect.objectContaining({
              event_type: expect.any(String),
              event_count: expect.any(Number)
            })
          ])
        }
      });
    });

    test('should return 400 when district parameter is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/geo-analytics/by-district');
      
      const response = await getByDistrict(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        success: false,
        error: 'district parameter is required'
      });

      // Verify no database queries were made
      expect(mockQuery).not.toHaveBeenCalled();
    });

    test('should handle date and event_type filters', async () => {
      const district = 'रायपुर';
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const eventType = 'बैठक';

      // Mock all 5 queries for by-district endpoint
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-district?district=${encodeURIComponent(district)}&startDate=${startDate}&endDate=${endDate}&event_type=${encodeURIComponent(eventType)}`
      );

      await getByDistrict(request);

      // Verify query includes all filters
      const queryCalls = mockQuery.mock.calls;
      const firstQuery = queryCalls[0][0] as string;
      expect(firstQuery).toContain('parsed_at >=');
      expect(firstQuery).toContain('event_type =');
    });
  });

  describe('GET /api/geo-analytics/by-assembly', () => {
    test('should return drilldown for specific assembly', async () => {
      const district = 'रायपुर';
      const assembly = 'रायपुर शहर उत्तर';

      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { block: 'रायपुर', event_count: '6' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              village: 'पंडरी',
              block: 'रायपुर',
              gram_panchayat: null,
              ulb: 'रायपुर नगर निगम',
              ward_no: '5',
              is_urban: 'true',
              event_count: '5'
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { area_type: 'urban', event_count: '6' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { event_type: 'बैठक', event_count: '6' }
          ]
        });

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-assembly?district=${encodeURIComponent(district)}&assembly=${encodeURIComponent(assembly)}`
      );

      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        data: {
          district: district,
          assembly: assembly,
          total_events: expect.any(Number),
          blocks: expect.arrayContaining([
            expect.objectContaining({
              block: expect.any(String),
              event_count: expect.any(Number)
            })
          ]),
          villages: expect.arrayContaining([
            expect.objectContaining({
              village: expect.any(String),
              event_count: expect.any(Number)
            })
          ]),
          urban_rural: expect.any(Object),
          event_types: expect.arrayContaining([
            expect.objectContaining({
              event_type: expect.any(String),
              event_count: expect.any(Number)
            })
          ])
        }
      });
    });

    test('should return 400 when district parameter is missing', async () => {
      const assembly = 'रायपुर शहर उत्तर';

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-assembly?assembly=${encodeURIComponent(assembly)}`
      );

      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        success: false,
        error: 'district and assembly parameters are required'
      });
    });

    test('should return 400 when assembly parameter is missing', async () => {
      const district = 'रायपुर';

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-assembly?district=${encodeURIComponent(district)}`
      );

      const response = await getByAssembly(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        success: false,
        error: 'district and assembly parameters are required'
      });
    });

    test('should handle date and event_type filters', async () => {
      const district = 'रायपुर';
      const assembly = 'रायपुर शहर उत्तर';
      const startDate = '2024-01-01';
      const eventType = 'बैठक';

      // Mock all 4 queries for by-assembly endpoint
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const request = new NextRequest(
        `http://localhost:3000/api/geo-analytics/by-assembly?district=${encodeURIComponent(district)}&assembly=${encodeURIComponent(assembly)}&startDate=${startDate}&event_type=${encodeURIComponent(eventType)}`
      );

      await getByAssembly(request);

      // Verify query includes all filters
      const queryCalls = mockQuery.mock.calls;
      const firstQuery = queryCalls[0][0] as string;
      expect(firstQuery).toContain('parsed_at >=');
      expect(firstQuery).toContain('event_type =');
    });
  });

  describe('Error Handling', () => {
    test('should return 500 with proper error format on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/geo-analytics/summary');
      const response = await getSummary(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toMatchObject({
        success: false,
        error: expect.any(String),
        message: expect.any(String)
      });
    });
  });
});

