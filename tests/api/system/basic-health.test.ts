import { NextRequest } from 'next/server';

jest.mock('@/lib/health/system-health', () => ({
  buildSystemHealthResponse: jest.fn(),
}));

const mockBuildResponse = jest.requireMock('@/lib/health/system-health')
  .buildSystemHealthResponse as jest.Mock;

describe('/api/health summary endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ok status and traceId when overall health is healthy', async () => {
    const { GET } = await import('@/app/api/health/route');

    mockBuildResponse.mockResolvedValue({
      payload: {
        status: 'healthy',
        services: {
          database: { status: 'healthy' },
          twitter_api: { status: 'healthy' },
          gemini_api: { status: 'healthy' },
          ollama_api: { status: 'healthy' },
        },
        frontend: {
          build_status: 'green',
          last_build: 'abc123',
          bundle_size: 'optimized',
        },
        uptime_seconds: 42,
        version: 'test',
        timestamp: '2025-11-07T00:00:00.000Z',
      },
      statusCode: 200,
    });

    const response = await GET(new NextRequest('http://localhost/api/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(typeof body.traceId).toBe('string');
    expect(body.flags.database).toBe('healthy');
    expect(body.services.database.status).toBe('healthy');
  });

  it('bubbles degraded/unhealthy states with matching HTTP codes', async () => {
    const { GET } = await import('@/app/api/health/route');

    mockBuildResponse.mockResolvedValue({
      payload: {
        status: 'unhealthy',
        services: {
          database: { status: 'unhealthy', error: 'offline' },
          twitter_api: { status: 'healthy' },
          gemini_api: { status: 'healthy' },
          ollama_api: { status: 'healthy' },
        },
        frontend: {
          build_status: 'yellow',
          last_build: 'abc123',
          bundle_size: 'ok',
        },
        uptime_seconds: 10,
        version: 'test',
        timestamp: '2025-11-07T00:00:05.000Z',
      },
      statusCode: 503,
    });

    const response = await GET(new NextRequest('http://localhost/api/health'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.flags.database).toBe('unhealthy');
    expect(body.services.database.error).toBe('offline');
  });
});
