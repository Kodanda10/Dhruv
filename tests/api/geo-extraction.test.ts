import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/geo-extraction/route';

// Mock the GeoHierarchyResolver
jest.mock('@/lib/geo-extraction/hierarchy-resolver', () => {
  const mockResolver = {
    initialize: jest.fn().mockResolvedValue(undefined),
    resolveVillage: jest.fn(),
    resolveAmbiguousLocation: jest.fn()
  };

  return {
    GeoHierarchyResolver: jest.fn().mockImplementation(() => mockResolver)
  };
});

describe('Geo-Extraction API Endpoint', () => {
  let mockResolver: any;

  beforeAll(async () => {
    // Set up mock resolver
    const { GeoHierarchyResolver } = require('@/lib/geo-extraction/hierarchy-resolver');
    mockResolver = new GeoHierarchyResolver();
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('POST /api/geo-extraction', () => {
    test('should extract geo-hierarchy for multiple locations', async () => {
      // Mock resolver responses
      mockResolver.resolveVillage
        .mockResolvedValueOnce([
          {
            village: 'पंडरी',
            gram_panchayat: 'रायपुर',
            block: 'रायपुर',
            assembly: 'रायपुर शहर उत्तर',
            district: 'रायपुर',
            is_urban: false,
            confidence: 1.0
          }
        ])
        .mockResolvedValueOnce([
          {
            village: 'तखतपुर',
            gram_panchayat: 'बिलासपुर',
            block: 'बिलासपुर',
            assembly: 'बिलासपुर',
            district: 'बिलासपुर',
            is_urban: false,
            confidence: 1.0
          }
        ]);

      const requestBody = {
        locations: ['पंडरी', 'तखतपुर'],
        tweetText: 'रायपुर के पंडरी और बिलासपुर के तखतपुर में कार्यक्रम',
        context: 'रायपुर और बिलासपुर जिले में'
      };

      const request = new NextRequest('http://localhost:3000/api/geo-extraction', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        hierarchies: expect.arrayContaining([
          expect.objectContaining({
            village: 'पंडरी',
            block: 'रायपुर',
            district: 'रायपुर'
          }),
          expect.objectContaining({
            village: 'तखतपुर',
            block: 'बिलासपुर',
            district: 'बिलासपुर'
          })
        ]),
        ambiguous: expect.any(Array),
        summary: expect.objectContaining({
          totalLocations: 2,
          resolvedLocations: 2,
          ambiguousLocations: 0,
          confidence: expect.any(Number)
        })
      });
    });

    test('should handle ambiguous locations with context', async () => {
      // Mock ambiguous location (multiple matches)
      mockResolver.resolveVillage.mockResolvedValueOnce([
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
          village: 'रायपुर',
          gram_panchayat: 'अरंग',
          block: 'अरंग',
          assembly: 'रायपुर शहर दक्षिण',
          district: 'रायपुर',
          is_urban: false,
          confidence: 1.0
        }
      ]);

      // Mock disambiguation
      mockResolver.resolveAmbiguousLocation.mockResolvedValueOnce({
        village: 'रायपुर',
        gram_panchayat: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: false,
        confidence: 0.9
      });

      const requestBody = {
        locations: ['रायपुर'],
        tweetText: 'रायपुर शहर उत्तर में कार्यक्रम',
        context: 'रायपुर शहर उत्तर'
      };

      const request = new NextRequest('http://localhost:3000/api/geo-extraction', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ambiguous).toHaveLength(1);
      expect(data.ambiguous[0]).toMatchObject({
        location: 'रायपुर',
        possibleMatches: expect.arrayContaining([
          expect.objectContaining({ assembly: 'रायपुर शहर उत्तर' }),
          expect.objectContaining({ assembly: 'रायपुर शहर दक्षिण' })
        ]),
        suggestedMatch: expect.objectContaining({
          assembly: 'रायपुर शहर उत्तर'
        })
      });
    });

    test('should handle urban locations with ULB and ward', async () => {
      mockResolver.resolveVillage.mockResolvedValueOnce([
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
      ]);

      const requestBody = {
        locations: ['रायपुर वार्ड 5'],
        tweetText: 'रायपुर वार्ड 5 में नगर निगम की बैठक',
        context: 'रायपुर नगर निगम'
      };

      const request = new NextRequest('http://localhost:3000/api/geo-extraction', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hierarchies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            is_urban: true,
            ulb: 'रायपुर नगर निगम',
            ward_no: 5
          })
        ])
      );
    });

    test('should handle unknown locations gracefully', async () => {
      mockResolver.resolveVillage.mockResolvedValueOnce([]);

      const requestBody = {
        locations: ['अज्ञात स्थान'],
        tweetText: 'अज्ञात स्थान में कार्यक्रम',
        context: ''
      };

      const request = new NextRequest('http://localhost:3000/api/geo-extraction', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hierarchies).toHaveLength(0);
      expect(data.ambiguous).toHaveLength(1);
      expect(data.ambiguous[0]).toMatchObject({
        location: 'अज्ञात स्थान',
        possibleMatches: [],
        suggestedMatch: expect.objectContaining({
          village: 'अज्ञात स्थान',
          block: 'Unknown',
          confidence: 0.0
        })
      });
      expect(data.summary.confidence).toBe(0.0);
    });

    test('should return 400 for invalid request', async () => {
      const requestBody = {
        locations: [],
        tweetText: 'Invalid request'
      };

      const request = new NextRequest('http://localhost:3000/api/geo-extraction', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('locations array is required');
    });
  });

  describe('GET /api/geo-extraction', () => {
    test('should resolve single location', async () => {
      mockResolver.resolveVillage.mockResolvedValueOnce([
        {
          village: 'पंडरी',
          gram_panchayat: 'रायपुर',
          block: 'रायपुर',
          assembly: 'रायपुर शहर उत्तर',
          district: 'रायपुर',
          is_urban: false,
          confidence: 1.0
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/geo-extraction?location=पंडरी');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        location: 'पंडरी',
        results: expect.arrayContaining([
          expect.objectContaining({
            village: 'पंडरी',
            block: 'रायपुर',
            district: 'रायपुर'
          })
        ]),
        count: 1
      });
    });

    test('should return 400 for missing location parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/geo-extraction');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('location parameter is required');
    });
  });

  describe('Error Handling', () => {
    test('should handle resolver initialization errors', async () => {
      // Clear module cache to force re-import
      jest.resetModules();
      
      // Create a new mock resolver that fails initialization
      const failingResolver = {
        initialize: jest.fn().mockRejectedValue(new Error('Initialization failed')),
        resolveVillage: jest.fn(),
        resolveAmbiguousLocation: jest.fn()
      };

      // Mock the GeoHierarchyResolver constructor to return the failing resolver
      jest.doMock('@/lib/geo-extraction/hierarchy-resolver', () => ({
        GeoHierarchyResolver: jest.fn().mockImplementation(() => failingResolver)
      }));

      // Re-import the API route to get the mocked version
      const { POST: MockedPOST } = await import('@/app/api/geo-extraction/route');

      const requestBody = {
        locations: ['पंडरी'],
        tweetText: 'Test tweet'
      };

      const request = new NextRequest('http://localhost:3000/api/geo-extraction', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await MockedPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });
  });
});
