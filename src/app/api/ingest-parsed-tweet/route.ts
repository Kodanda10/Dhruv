import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate required fields
    if (!data.tweet || !data.categories) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: tweet or categories' },
        { status: 400 }
      );
    }

    const { tweet, categories, gemini_metadata } = data;

    // Extract data for database insertion
    const tweetId = tweet.id;
    const locations = Array.isArray(categories.locations) ? categories.locations : [];
    const people = Array.isArray(categories.people) ? categories.people : [];
    const organizations = Array.isArray(categories.organisation) ? categories.organisation : [];
    const schemes = Array.isArray(categories.schemes) ? categories.schemes : [];
    const communities = Array.isArray(categories.communities) ? categories.communities : [];


    // Helper function to format arrays for PostgreSQL JSONB columns
    const formatJsonArray = (arr: any[]) => JSON.stringify(arr);

    // Determine event type from categories (simplified logic)
    let eventType = 'general';
    let confidence = 0.5;

    if (categories.event && categories.event.length > 0) {
      eventType = categories.event[0];
      confidence = 0.8;
    }

    // Check if tweet already exists
    const pool = getDbPool();
    const client = await pool.connect();

    try {
      // Check for existing parsed event
      const existingCheck = await client.query(
        'SELECT id FROM parsed_events WHERE tweet_id = $1',
        [tweetId]
      );

      if (existingCheck.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Tweet already processed', duplicate: true },
          { status: 409 }
        );
      }

      // Insert new parsed event
      const insertQuery = `
        INSERT INTO parsed_events (
          tweet_id,
          event_type,
          event_type_confidence,
          locations,
          people_mentioned,
          organizations,
          schemes_mentioned,
          overall_confidence,
          needs_review,
          review_status,
          parsed_at,
          parsed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;

      const values = [
        tweetId,
        eventType,
        confidence,
        formatJsonArray(locations), // locations is JSONB
        people,     // people_mentioned is TEXT[] - pass actual array
        organizations, // organizations is TEXT[] - pass actual array
        schemes,   // schemes_mentioned is TEXT[] - pass actual array
        confidence,
        true, // needs_review - mark for human review
        'pending', // review_status
        new Date().toISOString(),
        gemini_metadata?.model || 'unknown'
      ];

      const result = await client.query(insertQuery, values);

      console.log(`[API] Successfully ingested parsed tweet ${tweetId} with ID ${result.rows[0].id}`);

      return NextResponse.json({
        success: true,
        message: 'Tweet processed successfully',
        parsed_event_id: result.rows[0].id
      });

    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Error ingesting parsed tweet:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to ingest parsed tweet',
      },
      { status: 500 }
    );
  }
}