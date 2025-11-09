import { GET } from '@/app/api/labs-v2/parsed-events/next/route';
import pool from '@/lib/db';

// Mock the database pool
jest.mock('@/lib/db', () => ({
  connect: jest.fn(),
}));

const mockQuery = jest.fn();
const mockRelease = jest.fn();

describe('/api/labs-v2/parsed-events/next Route Handler', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    (pool.connect as jest.Mock).mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
  });

  test('should return the next pending event if one exists', async () => {
    const mockEvent = {
      id: 'evt-456',
      raw_tweet_text: 'This is a test tweet for review.',
      review_status: 'pending',
      created_at: new Date().toISOString(),
      locations: [{ name: 'Test Location' }],
      event_type: 'Test Event',
      people: [{ name: 'Test Person' }],
      schemes: [{ name: 'Test Scheme' }],
    };
    mockQuery.mockResolvedValue({ rows: [mockEvent] });

    const req = {} as Request;
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe('evt-456');
    expect(body.tweetText).toBe('This is a test tweet for review.');
    expect(body.parsed.location).toBe('Test Location');
    expect(mockQuery).toHaveBeenCalledWith(
      `SELECT * FROM parsed_events WHERE review_status = 'pending' ORDER BY created_at ASC LIMIT 1`
    );
    expect(mockRelease).toHaveBeenCalled();
  });

  test('should return 404 if no pending events are found', async () => {
    mockQuery.mockResolvedValue({ rows: [] }); // No rows returned

    const req = {} as Request;
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.message).toBe('No events pending review.');
    expect(mockRelease).toHaveBeenCalled();
  });

  test('should return 500 if the database query fails', async () => {
    const dbError = new Error('Database connection failed');
    mockQuery.mockRejectedValue(dbError);

    const req = {} as Request;
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch event from database.');
    expect(mockRelease).toHaveBeenCalled();
  });
});
