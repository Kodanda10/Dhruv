import '@testing-library/jest-dom';

// Polyfill TextEncoder/TextDecoder for Node.js environment (required by pg)
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock Next.js App Router hooks for unit tests
jest.mock('next/navigation', () => {
  const params = new URLSearchParams('');
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      refresh: jest.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => params,
  };
});

// Mock Next.js server components for API route tests
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    url: string;
    constructor(input: string | URL, init?: RequestInit) {
      this.url = typeof input === 'string' ? input : input.toString();
    }
  },
  NextResponse: {
    json: (data: any, init?: ResponseInit) => ({
      status: init?.status || 200,
      json: async () => data,
    }),
  },
}));

// Mock Next.js headers
jest.mock('next/headers', () => ({
  headers: () => new Map(),
  cookies: () => ({
    get: jest.fn(),
    set: jest.fn(),
  }),
}));
