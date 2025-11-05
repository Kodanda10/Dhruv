const config = {
  projects: [
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/test-setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
      },
      testTimeout: 3600000, // 1 hour for comprehensive tests
    },
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
      testPathIgnorePatterns: ['/integration/'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/test-setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
      },
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
        '^.+\\.(js|jsx)$': 'babel-jest',
      },
      coverageDirectory: '<rootDir>/coverage',
      coverageReporters: ['json-summary', 'text', 'lcov'],
    },
  ],
};
export default config;
