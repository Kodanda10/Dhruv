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

