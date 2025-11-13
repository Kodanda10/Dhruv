#!/usr/bin/env node

// Simple test script for API endpoint
async function testAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/ingest-parsed-tweet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tweet: {
          id: "test123",
          text: "Test tweet",
          created_at: "2023-01-01T00:00:00Z",
          author_id: "test"
        },
        categories: {
          locations: [],
          people: [],
          event: [],
          organisation: [],
          schemes: [],
          communities: []
        },
        gemini_metadata: { model: "gemini-2.0-flash" }
      })
    });

    const result = await response.json();
    console.log('API Response:', response.status, result);
  } catch (error) {
    console.error('API Test Failed:', error.message);
  }
}

testAPI();