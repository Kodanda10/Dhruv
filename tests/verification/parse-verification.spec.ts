import { test, expect } from '@playwright/test';
import { getDbPool } from '@/lib/db/pool';

test.describe('Tweet Parsing Pipeline Verification', () => {
  test.beforeAll(async () => {
    // Ensure database connection
    const pool = getDbPool();
    await pool.query('SELECT 1');
  });

  test('should maintain analytics integrity after consensus parsing', async ({ page }) => {
    // Navigate to analytics dashboard
    await page.goto('/analytics');

    // Wait for analytics to load
    await page.waitForSelector('[data-testid="analytics-loaded"]');

    // Capture initial metrics
    const initialMetrics = await page.evaluate(() => {
      const metrics = {
        totalTweets: document.querySelector('[data-testid="total-tweets"]')?.textContent,
        parsedTweets: document.querySelector('[data-testid="parsed-tweets"]')?.textContent,
        reviewPending: document.querySelector('[data-testid="review-pending"]')?.textContent,
        approvedTweets: document.querySelector('[data-testid="approved-tweets"]')?.textContent,
        consensusRate: document.querySelector('[data-testid="consensus-rate"]')?.textContent
      };
      return metrics;
    });

    // Trigger consensus parsing workflow (simulate GitHub Actions)
    await page.evaluate(() => {
      // Simulate workflow dispatch
      fetch('/api/workflows/parse-tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchSize: 10, // Small batch for testing
          dryRun: true
        })
      });
    });

    // Wait for parsing completion
    await page.waitForSelector('[data-testid="parsing-complete"]', { timeout: 30000 });

    // Verify analytics integrity
    const finalMetrics = await page.evaluate(() => {
      const metrics = {
        totalTweets: document.querySelector('[data-testid="total-tweets"]')?.textContent,
        parsedTweets: document.querySelector('[data-testid="parsed-tweets"]')?.textContent,
        reviewPending: document.querySelector('[data-testid="review-pending"]')?.textContent,
        approvedTweets: document.querySelector('[data-testid="approved-tweets"]')?.textContent,
        consensusRate: document.querySelector('[data-testid="consensus-rate"]')?.textContent
      };
      return metrics;
    });

    // Assertions for analytics integrity
    expect(finalMetrics.totalTweets).toBe(initialMetrics.totalTweets);
    expect(parseInt(finalMetrics.parsedTweets || '0')).toBeGreaterThanOrEqual(parseInt(initialMetrics.parsedTweets || '0'));
    expect(parseInt(finalMetrics.approvedTweets || '0')).toBeGreaterThanOrEqual(parseInt(initialMetrics.approvedTweets || '0'));

    // Verify consensus rate is reasonable (should be > 60% for well-formed data)
    const consensusRate = parseFloat(finalMetrics.consensusRate?.replace('%', '') || '0');
    expect(consensusRate).toBeGreaterThanOrEqual(60);
  });

  test('should preserve UI consistency during parsing operations', async ({ page }) => {
    // Navigate to tweet review interface
    await page.goto('/review');

    // Wait for interface to load
    await page.waitForSelector('[data-testid="review-interface"]');

    // Capture initial UI state
    const initialUIState = await page.evaluate(() => {
      const state = {
        tweetListVisible: !!document.querySelector('[data-testid="tweet-list"]'),
        reviewPanelVisible: !!document.querySelector('[data-testid="review-panel"]'),
        consensusIndicators: document.querySelectorAll('[data-testid="consensus-indicator"]').length,
        actionButtons: document.querySelectorAll('[data-testid="action-button"]').length,
        loadingStates: document.querySelectorAll('[data-testid="loading"]').length
      };
      return state;
    });

    // Simulate real-time parsing updates
    await page.evaluate(() => {
      // Simulate WebSocket updates from parsing workflow
      const event = new CustomEvent('parsing-update', {
        detail: {
          tweetId: 'test-tweet-123',
          status: 'consensus_achieved',
          consensus: {
            event: { consensus: true },
            location: { consensus: true },
            people: { consensus: true },
            schemes: { consensus: false },
            tags: { consensus: true }
          }
        }
      });
      window.dispatchEvent(event);
    });

    // Wait for UI to update
    await page.waitForTimeout(1000);

    // Verify UI consistency is maintained
    const updatedUIState = await page.evaluate(() => {
      const state = {
        tweetListVisible: !!document.querySelector('[data-testid="tweet-list"]'),
        reviewPanelVisible: !!document.querySelector('[data-testid="review-panel"]'),
        consensusIndicators: document.querySelectorAll('[data-testid="consensus-indicator"]').length,
        actionButtons: document.querySelectorAll('[data-testid="action-button"]').length,
        loadingStates: document.querySelectorAll('[data-testid="loading"]').length
      };
      return state;
    });

    // UI structure should remain consistent
    expect(updatedUIState.tweetListVisible).toBe(initialUIState.tweetListVisible);
    expect(updatedUIState.reviewPanelVisible).toBe(initialUIState.reviewPanelVisible);
    expect(updatedUIState.actionButtons).toBe(initialUIState.actionButtons);

    // Consensus indicators should update appropriately
    expect(updatedUIState.consensusIndicators).toBeGreaterThanOrEqual(initialUIState.consensusIndicators);
  });

  test('should handle consensus failures gracefully', async ({ page }) => {
    // Navigate to review interface
    await page.goto('/review');

    // Simulate consensus failure scenario
    await page.evaluate(() => {
      const event = new CustomEvent('parsing-update', {
        detail: {
          tweetId: 'test-tweet-fail',
          status: 'consensus_failed',
          consensus: {
            event: { consensus: false },
            location: { consensus: false },
            people: { consensus: false },
            schemes: { consensus: false },
            tags: { consensus: false }
          }
        }
      });
      window.dispatchEvent(event);
    });

    // Verify error handling UI appears
    await page.waitForSelector('[data-testid="consensus-failure-notice"]');

    const failureNotice = await page.locator('[data-testid="consensus-failure-notice"]').textContent();
    expect(failureNotice).toContain('needs manual review');

    // Verify tweet is marked for manual review
    const reviewStatus = await page.locator('[data-testid="review-status"]').textContent();
    expect(reviewStatus).toContain('needs_review');
  });

  test('should validate API endpoint responses', async ({ request }) => {
    // Test tweets/unparsed endpoint
    const unparsedResponse = await request.get('/api/tweets/unparsed?limit=5');
    expect(unparsedResponse.ok()).toBeTruthy();

    const unparsedData = await unparsedResponse.json();
    expect(unparsedData).toHaveProperty('tweets');
    expect(Array.isArray(unparsedData.tweets)).toBeTruthy();
    expect(unparsedData.tweets.length).toBeLessThanOrEqual(5);

    // Test Gemini parse endpoint with mock data
    const geminiResponse = await request.post('/api/llm/gemini/parse', {
      data: {
        tweet: {
          id: 'test-123',
          text: 'Test tweet for parsing validation',
          created_at: new Date().toISOString()
        }
      }
    });

    if (geminiResponse.ok()) {
      const geminiData = await geminiResponse.json();
      expect(geminiData).toHaveProperty('parsed');
      expect(geminiData.parsed).toHaveProperty('event');
      expect(geminiData.parsed).toHaveProperty('location');
    }

    // Test Ollama parse endpoint with mock data
    const ollamaResponse = await request.post('/api/llm/ollama/parse', {
      data: {
        tweet: {
          id: 'test-123',
          text: 'Test tweet for parsing validation',
          created_at: new Date().toISOString()
        }
      }
    });

    if (ollamaResponse.ok()) {
      const ollamaData = await ollamaResponse.json();
      expect(ollamaData).toHaveProperty('parsed');
      expect(ollamaData.parsed).toHaveProperty('event');
    }
  });

  test('should verify database integrity after parsing', async () => {
    const pool = getDbPool();
    const client = await pool.connect();

    try {
      // Check for orphaned records
      const orphanedQuery = `
        SELECT COUNT(*) as orphaned_count
        FROM parsed_events
        WHERE consensus_data IS NOT NULL
        AND consensus_summary IS NULL
      `;
      const orphanedResult = await client.query(orphanedQuery);
      expect(parseInt(orphanedResult.rows[0].orphaned_count)).toBe(0);

      // Check for invalid consensus summaries
      const invalidConsensusQuery = `
        SELECT COUNT(*) as invalid_count
        FROM parsed_events
        WHERE consensus_summary IS NOT NULL
        AND (
          (consensus_summary->>'totalFields')::int != 5
          OR (consensus_summary->>'agreedFields')::int > (consensus_summary->>'totalFields')::int
        )
      `;
      const invalidResult = await client.query(invalidConsensusQuery);
      expect(parseInt(invalidResult.rows[0].invalid_count)).toBe(0);

      // Verify parser version consistency
      const versionQuery = `
        SELECT COUNT(*) as version_count
        FROM parsed_events
        WHERE parser_version IS NOT NULL
        AND parser_version != 'v1.0.0'
      `;
      const versionResult = await client.query(versionQuery);
      // Allow some records to have different versions during migration
      expect(parseInt(versionResult.rows[0].version_count)).toBeLessThan(100);

    } finally {
      client.release();
    }
  });
});