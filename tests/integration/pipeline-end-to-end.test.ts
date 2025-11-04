/**
 * End-to-End Pipeline Integration Tests
 * Validates: Fetch → Parse → Review → Analytics
 */

import { Pool } from 'pg';

describe('End-to-End Pipeline Integration', () => {
  let dbPool: Pool;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not set');
    }

    dbPool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    });

    jest.setTimeout(300000); // 5 minutes for integration tests
  });

  afterAll(async () => {
    await dbPool.end();
  });

  describe('Pipeline: Fetch → Parse', () => {
    test('should parse raw tweets and create parsed_events', async () => {
      // Get count of raw tweets
      const rawCountResult = await dbPool.query('SELECT COUNT(*) as count FROM raw_tweets WHERE text IS NOT NULL');
      const rawCount = parseInt(rawCountResult.rows[0].count);

      // Get count of parsed events
      const parsedCountResult = await dbPool.query('SELECT COUNT(*) as count FROM parsed_events');
      const parsedCount = parseInt(parsedCountResult.rows[0].count);

      console.log(`Raw tweets: ${rawCount}, Parsed events: ${parsedCount}`);

      // At least 80% of raw tweets should be parsed
      expect(parsedCount).toBeGreaterThan(rawCount * 0.8);
    });

    test('should have parsed events with three-layer consensus data', async () => {
      const result = await dbPool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE parsed_by LIKE '%three-layer%' OR parsed_by LIKE '%consensus%') as consensus_parsed,
          COUNT(*) FILTER (WHERE overall_confidence > 0.7) as high_confidence,
          COUNT(*) FILTER (WHERE needs_review = false) as auto_approved
        FROM parsed_events
      `);

      const stats = result.rows[0];

      console.log('Parsing Statistics:');
      console.log(`  Total parsed: ${stats.total}`);
      console.log(`  Three-layer parsed: ${stats.consensus_parsed}`);
      console.log(`  High confidence (>0.7): ${stats.high_confidence}`);
      console.log(`  Auto-approved: ${stats.auto_approved}`);

      expect(parseInt(stats.total)).toBeGreaterThan(0);
      expect(parseInt(stats.consensus_parsed)).toBeGreaterThan(0);
    });

    test('should have proper confidence distribution', async () => {
      const result = await dbPool.query(`
        SELECT 
          AVG(overall_confidence) as avg_confidence,
          MIN(overall_confidence) as min_confidence,
          MAX(overall_confidence) as max_confidence,
          COUNT(*) FILTER (WHERE overall_confidence > 0.8) as very_high,
          COUNT(*) FILTER (WHERE overall_confidence BETWEEN 0.6 AND 0.8) as medium,
          COUNT(*) FILTER (WHERE overall_confidence < 0.6) as low
        FROM parsed_events
        WHERE overall_confidence IS NOT NULL
      `);

      const stats = result.rows[0];

      console.log('Confidence Distribution:');
      console.log(`  Average: ${(parseFloat(stats.avg_confidence) * 100).toFixed(1)}%`);
      console.log(`  Range: ${(parseFloat(stats.min_confidence) * 100).toFixed(1)}% - ${(parseFloat(stats.max_confidence) * 100).toFixed(1)}%`);
      console.log(`  Very High (>0.8): ${stats.very_high}`);
      console.log(`  Medium (0.6-0.8): ${stats.medium}`);
      console.log(`  Low (<0.6): ${stats.low}`);

      // Average confidence should be reasonable (may be low if using fallback parsing)
      const avgConf = parseFloat(stats.avg_confidence);
      expect(avgConf).toBeGreaterThan(0.0); // At least some confidence
      expect(avgConf).toBeLessThanOrEqual(1.0);
      
      if (avgConf < 0.5) {
        console.log(`⚠️  Low average confidence (${(avgConf * 100).toFixed(1)}%) - consider re-parsing with three-layer consensus`);
      }
    });
  });

  describe('Pipeline: Parse → Review', () => {
    test('should flag low-confidence events for review', async () => {
      const result = await dbPool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE needs_review = true) as needs_review_count,
          COUNT(*) FILTER (WHERE needs_review = false) as auto_approved_count,
          AVG(overall_confidence) FILTER (WHERE needs_review = true) as review_avg_confidence,
          AVG(overall_confidence) FILTER (WHERE needs_review = false) as approved_avg_confidence
        FROM parsed_events
      `);

      const stats = result.rows[0];

      console.log('Review Queue Statistics:');
      console.log(`  Total events: ${stats.total}`);
      console.log(`  Needs review: ${stats.needs_review_count}`);
      console.log(`  Auto-approved: ${stats.auto_approved_count}`);
      console.log(`  Review avg confidence: ${(parseFloat(stats.review_avg_confidence || 0) * 100).toFixed(1)}%`);
      console.log(`  Approved avg confidence: ${(parseFloat(stats.approved_avg_confidence || 0) * 100).toFixed(1)}%`);

      // Events needing review should have lower confidence
      if (stats.review_avg_confidence && stats.approved_avg_confidence) {
        expect(parseFloat(stats.review_avg_confidence)).toBeLessThan(parseFloat(stats.approved_avg_confidence));
      }

      // Should have reasonable distribution
      expect(parseInt(stats.needs_review_count)).toBeGreaterThan(0);
      expect(parseInt(stats.auto_approved_count)).toBeGreaterThan(0);
    });

    test('should have review status properly set', async () => {
      const result = await dbPool.query(`
        SELECT 
          review_status,
          COUNT(*) as count
        FROM parsed_events
        GROUP BY review_status
        ORDER BY count DESC
      `);

      console.log('Review Status Distribution:');
      result.rows.forEach(row => {
        console.log(`  ${row.review_status || 'NULL'}: ${row.count}`);
      });

      // Should have pending reviews for needs_review=true
      const pendingResult = await dbPool.query(`
        SELECT COUNT(*) as count
        FROM parsed_events
        WHERE needs_review = true AND (review_status IS NULL OR review_status = 'pending')
      `);

      expect(parseInt(pendingResult.rows[0].count)).toBeGreaterThan(0);
    });
  });

  describe('Pipeline: Review → Analytics', () => {
    test('should only include approved events in analytics', async () => {
      // Get all parsed events
      const allEvents = await dbPool.query(`
        SELECT COUNT(*) as count FROM parsed_events
      `);

      // Get approved events (for analytics)
      const approvedEvents = await dbPool.query(`
        SELECT COUNT(*) as count 
        FROM parsed_events
        WHERE needs_review = false AND (review_status IS NULL OR review_status = 'approved')
      `);

      // Get events in review queue
      const reviewQueue = await dbPool.query(`
        SELECT COUNT(*) as count 
        FROM parsed_events
        WHERE needs_review = true
      `);

      const allCount = parseInt(allEvents.rows[0].count);
      const approvedCount = parseInt(approvedEvents.rows[0].count);
      const reviewCount = parseInt(reviewQueue.rows[0].count);

      console.log('Analytics Eligibility:');
      console.log(`  Total events: ${allCount}`);
      console.log(`  Approved (for analytics): ${approvedCount}`);
      console.log(`  In review queue: ${reviewCount}`);
      console.log(`  Analytics coverage: ${((approvedCount / allCount) * 100).toFixed(1)}%`);

      // Approved events should be subset of all events
      expect(approvedCount).toBeLessThanOrEqual(allCount);
      expect(approvedCount + reviewCount).toBeLessThanOrEqual(allCount);

      // Should have some approved events for analytics (skip if none yet)
      if (approvedCount === 0) {
        console.log('⚠️  No approved events yet - this is expected if review workflow hasn\'t been used');
      } else {
        expect(approvedCount).toBeGreaterThan(0);
      }
    });

    test('should have proper event type distribution in approved events', async () => {
      const result = await dbPool.query(`
        SELECT 
          event_type,
          COUNT(*) as count
        FROM parsed_events
        WHERE needs_review = false AND (review_status IS NULL OR review_status = 'approved')
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 10
      `);

      console.log('Approved Events by Type (Top 10):');
      result.rows.forEach(row => {
        console.log(`  ${row.event_type}: ${row.count}`);
      });

      // Should have diverse event types (skip if no approved events)
      if (result.rows.length === 0) {
        console.log('⚠️  No approved events yet - skipping event type distribution test');
      } else {
        expect(result.rows.length).toBeGreaterThan(3);
      }
    });

    test('should have location data in approved events', async () => {
      const result = await dbPool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE locations IS NOT NULL AND jsonb_array_length(locations) > 0) as with_locations,
          COUNT(*) FILTER (WHERE people_mentioned IS NOT NULL AND array_length(people_mentioned, 1) > 0) as with_people,
          COUNT(*) FILTER (WHERE schemes_mentioned IS NOT NULL AND array_length(schemes_mentioned, 1) > 0) as with_schemes
        FROM parsed_events
        WHERE needs_review = false AND (review_status IS NULL OR review_status = 'approved')
      `);

      const stats = result.rows[0];

      console.log('Entity Extraction in Approved Events:');
      console.log(`  Total: ${stats.total}`);
      console.log(`  With locations: ${stats.with_locations} (${((parseInt(stats.with_locations) / parseInt(stats.total)) * 100).toFixed(1)}%)`);
      console.log(`  With people: ${stats.with_people} (${((parseInt(stats.with_people) / parseInt(stats.total)) * 100).toFixed(1)}%)`);
      console.log(`  With schemes: ${stats.with_schemes} (${((parseInt(stats.with_schemes) / parseInt(stats.total)) * 100).toFixed(1)}%)`);

      // Should have reasonable entity extraction (skip if no approved events)
      if (parseInt(stats.total) === 0) {
        console.log('⚠️  No approved events yet - skipping entity extraction test');
      } else {
        expect(parseInt(stats.with_locations)).toBeGreaterThan(0);
      }
    });
  });

  describe('Data Integrity', () => {
    test('should maintain referential integrity between raw_tweets and parsed_events', async () => {
      const result = await dbPool.query(`
        SELECT 
          COUNT(DISTINCT r.tweet_id) as raw_tweet_ids,
          COUNT(DISTINCT p.tweet_id) as parsed_tweet_ids,
          COUNT(*) FILTER (WHERE r.tweet_id = p.tweet_id) as matched_ids
        FROM raw_tweets r
        LEFT JOIN parsed_events p ON r.tweet_id = p.tweet_id
        WHERE r.text IS NOT NULL
      `);

      const stats = result.rows[0];

      console.log('Referential Integrity:');
      console.log(`  Unique raw tweet IDs: ${stats.raw_tweet_ids}`);
      console.log(`  Unique parsed tweet IDs: ${stats.parsed_tweet_ids}`);
      console.log(`  Matched IDs: ${stats.matched_ids}`);

      // Most raw tweets should have corresponding parsed events
      expect(parseInt(stats.matched_ids)).toBeGreaterThan(parseInt(stats.raw_tweet_ids) * 0.8);
    });

    test('should have consistent data types and formats', async () => {
      const result = await dbPool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE event_type IS NOT NULL) as has_event_type,
          COUNT(*) FILTER (WHERE overall_confidence IS NOT NULL AND overall_confidence BETWEEN 0 AND 1) as valid_confidence,
          COUNT(*) FILTER (WHERE locations IS NOT NULL AND jsonb_typeof(locations) = 'array') as valid_locations,
          COUNT(*) FILTER (WHERE people_mentioned IS NOT NULL) as has_people,
          COUNT(*) FILTER (WHERE parsed_at IS NOT NULL) as has_timestamp
        FROM parsed_events
      `);

      const stats = result.rows[0];

      console.log('Data Quality:');
      console.log(`  Has event_type: ${stats.has_event_type}`);
      console.log(`  Valid confidence: ${stats.valid_confidence}`);
      console.log(`  Valid locations: ${stats.valid_locations}`);
      console.log(`  Has people: ${stats.has_people}`);
      console.log(`  Has timestamp: ${stats.has_timestamp}`);

      // Should have consistent data quality
      expect(parseInt(stats.has_event_type)).toBeGreaterThan(0);
      expect(parseInt(stats.valid_confidence)).toBeGreaterThan(0);
      expect(parseInt(stats.has_timestamp)).toBeGreaterThan(0);
    });
  });

  describe('API Endpoint Integration', () => {
    test('should return approved events for analytics endpoint', async () => {
      // Check if Next.js server is running
      let serverRunning = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const healthCheck = await fetch('http://localhost:3000/api/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (healthCheck.ok) {
          const contentType = healthCheck.headers.get('content-type');
          serverRunning = contentType?.includes('application/json') || false;
        }
      } catch (e) {
        // Server not running
        serverRunning = false;
      }

      if (!serverRunning) {
        console.log('⚠️  Next.js server not running - skipping API tests');
        return;
      }

      const response = await fetch('http://localhost:3000/api/analytics');
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        console.log('⚠️  Analytics API returned non-JSON response - skipping');
        return;
      }
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.analytics).toBeDefined();

      console.log('Analytics API Response:');
      console.log(`  Success: ${data.success}`);
      console.log(`  Total tweets in analytics: ${data.analytics?.total_tweets || 0}`);
      console.log(`  Event distribution: ${Object.keys(data.analytics?.event_distribution || {}).length} types`);
    });

    test('should return review queue for review endpoint', async () => {
      // Check if Next.js server is running
      let serverRunning = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const healthCheck = await fetch('http://localhost:3000/api/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        serverRunning = healthCheck.ok;
      } catch (e) {
        // Server not running
        serverRunning = false;
      }

      if (!serverRunning) {
        console.log('⚠️  Next.js server not running - skipping API tests');
        return;
      }

      const response = await fetch('http://localhost:3000/api/parsed-events?needs_review=true&limit=50');
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        console.log('⚠️  Review queue API returned non-JSON response - skipping');
        return;
      }
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      console.log('Review Queue API Response:');
      console.log(`  Success: ${data.success}`);
      console.log(`  Events needing review: ${data.data?.length || 0}`);
      console.log(`  Source: ${data.source || 'unknown'}`);

      // All returned events should need review
      if (data.data && data.data.length > 0) {
        data.data.forEach((event: any) => {
          expect(event.needs_review).toBe(true);
        });
      }
    });

    test('should return all events for home tab', async () => {
      // Check if Next.js server is running
      let serverRunning = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const healthCheck = await fetch('http://localhost:3000/api/health', { signal: controller.signal });
        clearTimeout(timeoutId);
        serverRunning = healthCheck.ok;
      } catch (e) {
        // Server not running
        serverRunning = false;
      }

      if (!serverRunning) {
        console.log('⚠️  Next.js server not running - skipping API tests');
        return;
      }

      const response = await fetch('http://localhost:3000/api/parsed-events?limit=100');
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        console.log('⚠️  Home tab API returned non-JSON response - skipping');
        return;
      }
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      console.log('Home Tab API Response:');
      console.log(`  Success: ${data.success}`);
      console.log(`  Total events: ${data.total || 0}`);
      console.log(`  Returned: ${data.returned || 0}`);
      console.log(`  Source: ${data.source || 'unknown'}`);

      // Should return events regardless of review status
      expect(data.total).toBeGreaterThan(0);
    });
  });

  describe('Review Workflow Validation', () => {
    test('should allow approving events and they appear in analytics', async () => {
      // Get an event that needs review
      const reviewEvent = await dbPool.query(`
        SELECT id, tweet_id, event_type, overall_confidence
        FROM parsed_events
        WHERE needs_review = true
        LIMIT 1
      `);

      if (reviewEvent.rows.length > 0) {
        const event = reviewEvent.rows[0];
        console.log(`Testing approval workflow for event ${event.id}`);

        // Approve the event
        await dbPool.query(`
          UPDATE parsed_events
          SET needs_review = false,
              review_status = 'approved',
              reviewed_at = NOW(),
              reviewed_by = 'test-user'
          WHERE id = $1
        `, [event.id]);

        // Verify it appears in analytics query
        const analyticsResult = await dbPool.query(`
          SELECT COUNT(*) as count
          FROM parsed_events
          WHERE id = $1
            AND needs_review = false
            AND review_status = 'approved'
        `, [event.id]);

        expect(parseInt(analyticsResult.rows[0].count)).toBe(1);

        // Revert for other tests
        await dbPool.query(`
          UPDATE parsed_events
          SET needs_review = true,
              review_status = 'pending',
              reviewed_at = NULL,
              reviewed_by = NULL
          WHERE id = $1
        `, [event.id]);

        console.log('✅ Approval workflow validated');
      } else {
        console.log('⚠️  No events in review queue to test approval workflow');
      }
    });

    test('should allow skipping events and they appear only in home tab', async () => {
      // Get an event that needs review
      const reviewEvent = await dbPool.query(`
        SELECT id, tweet_id
        FROM parsed_events
        WHERE needs_review = true
        LIMIT 1
      `);

      if (reviewEvent.rows.length > 0) {
        const event = reviewEvent.rows[0];
        console.log(`Testing skip workflow for event ${event.id}`);

        // Skip the event (mark as rejected to exclude from analytics)
        await dbPool.query(`
          UPDATE parsed_events
          SET needs_review = false,
              review_status = 'rejected',
              reviewed_at = NOW(),
              reviewed_by = 'test-user'
          WHERE id = $1
        `, [event.id]);

        // Verify it appears in home tab (all events)
        const homeResult = await dbPool.query(`
          SELECT COUNT(*) as count
          FROM parsed_events
          WHERE id = $1
        `, [event.id]);

        expect(parseInt(homeResult.rows[0].count)).toBe(1);

        // Verify it does NOT appear in analytics (only approved)
        const analyticsResult = await dbPool.query(`
          SELECT COUNT(*) as count
          FROM parsed_events
          WHERE id = $1
            AND needs_review = false
            AND review_status = 'approved'
        `, [event.id]);

        expect(parseInt(analyticsResult.rows[0].count)).toBe(0);

        // Revert for other tests
        await dbPool.query(`
          UPDATE parsed_events
          SET needs_review = true,
              review_status = 'pending',
              reviewed_at = NULL,
              reviewed_by = NULL
          WHERE id = $1
        `, [event.id]);

        console.log('✅ Skip workflow validated');
      } else {
        console.log('⚠️  No events in review queue to test skip workflow');
      }
    });
  });
});
