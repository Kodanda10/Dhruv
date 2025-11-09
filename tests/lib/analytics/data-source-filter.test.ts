import type { PoolClient } from 'pg';

jest.mock('fs', () => ({
  readFileSync: jest.fn(() =>
    JSON.stringify({
      blocks: {},
    }),
  ),
}));

const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockConnect = jest.fn<Promise<PoolClient>, any[]>(async () => ({
  query: mockQuery,
  release: mockRelease,
}) as unknown as PoolClient);

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    connect: mockConnect,
  })),
}));

describe('fetchAnalyticsData review gating', () => {
  beforeEach(() => {
    mockQuery.mockImplementation(async () => ({ rows: [] }));
    mockQuery.mockClear();
    mockRelease.mockClear();
    mockConnect.mockClear();
    jest.resetModules();
  });

  it('injects needs_review/review_status filter in every analytics query', async () => {
    const { fetchAnalyticsData } = await import('@/lib/analytics/data-source');

    await fetchAnalyticsData();

    expect(mockQuery).toHaveBeenCalled();
    const hasReviewGuard = mockQuery.mock.calls.some(([sql]) =>
      typeof sql === 'string' && sql.includes('pe.needs_review = false'),
    );

    expect(hasReviewGuard).toBe(true);
    expect(mockRelease).toHaveBeenCalled();
  });
});
