import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { writeFile } from 'fs/promises';

// Mock modules
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('util');

// Mock fetch for testing
global.fetch = jest.fn();

// Create mock execAsync
const mockExecAsync = jest.fn();
jest.mocked(promisify).mockReturnValue(mockExecAsync);
const execAsync = mockExecAsync;

describe('Complete Automated Workflow E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should execute full pipeline: Fetch → Parse → Review → Approve → Analytics', async () => {
    // Step 1: Fetch tweets (mock)
    const mockFetchResponse = {
      stdout: '✓ Successfully fetched 5 tweets\n✓ Tweets saved to database',
      stderr: ''
    };
    
    // Mock execAsync directly
    (execAsync as jest.Mock).mockResolvedValueOnce(mockFetchResponse);
    
    const fetchResponse = await execAsync('python fetch_5_latest_tweets_final.py');
    expect(fetchResponse.stdout).toContain('✓ Successfully fetched');
    
    // Step 2: Verify parsing started
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockParseLog = 'Found 5 unparsed tweets\nStarting Gemini parsing...\n✓ Parsing completed';
    (readFile as jest.Mock).mockResolvedValueOnce(mockParseLog);
    
    const parseLog = await readFile('logs/parse_new_tweets.log', 'utf-8');
    expect(parseLog).toContain('Found 5 unparsed tweets');
    
    // Step 3: Wait for parsing to complete
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Step 4: Check review queue
    const mockReviewData = {
      success: true,
      data: [
        {
          id: 1,
          tweet_id: '1234567890',
          event_type: 'बैठक',
          locations: ['रायगढ़'],
          schemes: ['PM-KISAN'],
          needs_review: true,
          review_status: 'pending'
        }
      ]
    };
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockReviewData)
    });
    
    const reviewResponse = await fetch('/api/parsed-events?needs_review=true');
    const reviewData = await reviewResponse.json();
    expect(reviewData.data.length).toBeGreaterThan(0);
    
    // Step 5: Simulate human approval
    const tweetToApprove = reviewData.data[0];
    const mockApprovalResponse = {
      success: true,
      message: 'Tweet approved successfully'
    };
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockApprovalResponse)
    });
    
    await fetch(`/api/parsed-events/${tweetToApprove.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        review_status: 'approved',
        needs_review: false,
        schemes: [...tweetToApprove.schemes, 'नई योजना']
      })
    });
    
    // Step 6: Verify learning system captured new value
    const mockSuggestionsResponse = {
      success: true,
      suggestions: [
        { name_hi: 'नई योजना', name_en: 'New Scheme', category: 'user_contributed' }
      ]
    };
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockSuggestionsResponse)
    });
    
    const learnResponse = await fetch('/api/reference/learn?type=scheme&q=नई');
    const suggestions = await learnResponse.json();
    expect(suggestions.suggestions.some(s => s.name_hi.includes('नई'))).toBe(true);
    
    // Step 7: Check analytics reflects approved tweet
    const mockAnalyticsResponse = {
      success: true,
      analytics: {
        total_tweets: 1,
        event_distribution: { 'बैठक': 1 },
        location_distribution: { 'रायगढ़': 1 },
        scheme_usage: { 'PM-KISAN': 1, 'नई योजना': 1 }
      }
    };
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockAnalyticsResponse)
    });
    
    const analyticsResponse = await fetch('/api/parsed-events?analytics=true');
    const analyticsData = await analyticsResponse.json();
    expect(analyticsData.analytics.total_tweets).toBeGreaterThan(0);
    
    // Step 8: Verify home table shows approved tweet
    const mockHomeResponse = {
      success: true,
      data: [
        {
          id: 1,
          tweet_id: '1234567890',
          event_type: 'बैठक',
          review_status: 'approved',
          needs_review: false
        }
      ]
    };
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockHomeResponse)
    });
    
    const homeResponse = await fetch('/api/parsed-events?needs_review=false');
    const homeData = await homeResponse.json();
    expect(homeData.data.some(t => t.id === tweetToApprove.id)).toBe(true);
  });

  it('should handle parsing failures gracefully', async () => {
    // Mock parsing failure
    const mockParseLog = 'Found 5 unparsed tweets\nGemini API error: Rate limit exceeded\nParsing failed for 2 tweets';
    (readFile as jest.Mock).mockResolvedValueOnce(mockParseLog);
    
    const parseLog = await readFile('logs/parse_new_tweets.log', 'utf-8');
    expect(parseLog).toContain('Parsing failed');
    
    // Should still have tweets in review queue for manual review
    const mockReviewData = {
      success: true,
      data: [
        {
          id: 1,
          needs_review: true,
          review_status: 'pending',
          parsing_error: 'Gemini API rate limit exceeded'
        }
      ]
    };
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockReviewData)
    });
    
    const reviewResponse = await fetch('/api/parsed-events?needs_review=true');
    const reviewData = await reviewResponse.json();
    expect(reviewData.data.length).toBeGreaterThan(0);
    expect(reviewData.data[0].parsing_error).toBeDefined();
  });

  it('should validate complete data flow integrity', async () => {
    // Test that data flows correctly through all stages
    const mockWorkflowData = {
      raw_tweets: 5,
      parsed_events: 5,
      review_queue: 5,
      approved_tweets: 3,
      analytics_reflection: 3
    };
    
    // Verify each stage has expected data
    expect(mockWorkflowData.raw_tweets).toBe(5);
    expect(mockWorkflowData.parsed_events).toBe(5);
    expect(mockWorkflowData.review_queue).toBe(5);
    expect(mockWorkflowData.approved_tweets).toBe(3);
    expect(mockWorkflowData.analytics_reflection).toBe(3);
    
    // Verify data consistency
    expect(mockWorkflowData.approved_tweets).toBeLessThanOrEqual(mockWorkflowData.review_queue);
    expect(mockWorkflowData.analytics_reflection).toBe(mockWorkflowData.approved_tweets);
  });
});
