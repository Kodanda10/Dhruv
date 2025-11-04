import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    
    console.log('Attempting to connect to database...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    // Query the database for latest tweets
    const query = `
      SELECT 
        tweet_id,
        text,
        created_at,
        author_handle,
        retweet_count,
        reply_count,
        like_count,
        quote_count,
        hashtags,
        mentions,
        urls
      FROM raw_tweets 
      WHERE author_handle = 'OPChoudhary_Ind'
      ORDER BY created_at DESC
      LIMIT $1
    `;
    
    console.log('Executing query...');
    const result = await pool.query(query, [limit]);
    console.log('Query executed successfully, rows:', result.rows.length);
    
    // Convert database format to dashboard format
    const tweets = result.rows.map((row: any) => ({
      id: row.tweet_id,
      timestamp: row.created_at,
      content: row.text,
      parsed: {
        event_type: "अन्य", // Default to "अन्य" (Other)
        locations: [], // Empty for now
        people: [], // Empty for now
        organizations: [], // Empty for now
        schemes: [] // Empty for now
      },
      confidence: 0.85, // Default confidence
      needs_review: true,
      review_status: "pending"
    }));
    
    return NextResponse.json({
      success: true,
      data: tweets,
      total: tweets.length,
      returned: tweets.length,
      source: 'database'
    });
    
  } catch (error) {
    console.error('Error fetching tweets from database:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch tweets from database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
