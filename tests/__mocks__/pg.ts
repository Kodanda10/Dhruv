/**
 * Mock for pg (PostgreSQL) module
 * Used for testing API routes that use database connections
 */

const mockQuery = jest.fn();
const mockEnd = jest.fn();

export class Pool {
  query = mockQuery;
  end = mockEnd;
  
  constructor(config?: any) {
    // Constructor does nothing, query/end methods are already set
  }
}

// Export mock functions so tests can control them
export const getMockQuery = () => mockQuery;
export const getMockEnd = () => mockEnd;
export const resetMocks = () => {
  mockQuery.mockReset();
  mockEnd.mockReset();
};


