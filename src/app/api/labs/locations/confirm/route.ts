import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      parsedLocation,
      resolvedLocationId,
      reviewStatus,
      manualEntryName,
      reviewerId,
      tweetId,
    } = body;

    if (!parsedLocation || !reviewStatus || !tweetId) {
      return NextResponse.json({ error: 'Missing required fields: parsedLocation, reviewStatus, tweetId.' }, { status: 400 });
    }

    const query = `
      INSERT INTO location_review_log (
        parsed_location_name,
        resolved_location_id,
        review_status,
        manual_entry_name,
        reviewer_id,
        tweet_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `;
    const values = [
      parsedLocation,
      resolvedLocationId,
      reviewStatus,
      manualEntryName,
      reviewerId,
      tweetId,
    ];

    const result = await pool.query(query, values);
    return NextResponse.json({ success: true, logId: result.rows[0].id });
  } catch (error: any) {
    console.error('API Error confirming location:', error);
    return NextResponse.json({ error: error.message || 'Failed to confirm location.' }, { status: 500 });
  }
}
