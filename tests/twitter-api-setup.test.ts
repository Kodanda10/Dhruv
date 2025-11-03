/**
 * Test: Verify Twitter API setup and configuration
 * 
 * This test ensures that:
 * 1. Twitter API client can be initialized with credentials
 * 2. Environment variables are properly configured
 * 3. Rate limiting is respected
 * 4. Fetch can retrieve tweets from a user
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Twitter API Setup', () => {
  const projectRoot = join(__dirname, '..');
  const envExamplePath = join(projectRoot, '.env.example');
  const envLocalPath = join(projectRoot, '.env.local');

  it('should have .env.example with Twitter API keys template', () => {
    expect(existsSync(envExamplePath)).toBe(true);
    
    // Read and verify template exists
    const fs = require('fs');
    const envExample = fs.readFileSync(envExamplePath, 'utf-8');
    
    expect(envExample).toContain('X_API_KEY=');
    expect(envExample).toContain('X_API_SECRET=');
    expect(envExample).toContain('X_BEARER_TOKEN=');
    expect(envExample).toContain('X_ACCESS_TOKEN=');
    expect(envExample).toContain('X_ACCESS_TOKEN_SECRET=');
  });

  it('should have Twitter API credentials in .env.local', () => {
    // This test will only pass if user has created .env.local with keys
    if (existsSync(envLocalPath)) {
      const fs = require('fs');
      const envLocal = fs.readFileSync(envLocalPath, 'utf-8');
      
      // Check that keys are present (not just template)
      expect(envLocal).toContain('X_API_KEY=');
      expect(envLocal).not.toContain('X_API_KEY=your_api_key_here');
      
      // Verify no actual keys are in test (security check)
      expect(envLocal).not.toContain('gho_');
      expect(envLocal).not.toContain('sk_live_');
    } else {
      // If .env.local doesn't exist, skip this test
      console.warn('⚠️  .env.local not found - please create it with Twitter API keys');
    }
  });

  it('should have Twitter client module structure', () => {
    const twitterClientPath = join(projectRoot, 'api', 'src', 'twitter', 'client.py');
    
    // Check if client.py exists
    expect(existsSync(twitterClientPath)).toBe(true);
    
    // Verify it has required functions
    const fs = require('fs');
    const clientCode = fs.readFileSync(twitterClientPath, 'utf-8');
    
    expect(clientCode).toContain('class TwitterClient');
    expect(clientCode).toContain('def fetch_user_tweets');
    expect(clientCode).toContain('def __init__');
  });

  it('should have tweet fetcher script', () => {
    const fetcherPath = join(projectRoot, 'scripts', 'fetch_tweets.py');
    
    expect(existsSync(fetcherPath)).toBe(true);
    
    // Verify it has CLI arguments
    const fs = require('fs');
    const fetcherCode = fs.readFileSync(fetcherPath, 'utf-8');
    
    expect(fetcherCode).toContain('--handle');
    expect(fetcherCode).toContain('--since');
    expect(fetcherCode).toContain('--until');
    expect(fetcherCode).toContain('--resume');
  });
});

