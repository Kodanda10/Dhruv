import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder in Jest environment
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
