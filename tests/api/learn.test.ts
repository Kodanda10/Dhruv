// Mock Next.js server components
const mockNextRequest = jest.fn().mockImplementation((url, init) => ({
  url,
  method: init?.method || 'GET',
  json: () => Promise.resolve(JSON.parse(init?.body || '{}'))
}));

jest.mock('next/server', () => ({
  NextRequest: mockNextRequest,
  NextResponse: {
    json: jest.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200
    }))
  }
}));

// Make NextRequest available globally for tests
(global as any).NextRequest = mockNextRequest;

// Import the API route handlers
import { POST, GET } from '@/app/api/reference/learn/route';

// Mock the database pool - CRITICAL: Must mock at module level before route import
// Create a shared mock query function
const mockQueryFn = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: (...args: any[]) => mockQueryFn(...args)
  }))
}));

// Mock Request and Response for Jest environment
(global as any).Request = jest.fn();
(global as any).Response = jest.fn() as any;

describe('POST /api/reference/learn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save human-added scheme to user_contributed_data', async () => {
    // Mock database responses
    mockQueryFn
      .mockResolvedValueOnce({
        rows: [{ id: 123 }]
      })
      .mockResolvedValueOnce({
        rows: [{ count: '1' }]
      });

    const request = new (mockNextRequest as any)('http://localhost:3000/api/reference/learn', {
      method: 'POST',
      body: JSON.stringify({
        entity_type: 'scheme',
        value_hi: 'नई योजना',
        value_en: 'New Scheme',
        source_tweet_id: 'test_tweet_123'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.contribution_id).toBe(123);
    expect(data.usage_count).toBe(1);
    expect(data.promoted).toBe(false);

    // Verify database calls
    expect(mockQueryFn).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_contributed_data'),
      ['scheme', 'नई योजना', 'New Scheme', [], 'test_tweet_123', 'human']
    );
  });
  
  it('should add to reference tables after 3+ uses', async () => {
    // Mock database responses for 3+ uses
    mockQueryFn
      .mockResolvedValueOnce({
        rows: [{ id: 124 }]
      })
      .mockResolvedValueOnce({
        rows: [{ count: '3' }]
      })
      .mockResolvedValueOnce({
        rows: []
      });

    const request = new (mockNextRequest as any)('http://localhost:3000/api/reference/learn', {
      method: 'POST',
      body: JSON.stringify({
        entity_type: 'event_type',
        value_hi: 'नया कार्यक्रम',
        value_en: 'New Event',
        source_tweet_id: 'test_tweet_124'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.usage_count).toBe(3);
    expect(data.promoted).toBe(true);

    // Verify promotion to reference table
    expect(mockQueryFn).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ref_event_types'),
      expect.arrayContaining(['नया_कार्यक्रम', 'नया कार्यक्रम', 'New Event'])
    );
  });

  it('should handle database errors gracefully', async () => {
    mockQueryFn.mockRejectedValueOnce(new Error('Database error'));

    const request = new (mockNextRequest as any)('http://localhost:3000/api/reference/learn', {
      method: 'POST',
      body: JSON.stringify({
        entity_type: 'scheme',
        value_hi: 'Test',
        source_tweet_id: 'test_tweet_125'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to save contribution');
  });
});

describe('GET /api/reference/learn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return scheme suggestions', async () => {
    mockQueryFn.mockResolvedValueOnce({
      rows: [
        { name_hi: 'प्रधानमंत्री किसान सम्मान निधि', name_en: 'PM-KISAN', category: 'central', usage_count: 5 },
        { name_hi: 'मुख्यमंत्री किसान योजना', name_en: 'CM Kisan Yojana CG', category: 'state', usage_count: 3 }
      ]
    });

    const request = new NextRequest('http://localhost:3000/api/reference/learn?type=scheme&q=किसान');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.suggestions).toHaveLength(2);
    expect(data.suggestions[0].name_hi).toBe('प्रधानमंत्री किसान सम्मान निधि');

    expect(mockQueryFn).toHaveBeenCalledWith(
      expect.stringContaining('SELECT name_hi, name_en, category, usage_count'),
      ['%किसान%']
    );
  });

  it('should return event type suggestions with aliases', async () => {
    mockQueryFn.mockResolvedValueOnce({
      rows: [
        { name_hi: 'बैठक', name_en: 'Meeting', category: 'administrative', usage_count: 8 },
        { name_hi: 'रैली', name_en: 'Rally', category: 'political', usage_count: 6 }
      ]
    });

    const request = new NextRequest('http://localhost:3000/api/reference/learn?type=event_type&q=मुलाकात');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.suggestions).toHaveLength(2);

    expect(mockQueryFn).toHaveBeenCalledWith(
      expect.stringContaining('$1 = ANY(aliases_hi)'),
      ['%मुलाकात%']
    );
  });

  it('should handle empty query', async () => {
    mockQueryFn.mockResolvedValueOnce({
      rows: []
    });

    const request = new NextRequest('http://localhost:3000/api/reference/learn?type=scheme&q=');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.suggestions).toHaveLength(0);
  });

  it('should handle database errors', async () => {
    mockQueryFn.mockRejectedValueOnce(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/reference/learn?type=scheme&q=test');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch suggestions');
  });
});
