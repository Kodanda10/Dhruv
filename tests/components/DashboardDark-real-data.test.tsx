import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardDark from '@/components/DashboardDark';

// Mock the API
global.fetch = jest.fn();

describe('DashboardDark - Real Database Data Integration', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should use real database data from serverRows instead of fallback parsedTweets', async () => {
    // Mock real database data
    const mockDatabaseData = [
      {
        id: 64,
        tweet_id: "1976266190033940622",
        event_type: "बैठक",
        event_date: "2025-01-27T10:30:00.000Z",
        locations: ["रायगढ़"],
        people_mentioned: ["मुख्यमंत्री"],
        organizations: ["भाजपा"],
        schemes_mentioned: ["मुख्यमंत्री किसान योजना"],
        overall_confidence: "0.92",
        needs_review: false,
        review_status: "approved",
        parsed_at: "2025-01-27T10:30:00.000Z",
        parsed_by: "gemini"
      },
      {
        id: 63,
        tweet_id: "1976473052939760117",
        event_type: "कार्यक्रम",
        event_date: "2025-01-27T09:15:00.000Z",
        locations: ["बिलासपुर"],
        people_mentioned: [],
        organizations: ["सरकार"],
        schemes_mentioned: ["युवा उद्यमिता कार्यक्रम"],
        overall_confidence: "0.88",
        needs_review: true,
        review_status: "pending",
        parsed_at: "2025-01-27T09:15:00.000Z",
        parsed_by: "gemini"
      }
    ];

    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockDatabaseData
      })
    });

    render(<DashboardDark />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/दिखा रहे हैं: 2 \/ 2/)).toBeInTheDocument();
    });

    // Verify that real database data is displayed
    expect(screen.getByText('रायगढ़')).toBeInTheDocument();
    expect(screen.getByText('मुख्यमंत्री किसान योजना')).toBeInTheDocument();
    expect(screen.getByText('युवा उद्यमिता कार्यक्रम')).toBeInTheDocument();

    // Verify API was called
    expect(global.fetch).toHaveBeenCalledWith('/api/parsed-events?limit=200', {
      headers: { 'Content-Type': 'application/json' },
      method: 'GET'
    });
  });

  it('should fallback to parsedTweets only when API fails', async () => {
    // Mock API failure
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    render(<DashboardDark />);

    // Wait for fallback data to load
    await waitFor(() => {
      expect(screen.getByText(/दिखा रहे हैं: 55 \/ 55/)).toBeInTheDocument();
    });

    // Verify fallback data is displayed
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    expect(screen.getByText('युवा उद्यमिता कार्यक्रम')).toBeInTheDocument();
  });

  it('should prioritize serverRows over parsedTweets when both are available', async () => {
    const mockDatabaseData = [
      {
        id: 1,
        tweet_id: "real_tweet_123",
        event_type: "बैठक",
        event_date: "2025-01-27T10:30:00.000Z",
        locations: ["रायपुर"],
        people_mentioned: [],
        organizations: [],
        schemes_mentioned: ["नई योजना"],
        overall_confidence: "0.95",
        needs_review: false,
        review_status: "approved",
        parsed_at: "2025-01-27T10:30:00.000Z",
        parsed_by: "gemini"
      }
    ];

    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockDatabaseData
      })
    });

    render(<DashboardDark />);

    // Wait for real data to load
    await waitFor(() => {
      expect(screen.getByText(/दिखा रहे हैं: 1 \/ 1/)).toBeInTheDocument();
    });

    // Verify real database data is displayed (not fallback)
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText('नई योजना')).toBeInTheDocument();
    
    // Should NOT show fallback data
    expect(screen.queryByText('बिलासपुर')).not.toBeInTheDocument();
  });
});
