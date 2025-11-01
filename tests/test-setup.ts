import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder in Jest environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Polyfill for ReadableStream in Jest environment
if (typeof global.ReadableStream === 'undefined') {
  const { ReadableStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
}

// Polyfill for MessagePort in Jest environment
if (typeof global.MessagePort === 'undefined') {
  const { MessagePort } = require('worker_threads');
  global.MessagePort = MessagePort;
}

// Polyfill for Request/Response in Jest environment
if (typeof global.Request === 'undefined') {
  const { Request, Response } = require('undici');
  global.Request = Request;
  global.Response = Response;
}

// Polyfill for fetch in Jest environment (required by E2E tests)
if (typeof global.fetch === 'undefined') {
  const { fetch } = require('undici');
  global.fetch = fetch;
}

// Polyfill for ResizeObserver used by Recharts ResponsiveContainer
if (typeof (global as any).ResizeObserver === 'undefined') {
  (global as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Polyfill clearImmediate for undici timers in jsdom
if (typeof (global as any).clearImmediate === 'undefined') {
  (global as any).clearImmediate = (id: any) => clearTimeout(id as any);
}

// Ensure performance.markResourceTiming exists (noop)
if (typeof (global as any).performance === 'undefined') {
  (global as any).performance = { now: () => Date.now() } as any;
}
if (typeof (global as any).performance.markResourceTiming === 'undefined') {
  (global as any).performance.markResourceTiming = () => {};
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
