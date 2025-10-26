import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db',
});

export async function GET() {
  try {
    // Check database connection
    const dbResult = await pool.query('SELECT NOW() as timestamp');
    
    // Check if required tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('raw_tweets', 'parsed_events', 'ref_schemes', 'ref_event_types')
    `);
    
    const existingTables = tablesResult.rows.map(row => row.table_name);
    const requiredTables = ['raw_tweets', 'parsed_events', 'ref_schemes', 'ref_event_types'];
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    // Get counts for health check
    const counts = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM raw_tweets'),
      pool.query('SELECT COUNT(*) as count FROM parsed_events'),
      pool.query('SELECT COUNT(*) as count FROM parsed_events WHERE needs_review = true'),
      pool.query('SELECT COUNT(*) as count FROM parsed_events WHERE review_status = \'approved\'')
    ]);
    
    const [rawTweets, parsedEvents, reviewQueue, approvedTweets] = counts.map(result => result.rows[0].count);
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: dbResult.rows[0].timestamp,
      database: {
        connected: true,
        tables: {
          existing: existingTables,
          missing: missingTables,
          all_present: missingTables.length === 0
        }
      },
      counts: {
        raw_tweets: parseInt(rawTweets),
        parsed_events: parseInt(parsedEvents),
        review_queue: parseInt(reviewQueue),
        approved_tweets: parseInt(approvedTweets)
      },
      version: '1.0.0'
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}