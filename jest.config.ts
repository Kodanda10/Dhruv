const config = {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/**/*.test.ts?(x)'],
      testPathIgnorePatterns: ['/integration/'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/test-setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
        'mapbox-gl': '<rootDir>/tests/__mocks__/mapbox-gl.js',
        '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/tests/__mocks__/fileMock.js',
      },
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
        '^.+\\.(js|jsx)$': 'babel-jest',
      },
      transformIgnorePatterns: [
        '/node_modules/(?!(d3|internmap|delaunator|robust-predicates)/)',
      ],
      coverageDirectory: '<rootDir>/coverage',
      coverageReporters: ['json-summary', 'text', 'lcov'],
    },
  ],
};
export default config;
