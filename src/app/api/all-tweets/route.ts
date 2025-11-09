import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';
import { getEventTypeInHindi } from '@/lib/i18n/event-types-hi';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to fetch ALL tweets (parsed + unparsed) for bulk review
 */
export async function GET(request: NextRequest) {
  try {
    const pool = getDbPool();
    const client = await pool.connect();

    try {
      // Query to get ALL tweets with parsing status
      const query = `
        SELECT 
          rt.tweet_id,
          rt.text as tweet_text,
          rt.created_at as tweet_created_at,
          rt.author_handle,
          rt.lang,
          -- Parsed event data (if exists)
          pe.id as parsed_event_id,
          pe.event_type,
          pe.event_type_confidence,
          pe.event_date,
          pe.date_confidence,
          pe.locations,
          pe.people_mentioned,
          pe.organizations,
          pe.schemes_mentioned,
          pe.overall_confidence,
          pe.needs_review,
          pe.review_status,
          pe.reviewed_at,
          pe.reviewed_by,
          pe.parsed_at,
          pe.parsed_by,
          -- Status flags
          CASE WHEN pe.id IS NOT NULL THEN true ELSE false END as is_parsed,
          CASE WHEN pe.id IS NOT NULL THEN 'parsed' ELSE 'unparsed' END as parsing_status
        FROM raw_tweets rt
        LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
        WHERE rt.author_handle = 'OPChoudhary_Ind'
        ORDER BY rt.created_at DESC
      `;

      const result = await client.query(query);

      // Get counts
      const countQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(pe.id) as parsed_count,
          COUNT(*) FILTER (WHERE pe.id IS NULL) as unparsed_count
        FROM raw_tweets rt
        LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
        WHERE rt.author_handle = 'OPChoudhary_Ind'
      `;
      const countResult = await client.query(countQuery);
      const counts = countResult.rows[0];

      // Format response
      const formattedTweets = result.rows.map((row) => {
        const isParsed = row.is_parsed;
        const eventTypeHi = row.event_type ? getEventTypeInHindi(row.event_type) : null;

        if (isParsed) {
          // Parsed tweet - include all parsed data
          return {
            tweet_id: row.tweet_id,
            tweet_text: row.tweet_text,
            tweet_created_at: row.tweet_created_at,
            author_handle: row.author_handle,
            lang: row.lang,
            is_parsed: true,
            parsing_status: 'parsed',
            parsed_event_id: row.parsed_event_id,
            // Parsed data
            parsed_data: {
              event_type: row.event_type,
              event_type_hi: eventTypeHi,
              event_type_confidence: row.event_type_confidence,
              event_date: row.event_date,
              date_confidence: row.date_confidence,
              locations: Array.isArray(row.locations) ? row.locations : [],
              people_mentioned: Array.isArray(row.people_mentioned) ? row.people_mentioned : [],
              organizations: Array.isArray(row.organizations) ? row.organizations : [],
              schemes_mentioned: Array.isArray(row.schemes_mentioned) ? row.schemes_mentioned : [],
              overall_confidence: row.overall_confidence,
              needs_review: row.needs_review,
              review_status: row.review_status,
              reviewed_at: row.reviewed_at,
              reviewed_by: row.reviewed_by,
              parsed_at: row.parsed_at,
              parsed_by: row.parsed_by,
            },
            // Backward compatibility fields
            text: row.tweet_text,
            content: row.tweet_text,
            timestamp: row.tweet_created_at,
          };
        } else {
          // Unparsed tweet - minimal structure
          return {
            tweet_id: row.tweet_id,
            tweet_text: row.tweet_text,
            tweet_created_at: row.tweet_created_at,
            author_handle: row.author_handle,
            lang: row.lang,
            is_parsed: false,
            parsing_status: 'unparsed',
            parsed_event_id: null,
            // Empty parsed data structure for unparsed tweets
            parsed_data: null,
            // Default values for UI
            needs_review: true, // Unparsed tweets need review
            review_status: 'pending',
            // Backward compatibility fields
            text: row.tweet_text,
            content: row.tweet_text,
            timestamp: row.tweet_created_at,
          };
        }
      });

      console.log(`[API /all-tweets] Returned: ${formattedTweets.length} tweets`, {
        parsed: formattedTweets.filter(t => t.is_parsed).length,
        unparsed: formattedTweets.filter(t => !t.is_parsed).length,
        total_in_db: counts.total,
        parsed_in_db: counts.parsed_count,
        unparsed_in_db: counts.unparsed_count,
      });

      return NextResponse.json({
        success: true,
        source: 'database',
        count: formattedTweets.length,
        returned: formattedTweets.length,
        total: parseInt(counts.total || '0', 10),
        parsed: parseInt(counts.parsed_count || '0', 10),
        unparsed: parseInt(counts.unparsed_count || '0', 10),
        tweets: formattedTweets,
        // Also provide as 'events' and 'data' for backward compatibility
        events: formattedTweets,
        data: formattedTweets,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[API /all-tweets] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch all tweets',
      },
      { status: 500 }
    );
  }
}

