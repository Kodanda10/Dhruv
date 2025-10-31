import { Pool } from 'pg';

describe('Database Schema Updates - Real Database', () => {
  let pool: Pool;

  beforeAll(() => {
    // Use real database connection for integration testing
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db'
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should have all required columns in parsed_events table', async () => {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'parsed_events' 
      ORDER BY ordinal_position
    `);
    
    const columns = result.rows.map(row => row.column_name);
    
    // Required columns for Gemini parser integration
    const requiredColumns = [
      'id', 'tweet_id', 'event_type', 'event_type_en', 'event_code',
      'event_date', 'locations', 'people_mentioned', 'organizations',
      'schemes_mentioned', 'schemes_en', 'overall_confidence', 'needs_review',
      'review_status', 'reasoning', 'matched_scheme_ids', 'matched_event_id',
      'generated_hashtags', 'parsed_at', 'parsed_by', 'updated_at'
    ];
    
    const missingColumns = requiredColumns.filter(col => !columns.includes(col));
    
    expect(missingColumns).toHaveLength(0);
    expect(columns.length).toBeGreaterThanOrEqual(21); // At least 21 columns
  });

  it('should have proper indexes for performance', async () => {
    const result = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'parsed_events'
    `);
    
    const indexes = result.rows.map(row => row.indexname);
    
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
    
    expect(missingIndexes).toHaveLength(0);
    // Allow additional indexes (geo/consensus) while ensuring required ones exist
    expect(indexes.length).toBeGreaterThanOrEqual(7);
  });

  it('should have reference datasets properly seeded', async () => {
    // Check schemes
    const schemesResult = await pool.query(`
      SELECT id, scheme_code, name_hi, name_en, category 
      FROM ref_schemes 
      WHERE is_active = true
    `);
    
    // Check event types
    const eventTypesResult = await pool.query(`
      SELECT id, event_code, name_hi, name_en, category 
      FROM ref_event_types 
      WHERE is_active = true
    `);
    
    expect(schemesResult.rows.length).toBeGreaterThan(0);
    expect(eventTypesResult.rows.length).toBeGreaterThan(0);
    
    // Verify specific schemes exist
    const schemeNames = schemesResult.rows.map(row => row.name_hi);
    expect(schemeNames).toContain('प्रधानमंत्री किसान सम्मान निधि');
    expect(schemeNames).toContain('मुख्यमंत्री किसान योजना');
    
    // Verify specific event types exist
    const eventTypeNames = eventTypesResult.rows.map(row => row.name_hi);
    expect(eventTypeNames).toContain('बैठक');
    expect(eventTypeNames).toContain('रैली');
  });

  it('should have proper foreign key constraints', async () => {
    const result = await pool.query(`
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
    
    const foreignKeys = result.rows.map(row => row.constraint_name);
    
    expect(foreignKeys).toContain('parsed_events_tweet_id_fkey');
    expect(result.rows.length).toBe(1);
  });

  it('should have proper check constraints', async () => {
    const result = await pool.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name LIKE 'valid_%'
    `);
    
    const constraints = result.rows.map(row => row.constraint_name);
    
    expect(constraints).toContain('valid_confidence');
    expect(constraints).toContain('valid_review_status');
    expect(result.rows.length).toBe(2);
  });

  it('should be able to insert a parsed event with all new fields', async () => {
    // Test inserting a parsed event with all the new Gemini parser fields
    const testTweetId = `test_${Date.now()}`;
    
    // First insert a raw tweet to satisfy foreign key constraint
    await pool.query(`
      INSERT INTO raw_tweets (tweet_id, text, created_at, author_handle, retweet_count, reply_count, like_count, quote_count, hashtags, mentions, urls)
      VALUES ($1, $2, NOW(), $3, 0, 0, 0, 0, $4, $5, $6)
    `, [
      testTweetId,
      'Test tweet for schema validation',
      'test_user',
      [],
      [],
      []
    ]);
    
    const insertQuery = `
      INSERT INTO parsed_events (
        tweet_id, event_type, event_type_en, event_code, event_date,
        locations, people_mentioned, organizations, schemes_mentioned, schemes_en,
        overall_confidence, needs_review, review_status, reasoning,
        matched_scheme_ids, matched_event_id, generated_hashtags,
        parsed_at, parsed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), $18)
      RETURNING id, tweet_id, event_type, event_type_en, event_code
    `;
    
    const result = await pool.query(insertQuery, [
      testTweetId,
      'बैठक',
      'Meeting',
      'MEETING',
      '2025-01-17',
      JSON.stringify(['रायगढ़']),
      ['मुख्यमंत्री'],
      ['सरकार'],
      ['मुख्यमंत्री किसान योजना'],
      ['CM Kisan Yojana CG'],
      0.85,
      false,
      'pending',
      'Tweet mentions meeting and CM Kisan scheme',
      [5],
      1,
      ['#बैठक', '#रायगढ़', '#छत्तीसगढ़'],
      'gemini'
    ]);
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].tweet_id).toBe(testTweetId);
    expect(result.rows[0].event_type).toBe('बैठक');
    expect(result.rows[0].event_type_en).toBe('Meeting');
    expect(result.rows[0].event_code).toBe('MEETING');
    
    // Clean up
    await pool.query('DELETE FROM parsed_events WHERE tweet_id = $1', [testTweetId]);
    await pool.query('DELETE FROM raw_tweets WHERE tweet_id = $1', [testTweetId]);
  });
});
