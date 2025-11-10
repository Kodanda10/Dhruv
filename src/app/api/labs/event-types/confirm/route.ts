import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      parsedEventType,
      resolvedEventTypeId,
      reviewStatus,
      manualEntryName,
      reviewerId,
      tweetId,
    } = body;

    if (!parsedEventType || !reviewStatus || !tweetId) {
      return NextResponse.json({ error: 'Missing required fields: parsedEventType, reviewStatus, tweetId.' }, { status: 400 });
    }

    const query = `
      INSERT INTO event_type_review_log (
        parsed_event_type_name,
        resolved_event_type_id,
        review_status,
        manual_entry_name,
        reviewer_id,
        tweet_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `;
    const values = [
      parsedEventType,
      resolvedEventTypeId,
      reviewStatus,
      manualEntryName,
      reviewerId,
      tweetId,
    ];

    const result = await pool.query(query, values);
    return NextResponse.json({ success: true, logId: result.rows[0].id });
  } catch (error: any) {
    console.error('API Error confirming event type:', error);
    return NextResponse.json({ error: error.message || 'Failed to confirm event type.' }, { status: 500 });
  }
}
