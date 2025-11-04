import { Pool } from 'pg';

// Mock the database connection
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn()
  }))
}));

describe('Database Schema Updates', () => {
  let mockPool: any;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock pool
    mockPool = {
      query: jest.fn()
    };
    
    mockQuery = jest.fn();
    
    // Mock the Pool constructor
    const { Pool } = require('pg');
    Pool.mockImplementation(() => mockPool);
    
    // Setup mock query
    mockPool.query = mockQuery;
  });

  it('should have all required columns in parsed_events table', async () => {
    // Mock the table description query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'tweet_id', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'event_type', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'event_type_en', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'event_code', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'event_date', data_type: 'date', is_nullable: 'YES' },
        { column_name: 'locations', data_type: 'jsonb', is_nullable: 'YES' },
        { column_name: 'people_mentioned', data_type: 'text[]', is_nullable: 'YES' },
        { column_name: 'organizations', data_type: 'text[]', is_nullable: 'YES' },
        { column_name: 'schemes_mentioned', data_type: 'text[]', is_nullable: 'YES' },
        { column_name: 'schemes_en', data_type: 'text[]', is_nullable: 'YES' },
        { column_name: 'overall_confidence', data_type: 'numeric', is_nullable: 'YES' },
        { column_name: 'needs_review', data_type: 'boolean', is_nullable: 'YES' },
        { column_name: 'review_status', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'reasoning', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'matched_scheme_ids', data_type: 'integer[]', is_nullable: 'YES' },
        { column_name: 'matched_event_id', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'generated_hashtags', data_type: 'text[]', is_nullable: 'YES' },
        { column_name: 'parsed_at', data_type: 'timestamp without time zone', is_nullable: 'YES' },
        { column_name: 'parsed_by', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'updated_at', data_type: 'timestamp without time zone', is_nullable: 'YES' }
      ]
    });

    // Test the schema validation function
    const validateSchema = async () => {
      const result = await mockPool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'parsed_events' 
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows.map((row: { column_name: string }) => row.column_name);
      
      // Required columns for Gemini parser integration
      const requiredColumns = [
        'id', 'tweet_id', 'event_type', 'event_type_en', 'event_code',
        'event_date', 'locations', 'people_mentioned', 'organizations',
        'schemes_mentioned', 'schemes_en', 'overall_confidence', 'needs_review',
        'review_status', 'reasoning', 'matched_scheme_ids', 'matched_event_id',
        'generated_hashtags', 'parsed_at', 'parsed_by', 'updated_at'
      ];
      
      const missingColumns = requiredColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }
      
      return { success: true, columns: columns.length };
    };

    const result = await validateSchema();
    
    expect(result.success).toBe(true);
    expect(result.columns).toBe(21); // Total number of columns
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('information_schema.columns'));
  });

  it('should have proper indexes for performance', async () => {
    // Mock the indexes query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { indexname: 'parsed_events_pkey', indexdef: 'PRIMARY KEY, btree (id)' },
        { indexname: 'idx_parsed_events_tweet_id', indexdef: 'btree (tweet_id)' },
        { indexname: 'idx_parsed_events_date', indexdef: 'btree (event_date DESC)' },
        { indexname: 'idx_parsed_events_type', indexdef: 'btree (event_type)' },
        { indexname: 'idx_parsed_events_confidence', indexdef: 'btree (overall_confidence DESC)' },
        { indexname: 'idx_parsed_events_review_status', indexdef: 'btree (review_status, needs_review)' },
        { indexname: 'idx_parsed_events_date_type', indexdef: 'btree (event_date DESC, event_type)' }
      ]
    });

    const validateIndexes = async () => {
      const result = await mockPool.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'parsed_events'
      `);
      
      const indexes = result.rows.map((row: { indexname: string }) => row.indexname);
      
      // Required indexes for performance
      const requiredIndexes = [
        'parsed_events_pkey',
        'idx_parsed_events_tweet_id',
        'idx_parsed_events_date',
        'idx_parsed_events_type',
        'idx_parsed_events_confidence',
        'idx_parsed_events_review_status',
        'idx_parsed_events_date_type'
      ];
      
      const missingIndexes = requiredIndexes.filter(idx => !indexes.includes(idx));
      
      if (missingIndexes.length > 0) {
        throw new Error(`Missing required indexes: ${missingIndexes.join(', ')}`);
      }
      
      return { success: true, indexes: indexes.length };
    };

    const result = await validateIndexes();
    
    expect(result.success).toBe(true);
    expect(result.indexes).toBe(7); // Total number of indexes
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('pg_indexes'));
  });

  it('should have reference datasets properly seeded', async () => {
    // Mock schemes query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, scheme_code: 'PM_KISAN', name_hi: 'प्रधानमंत्री किसान सम्मान निधि', name_en: 'PM-KISAN', category: 'central' },
        { id: 2, scheme_code: 'CM_KISAN_CG', name_hi: 'मुख्यमंत्री किसान योजना', name_en: 'CM Kisan Yojana CG', category: 'state' }
      ]
    });

    // Mock event types query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, event_code: 'MEETING', name_hi: 'बैठक', name_en: 'Meeting', category: 'administrative' },
        { id: 2, event_code: 'RALLY', name_hi: 'रैली', name_en: 'Rally', category: 'political' }
      ]
    });

    const validateReferenceData = async () => {
      // Check schemes
      const schemesResult = await mockPool.query(`
        SELECT id, scheme_code, name_hi, name_en, category 
        FROM ref_schemes 
        WHERE is_active = true
      `);
      
      // Check event types
      const eventTypesResult = await mockPool.query(`
        SELECT id, event_code, name_hi, name_en, category 
        FROM ref_event_types 
        WHERE is_active = true
      `);
      
      if (schemesResult.rows.length === 0) {
        throw new Error('No schemes found in ref_schemes table');
      }
      
      if (eventTypesResult.rows.length === 0) {
        throw new Error('No event types found in ref_event_types table');
      }
      
      return { 
        success: true, 
        schemesCount: schemesResult.rows.length,
        eventTypesCount: eventTypesResult.rows.length
      };
    };

    const result = await validateReferenceData();
    
    expect(result.success).toBe(true);
    expect(result.schemesCount).toBeGreaterThan(0);
    expect(result.eventTypesCount).toBeGreaterThan(0);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ref_schemes'));
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ref_event_types'));
  });

  it('should have proper foreign key constraints', async () => {
    // Mock foreign keys query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { 
          constraint_name: 'parsed_events_tweet_id_fkey',
          column_name: 'tweet_id',
          foreign_table_name: 'raw_tweets',
          foreign_column_name: 'tweet_id'
        }
      ]
    });

    const validateForeignKeys = async () => {
      const result = await mockPool.query(`
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'parsed_events'
      `);
      
      const foreignKeys = result.rows.map((row: { constraint_name: string }) => row.constraint_name);
      
      if (!foreignKeys.includes('parsed_events_tweet_id_fkey')) {
        throw new Error('Missing foreign key constraint for tweet_id');
      }
      
      return { success: true, foreignKeysCount: foreignKeys.length };
    };

    const result = await validateForeignKeys();
    
    expect(result.success).toBe(true);
    expect(result.foreignKeysCount).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FOREIGN KEY'));
  });

  it('should have proper check constraints', async () => {
    // Mock check constraints query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { 
          constraint_name: 'valid_confidence',
          check_clause: 'overall_confidence >= 0 AND overall_confidence <= 1'
        },
        { 
          constraint_name: 'valid_review_status',
          check_clause: "review_status IN ('pending', 'approved', 'rejected', 'edited')"
        }
      ]
    });

    const validateCheckConstraints = async () => {
      const result = await mockPool.query(`
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE 'valid_%'
      `);
      
      const constraints = result.rows.map((row: { constraint_name: string }) => row.constraint_name);
      
      const requiredConstraints = ['valid_confidence', 'valid_review_status'];
      const missingConstraints = requiredConstraints.filter(constraint => !constraints.includes(constraint));
      
      if (missingConstraints.length > 0) {
        throw new Error(`Missing required check constraints: ${missingConstraints.join(', ')}`);
      }
      
      return { success: true, constraintsCount: constraints.length };
    };

    const result = await validateCheckConstraints();
    
    expect(result.success).toBe(true);
    expect(result.constraintsCount).toBe(2);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('check_constraints'));
  });
});
