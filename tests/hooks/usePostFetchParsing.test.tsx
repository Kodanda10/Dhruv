import { renderHook, act } from '@testing-library/react';
import { usePostFetchParsing } from '@/hooks/usePostFetchParsing';

// Mock fetch
global.fetch = jest.fn();

describe('usePostFetchParsing', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should automatically parse tweets after fetching', async () => {
    const mockTweets = [
      {
        id: 1,
        tweet_id: '1234567890',
        text: 'बिलासपुर में किसान बैठक आयोजित',
        created_at: '2024-01-15T10:00:00Z',
        author_handle: 'test_user'
      }
    ];

    const mockParsedResult = {
      success: true,
      parsed_tweet: {
        id: 1,
        tweet_id: '1234567890',
        event_type: 'बैठक',
        locations: ['बिलासपुर'],
        people_mentioned: [],
        organizations: [],
        schemes_mentioned: [],
        overall_confidence: '0.85',
        needs_review: true,
        review_status: 'pending'
      }
    };

    // Mock fetch for tweets
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTweets })
      })
      // Mock fetch for parsing
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockParsedResult
      });

    const { result } = renderHook(() => usePostFetchParsing());

    // Trigger fetch tweets
    await act(async () => {
      await result.current.fetchTweets();
    });

    // Wait for parsing to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify tweets were fetched
    expect(global.fetch).toHaveBeenCalledWith('/api/tweets');

    // Verify parsing was triggered
    expect(global.fetch).toHaveBeenCalledWith('/api/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tweet_id: '1234567890',
        text: 'बिलासपुर में किसान बैठक आयोजित'
      })
    });

    // Verify parsed tweet is in the result
    expect(result.current.parsedTweets).toHaveLength(1);
    expect(result.current.parsedTweets[0]).toEqual(mockParsedResult.parsed_tweet);
  });

  it('should handle parsing failures gracefully', async () => {
    const mockTweets = [
      {
        id: 1,
        tweet_id: '1234567890',
        text: 'बिलासपुर में किसान बैठक आयोजित',
        created_at: '2024-01-15T10:00:00Z',
        author_handle: 'test_user'
      }
    ];

    // Mock fetch for tweets
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTweets })
      })
      // Mock fetch for parsing - simulate failure
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'Parsing failed' })
      });

    const { result } = renderHook(() => usePostFetchParsing());

    // Trigger fetch tweets
    await act(async () => {
      await result.current.fetchTweets();
    });

    // Wait for parsing to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify tweets were fetched
    expect(global.fetch).toHaveBeenCalledWith('/api/tweets');

    // Verify parsing was attempted
    expect(global.fetch).toHaveBeenCalledWith('/api/parse', expect.any(Object));

    // Verify no parsed tweets due to failure
    expect(result.current.parsedTweets).toHaveLength(0);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]).toContain('Parsing failed');
  });

  it('should not parse tweets that are already parsed', async () => {
    const mockTweets = [
      {
        id: 1,
        tweet_id: '1234567890',
        text: 'बिलासपुर में किसान बैठक आयोजित',
        created_at: '2024-01-15T10:00:00Z',
        author_handle: 'test_user',
        parsed: true // Already parsed
      }
    ];

    // Mock fetch for tweets
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTweets })
      });

    const { result } = renderHook(() => usePostFetchParsing());

    // Trigger fetch tweets
    await act(async () => {
      await result.current.fetchTweets();
    });

    // Wait for parsing to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify tweets were fetched
    expect(global.fetch).toHaveBeenCalledWith('/api/tweets');

    // Verify parsing was NOT triggered for already parsed tweets
    expect(global.fetch).not.toHaveBeenCalledWith('/api/parse', expect.any(Object));

    // Verify no new parsed tweets
    expect(result.current.parsedTweets).toHaveLength(0);
  });

  it('should provide loading state during parsing', async () => {
    const mockTweets = [
      {
        id: 1,
        tweet_id: '1234567890',
        text: 'बिलासपुर में किसान बैठक आयोजित',
        created_at: '2024-01-15T10:00:00Z',
        author_handle: 'test_user'
      }
    ];

    // Mock fetch for tweets
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTweets })
      })
      // Mock fetch for parsing with delay
      .mockImplementationOnce(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ success: true, parsed_tweet: {} })
          }), 200)
        )
      );

    const { result } = renderHook(() => usePostFetchParsing());

    // Trigger fetch tweets
    await act(async () => {
      await result.current.fetchTweets();
    });

    // Check loading state during parsing (should be true immediately after fetch)
    expect(result.current.isParsing).toBe(true);

    // Wait for parsing to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    // Check loading state after parsing
    expect(result.current.isParsing).toBe(false);
  });
});
