import '@testing-library/jest-dom';

// Minimal ResizeObserver stub so chart libs relying on it don't crash in jsdom
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Polyfill TextEncoder/TextDecoder for Node.js environment (required by pg)
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Lightweight API response helper used by the default fetch stub
const createMockResponse = (body: any) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  } as const);

const SAMPLE_EVENTS = [
  {
    id: 'demo-1',
    tweet_id: '111',
    tweet_created_at: '2025-09-01T10:00:00Z',
    tweet_text: 'रायगढ़ विकास यात्रा का प्रथम पड़ाव #समारोह @PMOIndia',
    event_type: 'tour',
    event_type_confidence: 0.92,
    locations: [{ name: 'रायगढ़', district: 'रायगढ़' }],
    people_mentioned: ['@PMOIndia', 'ओपी चौधरी'],
    organizations: ['टीम विकास', 'समारोह कोर टीम'],
    schemes_mentioned: ['समारोह उत्थान मिशन'],
    overall_confidence: 0.9,
    needs_review: false,
    review_status: 'approved',
  },
  {
    id: 'demo-2',
    tweet_id: '112',
    tweet_created_at: '2025-09-03T14:30:00Z',
    tweet_text: 'खरसिया में रोजगार शिविर एवं संवाद #विकास #रोजगार',
    event_type: 'employment',
    event_type_confidence: 0.88,
    locations: [{ name: 'खरसिया', district: 'रायगढ़' }],
    people_mentioned: ['@TeamKharasia'],
    organizations: ['खरसिया विकास समिति'],
    schemes_mentioned: ['रोजगार गारंटी योजना', 'विकास सुरक्षा मिशन'],
    overall_confidence: 0.85,
    needs_review: false,
    review_status: 'approved',
  },
];

// Provide a deterministic fetch polyfill for component tests (suites can override as needed)
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn((input?: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input?.toString?.() ?? '';
    if (url.includes('/api/parsed-events')) {
      return Promise.resolve(
        createMockResponse({
          success: true,
          events: SAMPLE_EVENTS,
          count: SAMPLE_EVENTS.length,
          total: SAMPLE_EVENTS.length,
          total_op_choudhary: SAMPLE_EVENTS.length,
        }),
      );
    }
    if (url.includes('/api/all-tweets')) {
      return Promise.resolve(
        createMockResponse({
          success: true,
          tweets: SAMPLE_EVENTS.map((event) => ({
            ...event,
            is_parsed: true,
            parsed_data: event,
          })),
          total: SAMPLE_EVENTS.length,
          parsed: SAMPLE_EVENTS.length,
          unparsed: 0,
        }),
      );
    }
    return Promise.resolve(createMockResponse({ success: true }));
  }) as jest.Mock;
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

// Mock Recharts ResponsiveContainer to provide deterministic width/height in jsdom
const React = require('react');
jest.mock('recharts', () => {
  const Recharts = jest.requireActual('recharts');
  const MockResponsiveContainer = ({ width, height, children }) => {
    const resolvedWidth = typeof width === 'number' ? width : 600;
    const resolvedHeight = typeof height === 'number' ? height : 400;
    return React.createElement(
      'div',
      {
        style: {
          width: resolvedWidth,
          height: resolvedHeight,
        },
        'data-testid': 'mock-responsive-container',
      },
      typeof children === 'function' ? children({ width: resolvedWidth, height: resolvedHeight }) : children,
    );
  };
  return {
    ...Recharts,
    ResponsiveContainer: MockResponsiveContainer,
  };
});
