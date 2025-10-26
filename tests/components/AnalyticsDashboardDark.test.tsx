import { render, screen, waitFor } from '@testing-library/react';
import AnalyticsDashboardDark from '@/components/analytics/AnalyticsDashboardDark';

// Mock fetch globally
global.fetch = jest.fn();

describe('AnalyticsDashboardDark', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should only show approved tweets in analytics', async () => {
    // Mock data: 5 approved, 3 pending
    const mockData = {
      success: true,
      analytics: {
        total_tweets: 5,
        event_distribution: {
          'बैठक': 2,
          'रैली': 1,
          'निरीक्षण': 2
        },
        location_distribution: {
          'रायगढ़': 3,
          'बिलासपुर': 2
        },
        scheme_usage: {
          'PM-KISAN': 2,
          'मुख्यमंत्री किसान योजना': 1
        },
        timeline: [],
        day_of_week_distribution: [
          { day: 'सोमवार', count: 1 },
          { day: 'मंगलवार', count: 2 },
          { day: 'बुधवार', count: 2 }
        ]
      },
      raw_data: [
        // Mock raw tweets, 5 approved
        { tweet_id: '1', review_status: 'approved', parsed: { event_type: 'बैठक', locations: [{ name: 'रायगढ़' }], schemes: ['PM-KISAN'] }, timestamp: '2023-01-01T10:00:00Z' },
        { tweet_id: '2', review_status: 'approved', parsed: { event_type: 'रैली', locations: [{ name: 'रायगढ़' }], schemes: ['मुख्यमंत्री किसान योजना'] }, timestamp: '2023-01-02T11:00:00Z' },
        { tweet_id: '3', review_status: 'approved', parsed: { event_type: 'बैठक', locations: [{ name: 'बिलासपुर' }], schemes: ['PM-KISAN'] }, timestamp: '2023-01-03T12:00:00Z' },
        { tweet_id: '4', review_status: 'approved', parsed: { event_type: 'निरीक्षण', locations: [{ name: 'रायगढ़' }] }, timestamp: '2023-01-04T13:00:00Z' },
        { tweet_id: '5', review_status: 'approved', parsed: { event_type: 'निरीक्षण', locations: [{ name: 'बिलासपुर' }] }, timestamp: '2023-01-05T14:00:00Z' },
        // 3 pending tweets (should not be counted in analytics)
        { tweet_id: '6', review_status: 'pending', parsed: { event_type: 'अन्य' }, timestamp: '2023-01-06T15:00:00Z' },
        { tweet_id: '7', review_status: 'pending', parsed: { event_type: 'अन्य' }, timestamp: '2023-01-07T16:00:00Z' },
        { tweet_id: '8', review_status: 'pending', parsed: { event_type: 'अन्य' }, timestamp: '2023-01-08T17:00:00Z' },
      ]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<AnalyticsDashboardDark />);

    await waitFor(() => {
      // Should only count 5 approved
      expect(screen.getByText('5')).toBeInTheDocument(); // Total tweets count
    });
  });

  it('should display event type distribution chart', async () => {
    const mockData = {
      success: true,
      analytics: {
        total_tweets: 3,
        event_distribution: {
          'बैठक': 2,
          'रैली': 1
        },
        location_distribution: {},
        scheme_usage: {},
        timeline: [],
        day_of_week_distribution: []
      },
      raw_data: [
        { event_type: 'बैठक', review_status: 'approved' },
        { event_type: 'बैठक', review_status: 'approved' },
        { event_type: 'रैली', review_status: 'approved' }
      ]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<AnalyticsDashboardDark />);

    await waitFor(() => {
      expect(screen.getByText('बैठक: 2%, रैली: 1%')).toBeInTheDocument();
    });
  });

  it('should show scheme usage statistics', async () => {
    const mockData = {
      success: true,
      analytics: {
        total_tweets: 2,
        event_distribution: {},
        location_distribution: {},
        scheme_usage: {
          'PM-KISAN': 2,
          'मुख्यमंत्री किसान योजना': 1
        },
        timeline: [],
        day_of_week_distribution: []
      },
      raw_data: []
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<AnalyticsDashboardDark />);

    await waitFor(() => {
      // Should show scheme count in key insights (2 schemes mentioned)
      expect(screen.getByText(/उल्लिखित योजनाएं/i)).toBeInTheDocument(); // Schemes mentioned label
    });
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<AnalyticsDashboardDark />);

    await waitFor(() => {
      expect(screen.getByText('❌ Failed to load analytics data')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<AnalyticsDashboardDark />);

    expect(screen.getByText('एनालिटिक्स डेटा लोड हो रहा है...')).toBeInTheDocument();
  });

  it('should display key insights correctly', async () => {
    const mockData = {
      success: true,
      analytics: {
        total_tweets: 10,
        event_distribution: {
          'बैठक': 5,
          'रैली': 3,
          'निरीक्षण': 2
        },
        location_distribution: {
          'रायगढ़': 6,
          'बिलासपुर': 4
        },
        scheme_usage: {
          'PM-KISAN': 3,
          'मुख्यमंत्री किसान योजना': 2
        },
        timeline: [],
        day_of_week_distribution: []
      },
      raw_data: []
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<AnalyticsDashboardDark />);

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument(); // Total tweets
      // Check for specific text patterns instead of ambiguous text
      expect(screen.getByText(/अद्वितीय स्थान/i)).toBeInTheDocument(); // Unique locations label
      expect(screen.getByText(/उल्लिखित योजनाएं/i)).toBeInTheDocument(); // Schemes mentioned label
      expect(screen.getByText(/सबसे आम घटना/i)).toBeInTheDocument(); // Most common event label
    });
  });
});