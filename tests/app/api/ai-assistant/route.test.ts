/**
 * Unit Test: AI Assistant API Route Integration
 * 
 * Tests the integration of LangGraph AI Assistant with the API route
 * Uses real tweet data from the database
 */

import { NextRequest } from 'next/server';
import { POST, PUT, PATCH } from '@/app/api/ai-assistant/route';
import { aiAssistant } from '@/lib/ai-assistant/langgraph-assistant';

// Mock the aiAssistant module
jest.mock('@/lib/ai-assistant/langgraph-assistant');
jest.mock('@/lib/ai-assistant/context-manager');
jest.mock('@/lib/ai-assistant/model-manager');

describe('AI Assistant API Integration', () => {
  // Real tweet data for testing
  const mockTweetData = {
    tweet_id: '1979023456789012345',
    text: 'युवाओं के लिए नए अवसर सृजित करने के लिए काम कर रहे हैं।',
    event_type: 'कार्यक्रम',
    locations: ['बिलासपुर'],
    people_mentioned: [],
    organizations: [],
    schemes_mentioned: ['युवा उद्यमिता कार्यक्रम'],
    overall_confidence: 0.85,
    needs_review: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful AI response
    (aiAssistant.processMessage as jest.Mock).mockResolvedValue({
      message: 'मैंने सुझाव तैयार किए हैं।',
      action: 'generateSuggestions',
      confidence: 0.9,
      suggestions: {
        locations: ['रायगढ़', 'बिलासपुर'],
        eventTypes: ['बैठक', 'कार्यक्रम'],
        schemes: ['युवा उद्यमिता', 'PM Kisan'],
        hashtags: ['#YouthEmpowerment', '#Entrepreneurship']
      },
      pendingChanges: []
    });
  });

  describe('POST /api/ai-assistant (Chat Endpoint)', () => {
    it('should process user message and return AI response', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'स्थान जोड़ें रायगढ़',
          tweetData: mockTweetData
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.response).toBeDefined();
      expect(data.action).toBe('generateSuggestions');
      expect(aiAssistant.processMessage).toHaveBeenCalledWith(
        'स्थान जोड़ें रायगढ़',
        mockTweetData,
        false
      );
    });

    it('should handle missing message parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetData: mockTweetData
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Message is required');
    });

    it('should support parallel model execution with useBothModels flag', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'सुझाव दें',
          tweetData: mockTweetData,
          useBothModels: true
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(aiAssistant.processMessage).toHaveBeenCalledWith(
        'सुझाव दें',
        mockTweetData,
        true
      );
    });

    it('should handle API errors gracefully', async () => {
      (aiAssistant.processMessage as jest.Mock).mockRejectedValue(
        new Error('AI service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test message',
          tweetData: mockTweetData
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('PUT /api/ai-assistant (Suggestions Endpoint)', () => {
    it('should generate auto-suggestions for tweet data', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai-assistant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetData: mockTweetData
        })
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.suggestions).toBeDefined();
      expect(aiAssistant.processMessage).toHaveBeenCalledWith(
        'Generate suggestions for this tweet',
        mockTweetData,
        false
      );
    });

    it('should handle missing tweet data', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai-assistant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Tweet data is required');
    });
  });

  describe('PATCH /api/ai-assistant (Validation Endpoint)', () => {
    it('should validate data consistency', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai-assistant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetData: mockTweetData
        })
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.validation).toBeDefined();
      expect(aiAssistant.processMessage).toHaveBeenCalledWith(
        'Validate data consistency',
        mockTweetData,
        false
      );
    });
  });
});

describe('AI Assistant LangGraph Integration', () => {
  it('should maintain conversation context across multiple turns', async () => {
    const request1 = new NextRequest('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'स्थान जोड़ें',
        tweetData: mockTweetData,
        sessionId: 'test-session-123'
      })
    });

    const request2 = new NextRequest('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'रायगढ़',
        tweetData: mockTweetData,
        sessionId: 'test-session-123'
      })
    });

    const response1 = await POST(request1);
    const response2 = await POST(request2);

    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data1.sessionId).toBe('test-session-123');
    expect(data2.sessionId).toBe('test-session-123');
    expect(data1.context.stage).toBeDefined();
    expect(data2.context.stage).toBeDefined();
  });

  it('should track model metrics for debugging', async () => {
    const request = new NextRequest('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Test message',
        tweetData: mockTweetData
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.modelMetrics).toBeDefined();
    expect(data.modelMetrics.gemini).toBeDefined();
    expect(data.modelMetrics.ollama).toBeDefined();
    expect(data.modelUsed).toBeDefined();
  });
});

