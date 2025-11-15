import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const pool = getDbPool();
  try {
    const { searchParams } = new URL(request.url);
    const tweetId = searchParams.get('tweet_id');

    if (!tweetId) {
      return NextResponse.json({ error: 'tweet_id parameter is required' }, { status: 400 });
    }

    // Check if tweet exists in raw_tweets table
    const result = await pool.query(
      'SELECT tweet_id FROM raw_tweets WHERE tweet_id = $1 LIMIT 1',
      [tweetId]
    );

    const exists = result.rows.length > 0;

    return NextResponse.json({
      tweet_id: tweetId,
      exists,
      table: 'raw_tweets'
    });

  } catch (error: any) {
    console.error('Error checking tweet duplicate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}