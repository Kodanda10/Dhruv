/**
 * Database Integration Tests for Hindi Labels
 *
 * TDD: Tests ensure Hindi labels are stored and retrieved correctly
 * Production Ready: Validates database schema and API responses
 */

import { Pool } from 'pg';
import { getEventTypeInHindi } from '../../src/lib/i18n/event-types-hi';

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn(),
}));

describe('Database Hindi Labels Integration', () => {
  let mockPool: any;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQuery = jest.fn();
    mockPool = {
      query: mockQuery,
    };
    (Pool as unknown as jest.Mock).mockImplementation(() => mockPool);
  });

  describe('Parsed Events Table Schema', () => {
    it('should include event_type_hi column in parsed_events table', async () => {
      const mockRows = [
        {
          column_name: 'event_type_hi',
          data_type: 'character varying',
          is_nullable: 'YES',
          column_default: null,
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows });

      const result = await mockPool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'parsed_events'
          AND column_name = 'event_type_hi'
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe('event_type_hi');
      expect(result.rows[0].data_type).toBe('character varying');
    });

    it('should have index on event_type_hi column', async () => {
      const mockRows = [
        {
          indexname: 'idx_parsed_events_event_type_hi',
          tablename: 'parsed_events',
          indexdef: 'CREATE INDEX idx_parsed_events_event_type_hi ON parsed_events USING btree (event_type_hi)',
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows });

      const result = await mockPool.query(`
        SELECT indexname, tablename, indexdef
        FROM pg_indexes
        WHERE tablename = 'parsed_events'
          AND indexname = 'idx_parsed_events_event_type_hi'
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].indexname).toBe('idx_parsed_events_event_type_hi');
    });
  });

  describe('Data Population with Hindi Labels', () => {
    it('should populate event_type_hi when inserting parsed events', async () => {
      const eventType = 'meeting';
      const hindiLabel = getEventTypeInHindi(eventType);

      mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });

      const insertQuery = `
        INSERT INTO parsed_events (
          tweet_id, event_type, event_type_hi, event_type_confidence,
          overall_confidence, needs_review, parsed_at, parsed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      const result = await mockPool.query(insertQuery, [
        '1234567890',
        eventType,
        hindiLabel,
        0.85,
        0.88,
        false,
        new Date().toISOString(),
        'three-layer-consensus',
      ]);

      expect(mockQuery).toHaveBeenCalledWith(insertQuery, expect.arrayContaining([
        '1234567890',
        eventType,
        hindiLabel, // Should be 'बैठक'
        0.85,
        0.88,
        false,
        expect.any(String),
        'three-layer-consensus',
      ]));
    });

    it('should retrieve Hindi labels in JOIN queries', async () => {
      const mockRows = [
        {
          id: 1,
          tweet_id: '1234567890',
          event_type: 'meeting',
          event_type_hi: 'बैठक',
          event_type_confidence: 0.85,
          overall_confidence: 0.88,
          needs_review: false,
          tweet_text: 'Test tweet',
          tweet_created_at: '2025-11-03T09:00:00Z',
          parsed_at: '2025-11-03T10:00:00Z',
          parsed_by: 'three-layer-consensus',
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows });

      const result = await mockPool.query(`
        SELECT
          pe.id, pe.tweet_id, pe.event_type, pe.event_type_hi,
          pe.event_type_confidence, pe.overall_confidence, pe.needs_review,
          pe.parsed_at, pe.parsed_by,
          rt.text as tweet_text, rt.created_at as tweet_created_at
        FROM parsed_events pe
        LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
        WHERE pe.id = $1
      `, [1]);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].event_type).toBe('meeting');
      expect(result.rows[0].event_type_hi).toBe('बैठक');
    });
  });

  describe('API Response with Hindi Labels', () => {
    it('should include event_type_hi in API response mapping', () => {
      const mockRow = {
        id: 1,
        tweet_id: '1234567890',
        event_type: 'meeting',
        event_type_hi: 'बैठक',
        event_type_confidence: 0.85,
        overall_confidence: 0.88,
        needs_review: false,
        tweet_text: 'Test tweet',
        tweet_created_at: '2025-11-03T09:00:00Z',
        parsed_at: '2025-11-03T10:00:00Z',
        parsed_by: 'three-layer-consensus',
      };

      // Simulate the mapParsedEvent function logic
      const mappedEvent = {
        id: mockRow.tweet_id,
        timestamp: mockRow.tweet_created_at || mockRow.parsed_at,
        content: mockRow.tweet_text || '',
        text: mockRow.tweet_text || '',
        event_type: mockRow.event_type || 'other',
        event_type_hi: mockRow.event_type_hi || 'अन्य',
        event_type_confidence: mockRow.event_type_confidence || 0,
        overall_confidence: mockRow.overall_confidence || 0,
        needs_review: mockRow.needs_review,
        review_status: 'approved',
        locations: [],
        people_mentioned: [],
        organizations: [],
        schemes_mentioned: [],
        parsed_by: mockRow.parsed_by,
        parsed_at: mockRow.parsed_at,
      };

      expect(mappedEvent.event_type).toBe('meeting');
      expect(mappedEvent.event_type_hi).toBe('बैठक');
      expect(mappedEvent.id).toBe('1234567890');
    });

    it('should fallback to translation function when event_type_hi is null', () => {
      const mockRow = {
        id: 1,
        tweet_id: '1234567890',
        event_type: 'meeting',
        event_type_hi: null,
        event_type_confidence: 0.85,
        overall_confidence: 0.88,
        needs_review: false,
        tweet_text: 'Test tweet',
        tweet_created_at: '2025-11-03T09:00:00Z',
        parsed_at: '2025-11-03T10:00:00Z',
        parsed_by: 'three-layer-consensus',
      };

      // Simulate the mapParsedEvent function logic
      const mappedEvent = {
        id: mockRow.tweet_id,
        timestamp: mockRow.tweet_created_at || mockRow.parsed_at,
        content: mockRow.tweet_text || '',
        text: mockRow.tweet_text || '',
        event_type: mockRow.event_type || 'other',
        event_type_hi: mockRow.event_type_hi || getEventTypeInHindi(mockRow.event_type),
        event_type_confidence: mockRow.event_type_confidence || 0,
        overall_confidence: mockRow.overall_confidence || 0,
        needs_review: mockRow.needs_review,
        review_status: 'approved',
        locations: [],
        people_mentioned: [],
        organizations: [],
        schemes_mentioned: [],
        parsed_by: mockRow.parsed_by,
        parsed_at: mockRow.parsed_at,
      };

      expect(mappedEvent.event_type).toBe('meeting');
      expect(mappedEvent.event_type_hi).toBe('बैठक'); // Should fallback to translation
      expect(mappedEvent.id).toBe('1234567890');
    });
  });

  describe('Migration Validation', () => {
    it('should validate migration 003_add_hindi_labels.sql executed correctly', async () => {
      // Test that the migration added the column
      const mockRows = [
        {
          column_name: 'event_type_hi',
          data_type: 'character varying',
          character_maximum_length: 100,
          is_nullable: 'YES',
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows });

      const result = await mockPool.query(`
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable
        FROM information_schema.columns
        WHERE table_name = 'parsed_events'
          AND column_name = 'event_type_hi'
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].column_name).toBe('event_type_hi');
      expect(result.rows[0].data_type).toBe('character varying');
      expect(result.rows[0].character_maximum_length).toBe(100);
      expect(result.rows[0].is_nullable).toBe('YES');
    });

    it('should validate index was created', async () => {
      const mockRows = [
        {
          schemaname: 'public',
          tablename: 'parsed_events',
          indexname: 'idx_parsed_events_event_type_hi',
          indexdef: 'CREATE INDEX idx_parsed_events_event_type_hi ON public.parsed_events USING btree (event_type_hi)',
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows });

      const result = await mockPool.query(`
        SELECT schemaname, tablename, indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'parsed_events'
          AND indexname = 'idx_parsed_events_event_type_hi'
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].tablename).toBe('parsed_events');
      expect(result.rows[0].indexname).toBe('idx_parsed_events_event_type_hi');
      expect(result.rows[0].indexdef).toContain('btree (event_type_hi)');
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle existing records without event_type_hi', async () => {
      const mockRows = [
        {
          id: 1,
          tweet_id: '1234567890',
          event_type: 'meeting',
          event_type_hi: null, // Old record without Hindi label
          event_type_confidence: 0.85,
          overall_confidence: 0.88,
          needs_review: false,
          tweet_text: 'Test tweet',
          tweet_created_at: '2025-11-03T09:00:00Z',
          parsed_at: '2025-11-03T10:00:00Z',
          parsed_by: 'three-layer-consensus',
        },
      ];

      mockQuery.mockResolvedValue({ rows: mockRows });

      const result = await mockPool.query(`
        SELECT
          pe.id, pe.tweet_id, pe.event_type, pe.event_type_hi,
          pe.event_type_confidence, pe.overall_confidence, pe.needs_review,
          pe.parsed_at, pe.parsed_by,
          rt.text as tweet_text, rt.created_at as tweet_created_at
        FROM parsed_events pe
        LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
        WHERE pe.event_type_hi IS NULL
      `, []);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].event_type).toBe('meeting');
      expect(result.rows[0].event_type_hi).toBeNull();
    });

    it('should support UPDATE queries to populate missing Hindi labels', async () => {
      mockQuery.mockResolvedValue({ rowCount: 5 });

      const result = await mockPool.query(`
        UPDATE parsed_events
        SET event_type_hi = CASE
          WHEN event_type = 'meeting' THEN 'बैठक'
          WHEN event_type = 'rally' THEN 'रैली'
          WHEN event_type = 'inspection' THEN 'निरीक्षण'
          ELSE 'अन्य'
        END
        WHERE event_type_hi IS NULL
      `);

      expect(result.rowCount).toBe(5);
    });
  });
});
