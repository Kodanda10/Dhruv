/**
 * TDD Tests for Admin Authentication Status
 *
 * Security Requirements:
 * - Validate session tokens securely
 * - Return appropriate user information without sensitive data
 * - Handle expired/invalid tokens gracefully
 */

import { NextRequest } from 'next/server';

// Mock Next.js server
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    url: string;
    cookies: Map<string, string>;
    constructor(input: string | URL, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input.toString();
      this.cookies = new Map();
    }
  },
  NextResponse: {
    json: (data: any, init?: ResponseInit) => ({
      status: init?.status || 200,
      json: async () => data,
    }),
  },
}));

// Import after mocks
import { GET as statusGet } from '../../../src/app/api/auth/status/route';

describe('GET /api/auth/status - Admin Authentication Status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('Session Validation', () => {
    it('should return authenticated status for valid sessions', async () => {
      // Mock valid session
      const request = new NextRequest('http://localhost:3000/api/auth/status', {
        headers: {
          'Cookie': 'admin_token=valid_session_token'
        },
      });

      const response = await statusGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.role).toBe('admin');
    });

    it('should return unauthenticated status for missing tokens', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/status');

      const response = await statusGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeUndefined();
    });

    it('should return unauthenticated status for invalid tokens', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/status', {
        headers: {
          'Cookie': 'admin_token=invalid_token'
        },
      });

      const response = await statusGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeUndefined();
    });

    it('should return unauthenticated status for expired tokens', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/status', {
        headers: {
          'Cookie': 'admin_token=expired_token'
        },
      });

      const response = await statusGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeUndefined();
    });
  });

  describe('Response Security', () => {
    it('should not expose sensitive user information', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/status', {
        headers: {
          'Cookie': 'admin_token=valid_session_token'
        },
      });

      const response = await statusGet(request);
      const data = await response.json();

      // Should include safe fields
      expect(data.user).toBeDefined();
      expect(data.user.username).toBeDefined();
      expect(data.user.role).toBeDefined();

      // Should NOT include sensitive fields
      expect(data.user.password).toBeUndefined();
      expect(data.user.password_hash).toBeUndefined();
      expect(data.user.email).toBeUndefined();
    });
  });
});
