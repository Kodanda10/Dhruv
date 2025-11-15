import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const pool = getDbPool();
  try {
    const client = await pool.connect();
    try {
      // Find the first event that is pending review
      const result = await client.query(
        `SELECT * FROM parsed_events WHERE review_status = 'pending' ORDER BY created_at ASC LIMIT 1`
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ message: 'No events pending review.' }, { status: 404 });
      }

      const event = result.rows[0];
      
      // Re-shape the data to match the UI's expectation
      const responseData = {
        id: event.id,
        tweetText: event.raw_tweet_text, // Assuming this column name
        parsed: {
          location: event.locations?.[0]?.name || 'N/A',
          eventType: event.event_type || 'N/A',
          people: event.people?.map((p: any) => p.name) || [],
          schemes: event.schemes?.map((s: any) => s.name) || [],
        }
      };

      return NextResponse.json(responseData);

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Failed to fetch event from database.' }, { status: 500 });
  }
}
