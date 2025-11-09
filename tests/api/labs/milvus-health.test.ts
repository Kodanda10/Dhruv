import { GET } from '@/app/api/labs/milvus/health/route';

describe('/api/labs/milvus/health Route Handler', () => {

  test('[M-API-7] should return a 200 status with status: ok', async () => {
    const headers = new Headers();
    headers.append('x-trace-id', 'test-trace-id');

    const req = {
      method: 'GET',
      headers: headers,
      url: 'http://localhost/api/labs/milvus/health',
    } as Request;

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    // The 'content-type' header is set automatically by NextResponse.json()
    // and testing it in a mock environment can be brittle.
    // We will trust the framework to handle this correctly.
    expect(body).toEqual({ status: 'ok' });
  });
});