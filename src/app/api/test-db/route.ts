import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '../parsed-events/pool-helper';
import { logger } from '@/lib/utils/logger';

/**
 * Test Database Connection Endpoint
 * 
 * This endpoint tests the database connection and returns connection status.
 * Useful for debugging deployment issues.
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('Testing database connection...');
    logger.info('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden)' : 'Not set');
    
    const pool = getPool();
    
    // Test 1: Simple query
    logger.info('Test 1: Running simple query...');
    const testResult = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    logger.info('Test 1: Success', { time: testResult.rows[0].current_time });
    
    // Test 2: Check if tables exist
    logger.info('Test 2: Checking tables...');
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('raw_tweets', 'parsed_events')
      ORDER BY table_name
    `);
    logger.info('Test 2: Tables found', { tables: tablesResult.rows.map((r: any) => r.table_name) });
    
    // Test 3: Count rows
    logger.info('Test 3: Counting rows...');
    const counts: any = {};
    
    try {
      const rawTweetsResult = await pool.query('SELECT COUNT(*) as count FROM raw_tweets');
      counts.raw_tweets = parseInt(rawTweetsResult.rows[0].count);
    } catch (e) {
      counts.raw_tweets = 'Error: ' + (e instanceof Error ? e.message : 'Unknown');
    }
    
    try {
      const parsedEventsResult = await pool.query('SELECT COUNT(*) as count FROM parsed_events');
      counts.parsed_events = parseInt(parsedEventsResult.rows[0].count);
    } catch (e) {
      counts.parsed_events = 'Error: ' + (e instanceof Error ? e.message : 'Unknown');
    }
    
    logger.info('Test 3: Row counts', counts);
    
    // Test 4: Sample query (like the actual API)
    logger.info('Test 4: Testing parsed_events query...');
    let sampleData: any[] = [];
    try {
      const sampleResult = await pool.query(`
        SELECT 
          pe.*,
          rt.text as tweet_text,
          rt.created_at as tweet_created_at
        FROM parsed_events pe
        LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
        ORDER BY pe.parsed_at DESC
        LIMIT 5
      `);
      sampleData = sampleResult.rows;
      logger.info('Test 4: Sample query success', { count: sampleData.length });
    } catch (e) {
      logger.error('Test 4: Sample query failed', e);
      sampleData = [];
    }
    
    return NextResponse.json({
      success: true,
      connection: 'working',
      database_time: testResult.rows[0].current_time,
      postgres_version: testResult.rows[0].pg_version,
      tables_found: tablesResult.rows.map((r: any) => r.table_name),
      row_counts: counts,
      sample_data_count: sampleData.length,
      sample_data: sampleData.slice(0, 2), // Return first 2 for preview
      message: 'Database connection successful'
    });
    
  } catch (error) {
    logger.error('Database connection test failed:', error);
    
    return NextResponse.json({
      success: false,
      connection: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      database_url_set: !!process.env.DATABASE_URL,
      node_env: process.env.NODE_ENV,
      message: 'Database connection failed'
    }, { status: 500 });
  }
}

