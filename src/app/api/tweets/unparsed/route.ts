import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const pool = getDbPool();
  try {
    const { searchParams } = new URL(request.url);
    const start = parseInt(searchParams.get('start') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '250', 10);

    // Get unparsed tweets (status = 'pending' or failed ones that need retry, or tweets not in parsed_events)
    const result = await pool.query(`
      SELECT
        tweet_id, text, created_at, author_handle,
        retweet_count, reply_count, like_count, quote_count,
        hashtags, mentions, urls
      FROM raw_tweets
      WHERE processing_status IN ('pending', 'failed')
         OR processing_status IS NULL
         OR tweet_id NOT IN (SELECT tweet_id FROM parsed_events)
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, start]);

    const tweets = result.rows.map(row => ({
      tweet_id: row.tweet_id,
      text: row.text,
      created_at: row.created_at,
      author_handle: row.author_handle,
      retweet_count: parseInt(row.retweet_count) || 0,
      reply_count: parseInt(row.reply_count) || 0,
      like_count: parseInt(row.like_count) || 0,
      quote_count: parseInt(row.quote_count) || 0,
      hashtags: Array.isArray(row.hashtags) ? row.hashtags : row.hashtags ? JSON.parse(row.hashtags) : [],
      mentions: Array.isArray(row.mentions) ? row.mentions : row.mentions ? JSON.parse(row.mentions) : [],
      urls: Array.isArray(row.urls) ? row.urls : row.urls ? JSON.parse(row.urls) : [],
    }));

    return NextResponse.json(tweets);
  } catch (error) {
    console.error('Error fetching unparsed tweets:', error);
    return NextResponse.json({ error: 'Failed to fetch tweets' }, { status: 500 });
  }
}