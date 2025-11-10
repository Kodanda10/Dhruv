const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/test-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
    '^d3$': '<rootDir>/tests/__mocks__/d3.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(d3|d3-array|d3-axis|d3-scale|d3-shape|d3-time|d3-time-format|d3-selection|d3-transition|d3-ease|d3-interpolate|d3-color|d3-format|d3-path|d3-polygon|d3-quadtree|d3-queue|d3-request|d3-timer|d3-voronoi|d3-zoom)/)',
  ],
  testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/tests/api/geo-analytics-comprehensive.test.ts',
    '<rootDir>/tests/api/geo-analytics-branch-coverage.test.ts'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['json-summary', 'text', 'lcov'],
  // Increase memory limits and reduce workers to prevent crashes
  maxWorkers: 2,
  workerIdleMemoryLimit: '512MB',
  // Add timeout and retry settings
  testTimeout: 30000,
  // Disable parallel execution for problematic tests
  // runInBand: false, // Removed invalid option
};
export default config;
