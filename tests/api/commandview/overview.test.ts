import { NextRequest } from 'next/server';
import { Pool } from 'pg';

jest.mock('pg', () => ({
  Pool: jest.fn(),
}));

jest.mock('@/lib/health/system-health', () => ({
  buildSystemHealthResponse: jest.fn().mockResolvedValue({
    payload: { status: 'healthy', services: {}, frontend: {}, uptime_seconds: 1, version: 'test', timestamp: '2025-11-08T00:00:00.000Z' },
  }),
}));

describe('/api/commandview/overview', () => {
  let mockQuery: jest.Mock;

  beforeEach(() => {
    mockQuery = jest.fn();
    (Pool as unknown as jest.Mock).mockReturnValue({ query: mockQuery });
  });

  it('returns summary data and recent reviews', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ needs_review: 5, approved: 20, rejected: 2, edited: 3, auto_approved: 10, avg_confidence: 0.82 }],
      })
      .mockResolvedValueOnce({
        rows: [{ tweet_id: '111', event_type: 'rally', review_status: 'approved', reviewed_at: '2025-11-07T10:00:00Z', reviewer: 'ops' }],
      });

    const { GET } = await import('@/app/api/commandview/overview/route');
    const response = await GET(new NextRequest('http://localhost/api/commandview/overview'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.needs_review).toBe(5);
    expect(body.recent_reviews).toHaveLength(1);
  });
});
