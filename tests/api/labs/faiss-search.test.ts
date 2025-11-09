import { GET } from '@/app/api/labs/faiss/search/route';
import * as faissSearch from '@/labs/faiss/search';

// Mock the faiss search module
jest.mock('@/labs/faiss/search');
const mockedFaissSearch = faissSearch as jest.Mocked<typeof faissSearch>;

describe('/api/labs/faiss/search Route Handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('[F-API-8] success case: should call search and return 200 with results', async () => {
    const mockResults = [{ id: '1', score: 0.9, name: 'Test Location' }];
    mockedFaissSearch.search.mockResolvedValue(mockResults);

    const req = {
      method: 'GET',
      headers: new Headers({ 'x-trace-id': 'test-trace-id' }),
      url: 'http://localhost/api/labs/faiss/search?q=test&limit=5',
    } as Request;

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockResults);
    expect(mockedFaissSearch.search).toHaveBeenCalledWith('test', 5);
  });

  test('[F-API-8] validation failure: should return 400 if query is missing', async () => {
    const req = {
      method: 'GET',
      headers: new Headers({ 'x-trace-id': 'test-trace-id' }),
      url: 'http://localhost/api/labs/faiss/search', // No query params
    } as Request;

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Query parameter "q" is required.' });
    expect(mockedFaissSearch.search).not.toHaveBeenCalled();
  });

  test('[F-API-8] script error: should return 500 if search function fails', async () => {
    const searchError = new Error('FAISS script failed');
    mockedFaissSearch.search.mockRejectedValue(searchError);

    const req = {
      method: 'GET',
      headers: new Headers({ 'x-trace-id': 'test-trace-id' }),
      url: 'http://localhost/api/labs/faiss/search?q=error',
    } as Request;

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'An error occurred during the search.' });
  });
});