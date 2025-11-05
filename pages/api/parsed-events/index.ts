import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db',
});

// Hindi event type mappings
const EVENT_TYPE_HINDI: Record<string, string> = {
  'tour': 'दौरा',
  'inspection': 'निरीक्षण',
  'scheme_announcement': 'योजना घोषणा',
  'festival_event': 'त्योहार कार्यक्रम',
  'constituent_engagement': 'विधानसभा सदस्य जुड़ाव',
  'samaj_function': 'सामाजिक कार्य',
  'rally': 'सम्मेलन',
  'meeting': 'बैठक',
  'relief': 'राहत',
  'inauguration': 'उद्घाटन',
  'birthday_wishes': 'जन्मदिन शुभकामनाएं',
  'press_conference': 'प्रेस वार्ता',
  'other': 'अन्य',
  'development_work': 'विकास कार्य',
  'community_outreach': 'सामुदायिक आउटरीच',
  'scheme': 'योजना',
  'political_event': 'राजनीतिक कार्यक्रम',
  'campaign': 'अभियान',
  'ceremony': 'समारोह',
  'visit': 'मुलाकात',
  'announcement': 'घोषणा',
  'function': 'कार्यक्रम',
  'event': 'घटना'
};

interface ParsedEvent {
  id: number;
  tweet_id: string;
  text: string;
  content: string;
  timestamp: string;
  event_type: string;
  event_type_hi: string;
  event_type_confidence: number | null;
  needs_review: boolean;
  review_status: string;
  parsed_at: string;
  parsed_by: string;
  locations: any[];
  people_mentioned: string[];
  organizations: string[];
  schemes_mentioned: string[];
  overall_confidence: number | null;
}

interface ParsedEventsResponse {
  success: boolean;
  source: string;
  total: number;
  data: ParsedEvent[];
  events: ParsedEvent[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ParsedEventsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      source: 'api',
      total: 0,
      data: [],
      events: []
    });
  }

  try {
    // Get query parameters
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500); // Allow up to 500 records
    const needsReview = req.query.needs_review === 'true';
    const reviewStatus = req.query.review_status as string;
    const analyticsMode = req.query.analytics === 'true';

    // Build SQL query
    let whereConditions = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (needsReview !== undefined) {
      whereConditions.push(`needs_review = $${paramIndex}`);
      params.push(needsReview);
      paramIndex++;
    }

    if (reviewStatus) {
      whereConditions.push(`review_status = $${paramIndex}`);
      params.push(reviewStatus);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        pe.id,
        pe.tweet_id,
        rt.content as text,
        rt.content,
        rt.created_at as timestamp,
        pe.event_type,
        COALESCE(pe.event_type_hi, '') as event_type_hi,
        pe.event_type_confidence,
        pe.needs_review,
        pe.review_status,
        pe.parsed_at,
        pe.parsed_by,
        pe.locations,
        pe.people_mentioned,
        pe.organizations,
        pe.schemes_mentioned,
        pe.overall_confidence
      FROM parsed_events pe
      LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
      ${whereClause}
      ORDER BY pe.parsed_at DESC
      LIMIT $${paramIndex}
    `;

    params.push(limit);

    // Execute query
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);

      // Map English event types to Hindi if not already set
      const processedEvents = result.rows.map(event => ({
        ...event,
        event_type_hi: event.event_type_hi || EVENT_TYPE_HINDI[event.event_type] || event.event_type,
        // Ensure JSON fields are properly parsed
        locations: event.locations || [],
        people_mentioned: event.people_mentioned || [],
        organizations: event.organizations || [],
        schemes_mentioned: event.schemes_mentioned || []
      }));

      return res.status(200).json({
        success: true,
        source: 'database',
        total: processedEvents.length,
        data: processedEvents,
        events: processedEvents
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Parsed events API error:', error);
    return res.status(500).json({
      success: false,
      source: 'error',
      total: 0,
      data: [],
      events: []
    });
  }
}
