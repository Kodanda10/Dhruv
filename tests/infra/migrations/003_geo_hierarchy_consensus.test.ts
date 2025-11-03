import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

// Skip database integration tests in CI if DATABASE_URL is not available
const shouldSkip = process.env.CI === 'true' && !process.env.DATABASE_URL;

// Use describe.skip to properly skip in CI
const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('Migration 003: Geo-Hierarchy and Consensus Schema', () => {
  let pool: Pool | null = null;
  
  beforeAll(async () => {
    if (shouldSkip) {
      return;
    }
    // Connect to test database (using docker-compose credentials)
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'dhruv_db',
      user: process.env.POSTGRES_USER || 'dhruv_user',
      password: process.env.POSTGRES_PASSWORD || 'dhruv_pass',
    });
  });
  
  afterAll(async () => {
    if (shouldSkip || !pool) {
      return;
    }
    await pool.end();
  });
  
  test('should add consensus and geo-hierarchy columns to parsed_events', async () => {
    // Read migration file
    const migrationPath = path.join(__dirname, '../../../infra/migrations/003_add_geo_hierarchy_and_consensus.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    // Execute migration
    await pool!.query(migrationSQL);
    
    // Verify columns exist
    const result = await pool!.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'parsed_events' 
      AND column_name IN (
        'consensus_results', 'layer_details', 'geo_hierarchy',
        'gram_panchayats', 'ulb_wards', 'blocks', 'assemblies', 'districts'
      )
      ORDER BY column_name
    `);
    
    expect(result.rows).toHaveLength(8);
    
    const expectedColumns = [
      { column_name: 'assemblies', data_type: 'ARRAY' },
      { column_name: 'blocks', data_type: 'ARRAY' },
      { column_name: 'consensus_results', data_type: 'jsonb' },
      { column_name: 'districts', data_type: 'ARRAY' },
      { column_name: 'geo_hierarchy', data_type: 'jsonb' },
      { column_name: 'gram_panchayats', data_type: 'ARRAY' },
      { column_name: 'layer_details', data_type: 'jsonb' },
      { column_name: 'ulb_wards', data_type: 'jsonb' }
    ];
    
    result.rows.forEach((row, index) => {
      expect(row.column_name).toBe(expectedColumns[index].column_name);
      expect(row.data_type).toBe(expectedColumns[index].data_type);
      expect(row.is_nullable).toBe('YES');
    });
  });
  
  test('should create geo_corrections table with proper structure', async () => {
    if (shouldSkip || !pool) {
      return;
    }
    const result = await pool!.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'geo_corrections'
      ORDER BY ordinal_position
    `);
    
    expect(result.rows).toHaveLength(9);
    
    const expectedStructure = [
      { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { column_name: 'tweet_id', data_type: 'character varying', is_nullable: 'YES' },
      { column_name: 'field_name', data_type: 'character varying', is_nullable: 'NO' },
      { column_name: 'original_value', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'corrected_value', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'parser_sources', data_type: 'ARRAY', is_nullable: 'YES' },
      { column_name: 'corrected_by', data_type: 'character varying', is_nullable: 'YES' },
      { column_name: 'correction_reason', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'corrected_at', data_type: 'timestamp without time zone', is_nullable: 'YES' }
    ];
    
    result.rows.forEach((row, index) => {
      expect(row.column_name).toBe(expectedStructure[index].column_name);
      expect(row.data_type).toBe(expectedStructure[index].data_type);
      expect(row.is_nullable).toBe(expectedStructure[index].is_nullable);
    });
  });
  
  test('should create proper indexes for performance', async () => {
    if (shouldSkip || !pool) {
      return;
    }
    const result = await pool!.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename IN ('parsed_events', 'geo_corrections')
      AND indexname IN (
        'idx_assemblies', 'idx_blocks', 'idx_consensus_results',
        'idx_corrections_at', 'idx_corrections_field', 'idx_corrections_tweet',
        'idx_districts', 'idx_geo_hierarchy', 'idx_gram_panchayats'
      )
      ORDER BY indexname
    `);
    
    const expectedIndexes = [
      'idx_assemblies',
      'idx_blocks', 
      'idx_consensus_results',
      'idx_corrections_at',
      'idx_corrections_field',
      'idx_corrections_tweet',
      'idx_districts',
      'idx_geo_hierarchy',
      'idx_gram_panchayats'
    ];
    
    expect(result.rows).toHaveLength(expectedIndexes.length);
    
    const actualIndexNames = result.rows.map(row => row.indexname).sort();
    expect(actualIndexNames).toEqual(expectedIndexes.sort());
  });
  
  test('should support JSONB operations on consensus_results', async () => {
    if (shouldSkip || !pool) {
      return;
    }
    // First create a test tweet to satisfy foreign key constraint
    await pool!.query(`
      INSERT INTO raw_tweets (tweet_id, author_handle, text, created_at)
      VALUES ('test_tweet_001', 'test_user', 'Test tweet for migration testing', NOW())
      ON CONFLICT (tweet_id) DO NOTHING
    `);
    
    // Test inserting and querying JSONB data
    const testData = {
      locations: [
        {
          value: 'रायपुर',
          agreed_by: ['gemini', 'ollama'],
          confidence: 0.85,
          dataset_validated: true
        }
      ],
      event_type: {
        value: 'कार्यक्रम',
        agreed_by: ['gemini', 'custom'],
        confidence: 0.90,
        dataset_validated: true
      }
    };
    
    // Insert test data
    await pool!.query(`
      INSERT INTO parsed_events (
        tweet_id, consensus_results, layer_details, geo_hierarchy,
        gram_panchayats, ulb_wards, blocks, assemblies, districts
      ) VALUES (
        'test_tweet_001',
        $1,
        '{"gemini": {"execution_time_ms": 1200}, "ollama": {"execution_time_ms": 800}}',
        '[{"village": "रायपुर", "block": "रायपुर", "assembly": "रायपुर शहर उत्तर", "district": "रायपुर"}]',
        ARRAY['रायपुर'],
        '[{"ulb": "रायपुर नगर निगम", "ward": 5}]',
        ARRAY['रायपुर'],
        ARRAY['रायपुर शहर उत्तर'],
        ARRAY['रायपुर']
      )
    `, [JSON.stringify(testData)]);
    
    // Query using JSONB operators
    const result = await pool!.query(`
      SELECT 
        consensus_results->'locations' as locations,
        consensus_results->'event_type'->>'value' as event_type_value,
        geo_hierarchy->0->>'village' as first_village,
        gram_panchayats[1] as first_gp
      FROM parsed_events 
      WHERE tweet_id = 'test_tweet_001'
    `);
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].event_type_value).toBe('कार्यक्रम');
    expect(result.rows[0].first_village).toBe('रायपुर');
    expect(result.rows[0].first_gp).toBe('रायपुर');
    
    // Clean up
    await pool!.query(`DELETE FROM parsed_events WHERE tweet_id = 'test_tweet_001'`);
    await pool!.query(`DELETE FROM raw_tweets WHERE tweet_id = 'test_tweet_001'`);
  });
  
  test('should support geo_corrections audit trail', async () => {
    // First create a test tweet to satisfy foreign key constraint
    await pool!.query(`
      INSERT INTO raw_tweets (tweet_id, author_handle, text, created_at)
      VALUES ('test_tweet_002', 'test_user', 'Test tweet for geo corrections testing', NOW())
      ON CONFLICT (tweet_id) DO NOTHING
    `);
    
    const correctionData = {
      original_hierarchy: {
        village: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर दक्षिण'
      },
      corrected_hierarchy: {
        village: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर'
      }
    };
    
    await pool!.query(`
      INSERT INTO geo_corrections (
        tweet_id, field_name, original_value, corrected_value,
        parser_sources, corrected_by, correction_reason
      ) VALUES (
        'test_tweet_002',
        'geo_hierarchy',
        $1,
        $2,
        ARRAY['gemini', 'ollama'],
        'human_reviewer',
        'Assembly constituency was incorrectly identified'
      )
    `, [
      JSON.stringify(correctionData.original_hierarchy),
      JSON.stringify(correctionData.corrected_hierarchy)
    ]);
    
    const result = await pool!.query(`
      SELECT 
        field_name,
        original_value->>'assembly' as original_assembly,
        corrected_value->>'assembly' as corrected_assembly,
        parser_sources,
        corrected_by,
        correction_reason
      FROM geo_corrections 
      WHERE tweet_id = 'test_tweet_002'
    `);
    
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].field_name).toBe('geo_hierarchy');
    expect(result.rows[0].original_assembly).toBe('रायपुर शहर दक्षिण');
    expect(result.rows[0].corrected_assembly).toBe('रायपुर शहर उत्तर');
    expect(result.rows[0].parser_sources).toEqual(['gemini', 'ollama']);
    expect(result.rows[0].corrected_by).toBe('human_reviewer');
    
    // Clean up
    await pool!.query(`DELETE FROM geo_corrections WHERE tweet_id = 'test_tweet_002'`);
    await pool!.query(`DELETE FROM raw_tweets WHERE tweet_id = 'test_tweet_002'`);
  });
});
