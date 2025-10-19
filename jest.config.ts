const config = {
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
  testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['json-summary', 'text', 'lcov'],
};
export default config;
