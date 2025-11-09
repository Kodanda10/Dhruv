/**
 * TDD Tests for Review Update API
 *
 * Hindi-Only Dashboard: All error messages and responses in Hindi
 * Human-in-the-Loop: Save edits, approve/reject with custom notes
 * Security: Input validation, parameterized queries, audit logging
 */

import { NextRequest } from 'next/server';
import { Pool } from 'pg';

// Mock Next.js server
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    url: string;
    private readonly _body: string;
    constructor(input: string | URL, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input.toString();
      this._body = typeof init?.body === 'string' ? init.body : '';
    }
    async json() {
      if (!this._body) return {};
      try {
        return JSON.parse(this._body);
      } catch {
        return {};
      }
    }
  },
  NextResponse: {
    json: (data: any, init?: ResponseInit) => ({
      status: init?.status || 200,
      json: async () => data,
    }),
  },
}));

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn(),
}));

// Import after mocks
import { POST as updatePost } from '../../../src/app/api/review/update/route';

describe('POST /api/review/update - Review Update API', () => {
  let mockPool: any;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQuery = jest.fn();
    mockPool = {
      query: mockQuery,
    };
    (Pool as unknown as jest.Mock).mockImplementation(() => mockPool);
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Save Review Edits', () => {
    it('should save updated tweet data to database', async () => {
      const updateData = {
        id: '123',
        event_type: 'rally',
        event_type_hi: 'रैली',
        locations: ['रायगढ़', 'रायपुर'],
        people_mentioned: ['मुख्यमंत्री'],
        organizations: ['भाजपा'],
        schemes_mentioned: ['योजना'],
        review_notes: 'Updated classification'
      };

      mockQuery.mockResolvedValue({ rowCount: 1 });

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('समीक्षा अपडेट हो गई');

      // Verify database update was called
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE parsed_events SET'),
        expect.arrayContaining([
          'rally',
          'रैली',
          ['मुख्यमंत्री'],
          ['भाजपा'],
          ['योजना'],
          JSON.stringify(['रायगढ़', 'रायपुर']),
          'Updated classification',
          '123'
        ])
      );
    });

    it('should handle array fields as strings for backward compatibility', async () => {
      const updateData = {
        id: '123',
        event_type: 'meeting',
        locations: 'रायगढ़', // String instead of array
        people_mentioned: [], // Empty array
      };

      mockQuery.mockResolvedValue({ rowCount: 1 });

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Approval Actions', () => {
    it('should approve tweet with status update', async () => {
      const approvalData = {
        id: '123',
        action: 'approve',
        notes: 'Approved with modifications'
      };

      mockQuery.mockResolvedValue({ rowCount: 1 });

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvalData),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('ट्वीट मंजूरी दे दी गई');

      // Verify approval query
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE parsed_events SET review_status = $1'),
        ['approved', 'Approved with modifications', expect.any(String), '123']
      );
    });

    it('should reject tweet with reason', async () => {
      const rejectionData = {
        id: '123',
        action: 'reject',
        notes: 'Incorrect event classification'
      };

      mockQuery.mockResolvedValue({ rowCount: 1 });

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rejectionData),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('ट्वीट अस्वीकार कर दिया गया');

      // Verify rejection query
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('review_status = $1'),
        ['rejected', 'Incorrect event classification', expect.any(String), '123']
      );
    });

    it('should skip tweet for later review', async () => {
      const skipData = {
        id: '123',
        action: 'skip'
      };

      mockQuery.mockResolvedValue({ rowCount: 1 });

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skipData),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('ट्वीट छोड़ दिया गया');
    });
  });

  describe('Input Validation - Security', () => {
    it('should reject missing tweet ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'meeting'
        }),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('ट्वीट ID आवश्यक है');
    });

    it('should reject SQL injection attempts', async () => {
      const maliciousData = {
        id: "123'; DROP TABLE parsed_events; --",
        event_type: 'meeting'
      };

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maliciousData),
      });

      const response = await updatePost(request);
      const data = await response.json();

      // Should fail safely without executing harmful query
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should validate event_type format', async () => {
      const invalidData = {
        id: '123',
        event_type: '<script>alert("xss")</script>'
      };

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('अमान्य घटना प्रकार');
    });

    it('should validate array fields', async () => {
      const invalidData = {
        id: '123',
        locations: ['<script>alert("xss")</script>', 'valid_location']
      };

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('अमान्य स्थान डेटा');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should use parameterized queries for all updates', async () => {
      const updateData = {
        id: '123',
        event_type: 'rally',
        locations: ['test'],
        review_notes: 'test notes'
      };

      mockQuery.mockResolvedValue({ rowCount: 1 });

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      await updatePost(request);

      const updateCall = mockQuery.mock.calls.find(call =>
        call[0].includes('UPDATE parsed_events')
      );

      expect(updateCall).toBeDefined();
      const [query, params] = updateCall;

      // Should use parameterized query with $ placeholders
      expect(query).toMatch(/\$(\d+)/g);
      expect(Array.isArray(params)).toBe(true);
      expect(params.length).toBeGreaterThan(0);

      // Should not contain raw values in query string
      expect(query).not.toContain('rally');
      expect(query).not.toContain('test notes');
    });

    it('should properly escape array JSON', async () => {
      const updateData = {
        id: '123',
        locations: ['location with "quotes"', 'location with \'single quotes\'']
      };

      mockQuery.mockResolvedValue({ rowCount: 1 });

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      await updatePost(request);

      const updateCall = mockQuery.mock.calls.find(call =>
        call[0].includes('UPDATE parsed_events')
      );

      expect(updateCall).toBeDefined();
      const params = updateCall[1];

      // Arrays should be properly serialized as JSON strings
      const locationsParam = params.find(p => typeof p === 'string' && p.includes('quotes'));
      expect(locationsParam).toBe('["location with \\"quotes\\"","location with \'single quotes\'"]');
    });
  });

  describe('Database Error Handling', () => {
    it('should handle tweet not found gracefully', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '999',
          event_type: 'meeting'
        }),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('ट्वीट नहीं मिला');
    });

    it('should handle database connection errors', async () => {
      mockQuery.mockRejectedValue(new Error('Connection timeout'));

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '123',
          event_type: 'meeting'
        }),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('डेटाबेस त्रुटि');
    });

    it('should handle database constraint violations', async () => {
      mockQuery.mockRejectedValue(new Error('violates check constraint'));

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '123',
          event_type: 'meeting'
        }),
      });

      const response = await updatePost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('अमान्य डेटा');
    });
  });

  describe('Audit Logging', () => {
    it('should log all review actions', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '123',
          action: 'approve',
          notes: 'Approved'
        }),
      });

      await updatePost(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Review action: approve'),
        expect.objectContaining({
          tweetId: '123',
          action: 'approve',
          notes: 'Approved'
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log edit actions with field changes', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      mockQuery.mockResolvedValue({ rowCount: 1 });

      const request = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: '123',
          event_type: 'rally',
          review_notes: 'Updated classification'
        }),
      });

      await updatePost(request);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Review edit'),
        expect.objectContaining({
          tweetId: '123',
          changes: expect.objectContaining({
            event_type: 'rally',
            review_notes: 'Updated classification'
          })
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Hindi Response Messages', () => {
    it('should return all success messages in Hindi', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });

      // Test save
      const saveRequest = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '123', event_type: 'meeting' }),
      });

      const saveResponse = await updatePost(saveRequest);
      const saveData = await saveResponse.json();
      expect(saveData.message).toBe('समीक्षा अपडेट हो गई');

      // Test approve
      const approveRequest = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '123', action: 'approve' }),
      });

      const approveResponse = await updatePost(approveRequest);
      const approveData = await approveResponse.json();
      expect(approveData.message).toBe('ट्वीट मंजूरी दे दी गई');
    });

    it('should return all error messages in Hindi', async () => {
      // Test missing ID
      const missingIdRequest = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'meeting' }),
      });

      const missingIdResponse = await updatePost(missingIdRequest);
      const missingIdData = await missingIdResponse.json();
      expect(missingIdData.error).toBe('ट्वीट ID आवश्यक है');

      // Test not found
      mockQuery.mockResolvedValue({ rowCount: 0 });
      const notFoundRequest = new NextRequest('http://localhost:3000/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: '999', event_type: 'meeting' }),
      });

      const notFoundResponse = await updatePost(notFoundRequest);
      const notFoundData = await notFoundResponse.json();
      expect(notFoundData.error).toBe('ट्वीट नहीं मिला');
    });
  });
});
