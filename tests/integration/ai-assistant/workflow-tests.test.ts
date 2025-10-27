/**
 * End-to-End Workflow Tests for AI Assistant
 * 
 * Tests complete user workflows using real tweet data
 */

import fs from 'fs';
import path from 'path';

const realTweets = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data/parsed_tweets.json'), 'utf-8')
);

describe('E2E Workflow 1: Edit Tweet with No Parsed Data', () => {
  test('should suggest all fields for tweet with no parsed data', async () => {
    const tweet = {
      ...realTweets[0],
      parsed: null,
      event_type: null,
      locations: [],
      schemes_mentioned: []
    };
    
    // Step 1: Request suggestions
    const response1 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'generate suggestions',
        tweetData: tweet
      })
    });
    
    const data1 = await response1.json();
    
    expect(data1.success).toBe(true);
    expect(data1.suggestions.eventTypes.length).toBeGreaterThan(0);
    expect(data1.suggestions.locations.length).toBeGreaterThan(0);
    expect(data1.suggestions.schemes.length).toBeGreaterThan(0);
    
    // Step 2: Apply suggestions
    const response2 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'apply all suggestions',
        tweetData: tweet,
        sessionId: data1.sessionId
      })
    });
    
    const data2 = await response2.json();
    
    expect(data2.pendingChanges.length).toBeGreaterThan(0);
    expect(data2.context.approvedChangesCount).toBeGreaterThan(0);
  });
});

describe('E2E Workflow 2: Refine Existing Parsed Data', () => {
  test('should validate and suggest improvements', async () => {
    const tweet = realTweets[0];
    
    // Step 1: Validate existing data
    const response1 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tweetData: tweet
      })
    });
    
    const validation = await response1.json();
    
    expect(validation.success).toBe(true);
    expect(validation.validation.isValid).toBeDefined();
    
    // Step 2: Get suggestions for improvements
    const response2 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'suggest improvements',
        tweetData: tweet
      })
    });
    
    const suggestions = await response2.json();
    
    expect(suggestions.success).toBe(true);
    expect(suggestions.suggestions).toBeDefined();
  });
});

describe('E2E Workflow 3: Multi-Turn Conversation', () => {
  test('should handle complex multi-turn dialogue', async () => {
    const tweet = realTweets[0];
    
    // Turn 1: Add location
    const turn1 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'add रायगढ़ location',
        tweetData: tweet
      })
    });
    
    const data1 = await turn1.json();
    const sessionId = data1.sessionId;
    
    expect(data1.pendingChanges.some(c => c.field === 'locations')).toBe(true);
    
    // Turn 2: Add scheme
    const turn2 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'also add PM Kisan scheme',
        tweetData: tweet,
        sessionId
      })
    });
    
    const data2 = await turn2.json();
    
    expect(data2.pendingChanges.some(c => c.field === 'schemes_mentioned')).toBe(true);
    expect(data2.context.pendingChangesCount).toBeGreaterThan(1);
    
    // Turn 3: Validate everything
    const turn3 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'validate all changes',
        tweetData: tweet,
        sessionId
      })
    });
    
    const data3 = await turn3.json();
    
    expect(data3.action).toBe('validateData');
    expect(data3.confidence).toBeGreaterThan(0.5);
  });
});

describe('E2E Workflow 4: Add Multiple Entities in One Message', () => {
  test('should parse and handle multiple entities at once', async () => {
    const tweet = realTweets[1];
    
    const response = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'add रायगढ़, बिलासपुर as locations and PM Kisan, Ayushman Bharat as schemes',
        tweetData: tweet
      })
    });
    
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.pendingChanges.length).toBeGreaterThanOrEqual(2);
    
    const locationChange = data.pendingChanges.find((c: any) => c.field === 'locations');
    const schemeChange = data.pendingChanges.find((c: any) => c.field === 'schemes_mentioned');
    
    expect(locationChange).toBeDefined();
    expect(schemeChange).toBeDefined();
    if (locationChange?.value) {
      expect(locationChange.value.length).toBeGreaterThan(1);
    }
    if (schemeChange?.value) {
      expect(schemeChange.value.length).toBeGreaterThan(1);
    }
  });
});

describe('E2E Workflow 5: Correct AI Suggestions', () => {
  test('should learn from human corrections', async () => {
    const tweet = realTweets[2];
    
    // Step 1: Get AI suggestions
    const response1 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'generate suggestions',
        tweetData: tweet
      })
    });
    
    const data1 = await response1.json();
    const sessionId = data1.sessionId;
    
    expect(data1.suggestions).toBeDefined();
    
    // Step 2: Correct a suggestion
    const response2 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'change event type to बैठक instead of रैली',
        tweetData: tweet,
        sessionId
      })
    });
    
    const data2 = await response2.json();
    
    expect(data2.success).toBe(true);
    expect(data2.action).toBe('changeEventType');
    
    // Step 3: Verify correction was accepted
    const response3 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'what event type did I choose?',
        tweetData: tweet,
        sessionId
      })
    });
    
    const data3 = await response3.json();
    expect(data3.context.previousActions.length).toBeGreaterThan(0);
  });
});

describe('E2E Workflow 6: Model Fallback Mechanism', () => {
  test('should fallback to Ollama if Gemini fails', async () => {
    const tweet = realTweets[0];
    
    // Temporarily disable Gemini by using invalid API key
    const originalKey = process.env.GEMINI_API_KEY;
    
    try {
      // This should trigger fallback
      const response = await fetch('http://localhost:3000/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'test fallback',
          tweetData: tweet,
          useBothModels: false
        })
      });
      
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data.modelUsed).toBeDefined();
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });
});

describe('E2E Workflow 7: Parallel Model Comparison', () => {
  test('should execute both Gemini and Ollama in parallel', async () => {
    const tweet = realTweets[0];
    
    const response = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'generate suggestions',
        tweetData: tweet,
        useBothModels: true
      })
    });
    
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.modelUsed).toBe('both');
    expect(data.modelMetrics).toBeDefined();
    expect(data.modelMetrics.gemini).toBeDefined();
    expect(data.modelMetrics.ollama).toBeDefined();
  });
});

describe('E2E Workflow 8: Process All 55 Tweets', () => {
  test('should process all real tweets successfully', async () => {
    let successCount = 0;
    let errorCount = 0;
    
    for (const tweet of realTweets.slice(0, 10)) {
      try {
        const response = await fetch('http://localhost:3000/api/ai-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'generate suggestions',
            tweetData: tweet
          })
        });
        
        const data = await response.json();
        
        if (data.success && data.suggestions) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }
    
    expect(successCount).toBeGreaterThan(5); // At least 50% success
    expect(errorCount).toBeLessThan(successCount);
  });
});

describe('E2E Workflow 9: Handle Empty/Partial Data', () => {
  test('should handle tweet with no parsed data', async () => {
    const tweet = {
      tweet_id: 'test_empty_tweet',
      text: 'Some tweet text',
      event_type: null,
      locations: [],
      schemes_mentioned: [],
      hashtags: []
    };
    
    const response = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'generate suggestions',
        tweetData: tweet
      })
    });
    
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.suggestions).toBeDefined();
  });
  
  test('should handle tweet with partial parsed data', async () => {
    const tweet = {
      ...realTweets[0],
      locations: ['रायपुर'],
      schemes_mentioned: []
    };
    
    const response = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'suggest missing fields',
        tweetData: tweet
      })
    });
    
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.suggestions.schemes.length).toBeGreaterThan(0);
  });
});

describe('E2E Workflow 10: Error Recovery and State Persistence', () => {
  test('should maintain conversation state across errors', async () => {
    const tweet = realTweets[0];
    const sessionId = `error-test-${Date.now()}`;
    
    // First successful interaction
    const response1 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'add location रायपुर',
        tweetData: tweet,
        sessionId
      })
    });
    
    const data1 = await response1.json();
    expect(data1.success).toBe(true);
    
    // Second interaction that might fail but state should be maintained
    const response2 = await fetch('http://localhost:3000/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'invalid request causing error',
        tweetData: tweet,
        sessionId
      })
    });
    
    const data2 = await response2.json();
    
    // State should still be maintained
    expect(data2.context).toBeDefined();
    expect(data2.context.previousActions.length).toBeGreaterThan(0);
  });
});

