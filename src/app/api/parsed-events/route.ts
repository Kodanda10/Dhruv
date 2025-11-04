import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Database configuration - lazy initialization for testing
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

// Type definitions
interface ParsedEvent {
  id: number;
  tweet_id: string;
  event_type: string | null;
  event_type_hi: string | null; // Hindi translation
  event_type_confidence: number | null;
  event_date: string | null;
  date_confidence: number | null;
  locations: any[] | null;
  people_mentioned: string[] | null;
  organizations: string[] | null;
  schemes_mentioned: string[] | null;
  overall_confidence: number | null;
  needs_review: boolean;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  parsed_at: string;
  parsed_by: string;
  tweet_text: string | null;
  tweet_created_at: string | null;
  author_handle: string;
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  hashtags: string[];
  mentions: string[];
  urls: string[];
}

interface ParsedEventResponse {
  id: string;
  timestamp: string;
  content: string;
  text: string;
  event_type: string;
  event_type_hi: string; // Hindi translation
  event_type_confidence: number;
  overall_confidence: number;
  needs_review: boolean;
  review_status: string;
  locations: any[];
  people_mentioned: string[];
  organizations: string[];
  schemes_mentioned: string[];
  parsed_by: string;
  parsed_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

// Helper functions
function ensureArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return [value];
  return [];
}

function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function mapParsedEvent(row: ParsedEvent): ParsedEventResponse {
  return {
    id: row.tweet_id,
    timestamp: row.tweet_created_at || row.parsed_at,
    content: row.tweet_text || '',
    text: row.tweet_text || '',
    event_type: row.event_type || 'other',
    event_type_hi: row.event_type_hi || 'अन्य', // Hindi translation
    event_type_confidence: parseNumber(row.event_type_confidence),
    overall_confidence: parseNumber(row.overall_confidence),
    needs_review: row.needs_review,
    review_status: row.review_status,
    locations: ensureArray(row.locations),
    people_mentioned: ensureArray(row.people_mentioned),
    organizations: ensureArray(row.organizations),
    schemes_mentioned: ensureArray(row.schemes_mentioned),
    parsed_by: row.parsed_by,
    parsed_at: row.parsed_at,
    ...(row.reviewed_at && { reviewed_at: row.reviewed_at }),
    ...(row.reviewed_by && { reviewed_by: row.reviewed_by }),
  };
}

function aggregateAnalytics(rows: ParsedEvent[]) {
  const eventDistribution: Record<string, number> = {};
  const locationDistribution: Record<string, number> = {};
  const schemeUsage: Record<string, number> = {};
  const timeline: Record<string, number> = {};
  const dayOfWeek: Record<string, number> = {
    Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0
  };

  rows.forEach(row => {
    // Event types
    const eventType = row.event_type || 'Unknown';
    eventDistribution[eventType] = (eventDistribution[eventType] || 0) + 1;

    // Locations
    const locations = ensureArray(row.locations);
    locations.forEach((loc: any) => {
      const name = typeof loc === 'string' ? loc : loc?.name;
      if (name) {
        locationDistribution[name] = (locationDistribution[name] || 0) + 1;
      }
    });

    // Schemes
    const schemes = ensureArray(row.schemes_mentioned);
    schemes.forEach((scheme: string) => {
      if (scheme) {
        schemeUsage[scheme] = (schemeUsage[scheme] || 0) + 1;
      }
    });

    // Timeline
    const date = row.event_date;
    if (date) {
      timeline[date] = (timeline[date] || 0) + 1;
    }

    // Day of week
    if (row.event_date) {
      const day = new Date(row.event_date).toLocaleDateString('en-US', { weekday: 'long' });
      dayOfWeek[day] = (dayOfWeek[day] || 0) + 1;
    }
  });

  return {
    total_tweets: rows.length,
    event_distribution: eventDistribution,
    location_distribution: locationDistribution,
    scheme_usage: schemeUsage,
    timeline: Object.entries(timeline)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    day_of_week: dayOfWeek,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000);
    const needsReview = searchParams.get('needs_review');
    const reviewStatus = searchParams.get('review_status');
    const analytics = searchParams.get('analytics') === 'true';

    // Build query parameters
    const params: any[] = [];
    let paramIndex = 1;

    let whereClause = '';

    // Filter by needs_review
    if (needsReview === 'true') {
      whereClause += ` AND pe.needs_review = true`;
    } else if (needsReview === 'false') {
      whereClause += ` AND pe.needs_review = false AND pe.review_status = $${paramIndex}`;
      params.push('approved');
      paramIndex++;
    }

    // Filter by review_status
    if (reviewStatus) {
      whereClause += ` AND pe.review_status = $${paramIndex}`;
      params.push(reviewStatus);
      paramIndex++;
    }

    // For analytics, only include approved events
    if (analytics) {
      whereClause += ` AND pe.needs_review = false AND pe.review_status = $${paramIndex}`;
      params.push('approved');
      paramIndex++;
    }

    params.push(limit);

    const query = `
      SELECT
        pe.id,
        pe.tweet_id,
        pe.event_type,
        pe.event_type_hi,
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
        rt.text as tweet_text,
        rt.created_at as tweet_created_at,
        rt.author_handle,
        rt.retweet_count,
        rt.reply_count,
        rt.like_count,
        rt.quote_count,
        rt.hashtags,
        rt.mentions,
        rt.urls
      FROM parsed_events pe
      LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
      WHERE 1=1 ${whereClause}
      ORDER BY pe.parsed_at DESC
      LIMIT $${paramIndex}
    `;

    try {
      const result = await getPool().query(query, params);
      const rows = result.rows;

      let responseData: any = {
        success: true,
        source: 'database',
        total: rows.length,
        data: rows.map(mapParsedEvent),
        events: rows.map(mapParsedEvent), // Backward compatibility
      };

      if (analytics) {
        responseData.analytics = aggregateAnalytics(rows);
      }

      return NextResponse.json(responseData);
    } catch (dbError) {
      console.error('Database error:', dbError);

      // Fallback to static file
      try {
        const filePath = path.join(process.cwd(), 'data', 'parsed_tweets.json');
        if (fs.existsSync(filePath)) {
          const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

          // Apply filters to file data
          let filteredData = fileData;
          if (needsReview === 'true') {
            filteredData = filteredData.filter((item: any) => item.needs_review === true);
          } else if (needsReview === 'false') {
            filteredData = filteredData.filter((item: any) =>
              item.needs_review === false && item.review_status === 'approved'
            );
          }

          if (reviewStatus) {
            filteredData = filteredData.filter((item: any) => item.review_status === reviewStatus);
          }

          if (analytics) {
            filteredData = filteredData.filter((item: any) =>
              item.needs_review === false && item.review_status === 'approved'
            );
          }

          const limitedData = filteredData.slice(0, limit);

          let responseData: any = {
            success: true,
            source: 'static_file',
            total: limitedData.length,
            data: limitedData,
            events: limitedData, // Backward compatibility
          };

          if (analytics) {
            responseData.analytics = aggregateAnalytics(limitedData.map((item: any) => ({
              ...item,
              locations: ensureArray(item.locations),
              people_mentioned: ensureArray(item.people_mentioned),
              organizations: ensureArray(item.organizations),
              schemes_mentioned: ensureArray(item.schemes_mentioned),
            })));
          }

          return NextResponse.json(responseData);
        }
      } catch (fileError) {
        console.error('File fallback error:', fileError);
      }

      return NextResponse.json({
        success: false,
        source: 'empty',
        total: 0,
        data: [],
        events: [],
        error: 'Failed to fetch parsed events',
      });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch parsed events',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json(
        { success: false, error: 'Missing id or updates' },
        { status: 400 }
      );
    }

    // For now, use file-based updates as database updates require more complex logic
    const filePath = path.join(process.cwd(), 'data', 'parsed_tweets.json');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: 'Data file not found' },
        { status: 404 }
      );
    }

    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const itemIndex = fileData.findIndex((item: any) => item.id === id);

    if (itemIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Tweet not found' },
        { status: 404 }
      );
    }

    // Update the item
    const updatedItem = { ...fileData[itemIndex], ...updates };
    fileData[itemIndex] = updatedItem;

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));

    return NextResponse.json({
      success: true,
      data: updatedItem,
    });
  } catch (error) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update parsed event',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
