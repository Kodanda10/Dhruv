import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';
import { getEventTypeInHindi } from '@/lib/i18n/event-types-hi';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const needsReview = searchParams.get('needs_review');
    // Remove limit restriction - allow fetching all tweets (default 5000, max 10000 for safety)
    const limit = Math.min(parseInt(searchParams.get('limit') || '5000', 10), 10000);
    const authorFilter = searchParams.get('author'); // Filter by author username

    const pool = getDbPool();
    const client = await pool.connect();

    try {
      // Build query with author information
      // Show all parsed tweets
      let query = `
        SELECT
          pe.id,
          pe.tweet_id,
          rt.text as tweet_text,
          rt.created_at as tweet_created_at,
          rt.author_handle as author_handle,
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
          pe.parsed_by
        FROM parsed_events pe
        LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
      `;

      const params: any[] = [];
      let paramIndex = 1;

      let whereClauses = [];

      if (status) {
        whereClauses.push(`pe.review_status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      if (needsReview === 'true') {
        whereClauses.push(`pe.needs_review = true`);
      } else if (needsReview === 'false') {
        whereClauses.push(`pe.needs_review = false`);
      }

      if (authorFilter) {
        whereClauses.push(`(rt.author_handle ILIKE $${paramIndex} OR rt.author_handle ILIKE $${paramIndex + 1})`);
        params.push(`%${authorFilter}%`, `%${authorFilter.replace(/\s+/g, '')}%`);
        paramIndex += 2;
      } else {
        // Default filter if no author is specified - show all processed tweets
        // Remove restrictive filter to show all parsed events
        console.log('[API] No author filter specified - showing all processed tweets');
      }

      if (whereClauses.length > 0) {
        query += ` WHERE ` + whereClauses.join(' AND ');
      }

      query += ` ORDER BY rt.created_at DESC`;

      const result = await client.query(query, params);

      // Get accurate total count for OP Choudhary (matching the exact filter used in main query)
      let opChoudharyCount = 0;
      let totalParsedCount = 0;
      try {
        // Count all parsed events (no author filter)
        const countQuery = `
          SELECT COUNT(*) as count
          FROM parsed_events pe
          JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
        `;
        const countResult = await client.query(countQuery);
        opChoudharyCount = parseInt(countResult.rows[0]?.count || '0', 10);
        totalParsedCount = opChoudharyCount;
        
        console.log(`[API] Parsed events query result:`, {
          returned: result.rows.length,
          total_in_db: opChoudharyCount,
          query_used: query.substring(0, 100) + '...'
        });
      } catch (e) {
        console.error('[API] Error getting count:', e);
        // Fallback to result count
        opChoudharyCount = result.rows.length;
        totalParsedCount = result.rows.length;
      }

      // Format response to match both Flask API and old Pages Router format
      // Includes backward compatibility fields (text, content, timestamp, event_type_hi)
      const formattedEvents = result.rows.map((row) => {
        const eventTypeHi = getEventTypeInHindi(row.event_type);
        return {
          // Primary fields (Flask API format)
          id: row.id,
          tweet_id: row.tweet_id,
          tweet_text: row.tweet_text,
          tweet_created_at: row.tweet_created_at,
          author_username: row.author_handle,
          event_type: row.event_type,
          event_type_confidence: row.event_type_confidence,
          event_type_hi: eventTypeHi, // Hindi translation
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
          // Backward compatibility fields (old Pages Router format)
          text: row.tweet_text,
          content: row.tweet_text,
          timestamp: row.tweet_created_at,
        };
      });

      return NextResponse.json({
        success: true,
        source: 'database',
        count: formattedEvents.length,
        total: totalParsedCount, // Total available in database
        returned: formattedEvents.length, // Actually returned in this response
        total_op_choudhary: opChoudharyCount,
        // Support both response formats for backward compatibility
        events: formattedEvents,
        data: formattedEvents, // Old Pages Router format
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error fetching parsed events:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch parsed events',
      },
      { status: 500 }
    );
  }
}

