import { sampleAnalyticsData } from '../../../lib/analytics/sample-data';

const globalAny = globalThis as any;

class TestHeaders {
  private map = new Map<string, string>();

  constructor(init?: Record<string, string>) {
    if (init) {
      Object.entries(init).forEach(([key, value]) => this.set(key, value));
    }
  }

  get(name: string) {
    return this.map.get(name.toLowerCase()) ?? null;
  }

  set(name: string, value: string) {
    this.map.set(name.toLowerCase(), value);
  }
}

class TestResponse {
  headers: TestHeaders;
  status: number;
  private body: Buffer;

  constructor(body?: any, init: { headers?: Record<string, string>; status?: number } = {}) {
    if (body instanceof Uint8Array) {
      this.body = Buffer.from(body);
    } else if (typeof body === 'string') {
      this.body = Buffer.from(body, 'utf-8');
    } else if (!body) {
      this.body = Buffer.alloc(0);
    } else {
      this.body = Buffer.from(body);
    }

    this.status = init.status ?? 200;
    this.headers = new TestHeaders(init.headers);
  }

  async text() {
    return this.body.toString('utf-8');
  }

  async json() {
    return JSON.parse(this.body.toString('utf-8') || '{}');
  }

  async arrayBuffer() {
    return this.body.buffer.slice(this.body.byteOffset, this.body.byteOffset + this.body.byteLength);
  }
}

globalAny.Response = globalAny.Response || TestResponse;
globalAny.Headers = globalAny.Headers || TestHeaders;

jest.mock('exceljs');
jest.mock('pdfkit');

jest.mock('@/lib/analytics/data-source', () => ({
  fetchAnalyticsData: jest.fn().mockResolvedValue(sampleAnalyticsData),
}));

import { GET } from '@/app/api/analytics/export/route';

describe('/api/analytics/export route', () => {
  const baseUrl = 'https://example.com/api/analytics/export';

  const makeRequest = (query: string) => ({ url: `${baseUrl}?${query}` }) as Request;

  it('returns JSON payload by default', async () => {
    const request = makeRequest('');
    const response = await GET(request);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.total_tweets).toBe(2504);
  });

  it('returns CSV attachment', async () => {
    const request = makeRequest('format=csv');
    const response = await GET(request);
    expect(response.headers.get('content-type')).toContain('text/csv');
    const text = await response.text();
    expect(text).toContain('event_distribution');
  });

  it('returns Excel attachment', async () => {
    const request = makeRequest('format=excel');
    const response = await GET(request);
    expect(response.headers.get('content-type')).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('returns PDF attachment', async () => {
    const request = makeRequest('format=pdf');
    const response = await GET(request);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('rejects unsupported formats', async () => {
    const request = makeRequest('format=txt');
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});
