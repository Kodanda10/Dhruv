import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Database configuration - lazy initialization
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

interface AnalyticsFilters {
  start_date?: string;
  end_date?: string;
  location?: string;
  event_type?: string;
}

interface AnalyticsResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Build WHERE clause for analytics queries
 */
function buildWhereClause(filters: AnalyticsFilters): { clause: string; params: (string | Date)[] } {
  const conditions: string[] = [];
  const params: (string | Date)[] = [];
  let paramIndex = 1;

  if (filters.start_date) {
    conditions.push(`pe.created_at >= $${paramIndex}`);
    params.push(new Date(filters.start_date));
    paramIndex++;
  }

  if (filters.end_date) {
    conditions.push(`pe.created_at <= $${paramIndex}`);
    params.push(new Date(filters.end_date));
    paramIndex++;
  }

  if (filters.location) {
    conditions.push(`$${paramIndex} = ANY(pe.locations)`);
    params.push(filters.location);
    paramIndex++;
  }

  if (filters.event_type) {
    conditions.push(`pe.event_type = $${paramIndex}`);
    params.push(filters.event_type);
    paramIndex++;
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
}

/**
 * Aggregate event type distribution
 */
async function getEventDistribution(filters: AnalyticsFilters): Promise<Record<string, number>> {
  const pool = getPool();
  const { clause, params } = buildWhereClause(filters);

  const query = `
    SELECT
      COALESCE(pe.event_type_hi, pe.event_type) as event_type,
      COUNT(*) as count
    FROM parsed_events pe
    ${clause}
    GROUP BY COALESCE(pe.event_type_hi, pe.event_type)
    ORDER BY count DESC
  `;

  const result = await pool.query(query, params);
  return Object.fromEntries(result.rows.map(row => [row.event_type, parseInt(row.count)]));
}

/**
 * Aggregate location distribution
 */
async function getLocationDistribution(filters: AnalyticsFilters): Promise<Record<string, number>> {
  const pool = getPool();
  const { clause, params } = buildWhereClause(filters);

  const query = `
    SELECT
      unnest(pe.locations) as location,
      COUNT(*) as count
    FROM parsed_events pe
    ${clause}
    GROUP BY unnest(pe.locations)
    ORDER BY count DESC
    LIMIT 20
  `;

  const result = await pool.query(query, params);
  return Object.fromEntries(result.rows.map(row => [row.location, parseInt(row.count)]));
}

/**
 * Aggregate scheme usage
 */
async function getSchemeUsage(filters: AnalyticsFilters): Promise<Record<string, number>> {
  const pool = getPool();
  const { clause, params } = buildWhereClause(filters);

  const query = `
    SELECT
      unnest(pe.schemes_mentioned) as scheme,
      COUNT(*) as count
    FROM parsed_events pe
    ${clause}
    GROUP BY unnest(pe.schemes_mentioned)
    ORDER BY count DESC
    LIMIT 15
  `;

  const result = await pool.query(query, params);
  return Object.fromEntries(result.rows.map(row => [row.scheme, parseInt(row.count)]));
}

/**
 * Get timeline data
 */
async function getTimelineData(filters: AnalyticsFilters): Promise<{ date: string; count: number }[]> {
  const pool = getPool();
  const { clause, params } = buildWhereClause(filters);

  const query = `
    SELECT
      DATE(pe.created_at) as date,
      COUNT(*) as count
    FROM parsed_events pe
    ${clause}
    GROUP BY DATE(pe.created_at)
    ORDER BY date ASC
    LIMIT 30
  `;

  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    date: row.date.toISOString().split('T')[0],
    count: parseInt(row.count)
  }));
}

/**
 * Get day of week distribution
 */
async function getDayOfWeekData(filters: AnalyticsFilters): Promise<Record<string, number>> {
  const pool = getPool();
  const { clause, params } = buildWhereClause(filters);

  const query = `
    SELECT
      CASE EXTRACT(DOW FROM pe.created_at)
        WHEN 0 THEN 'रविवार'
        WHEN 1 THEN 'सोमवार'
        WHEN 2 THEN 'मंगलवार'
        WHEN 3 THEN 'बुधवार'
        WHEN 4 THEN 'गुरुवार'
        WHEN 5 THEN 'शुक्रवार'
        WHEN 6 THEN 'शनिवार'
      END as day_name,
      COUNT(*) as count
    FROM parsed_events pe
    ${clause}
    GROUP BY EXTRACT(DOW FROM pe.created_at), day_name
    ORDER BY EXTRACT(DOW FROM pe.created_at)
  `;

  const result = await pool.query(query, params);
  return Object.fromEntries(result.rows.map(row => [row.day_name, parseInt(row.count)]));
}

/**
 * Get caste/community data (inferred from tweet content)
 */
async function getCasteCommunityData(filters: AnalyticsFilters): Promise<Record<string, number>> {
  const pool = getPool();
  const { clause, params } = buildWhereClause(filters);

  // Simplified community detection based on keywords
  const communityKeywords = {
    'साहू': ['साहू', 'साहु', 'साहू समाज'],
    'तेली': ['तेली', 'तैलियों', 'तेली समाज'],
    'मुस्लिम': ['मुस्लिम', 'मुसलमान', 'मुस्लिम समाज'],
    'यादव': ['यादव', 'यादव समाज'],
    'अन्य': [] // Catch-all for other communities
  };

  const communityCounts: Record<string, number> = {};

  for (const [community, keywords] of Object.entries(communityKeywords)) {
    if (keywords.length === 0) continue; // Skip 'अन्य' for now

    const keywordConditions = keywords.map((_, index) => `rt.text ILIKE $${params.length + index + 1}`).join(' OR ');
    const keywordParams = keywords.map(keyword => `%${keyword}%`);

    const query = `
      SELECT COUNT(*) as count
      FROM parsed_events pe
      JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
      ${clause}
      ${clause ? 'AND' : 'WHERE'} (${keywordConditions})
    `;

    const result = await pool.query(query, [...params, ...keywordParams]);
    communityCounts[community] = parseInt(result.rows[0].count);
  }

  // Calculate 'अन्य' as total minus known communities
  const totalQuery = `SELECT COUNT(*) as count FROM parsed_events pe ${clause}`;
  const totalResult = await pool.query(totalQuery, params);
  const total = parseInt(totalResult.rows[0].count);
  const knownTotal = Object.values(communityCounts).reduce((sum, count) => sum + count, 0);
  communityCounts['अन्य'] = Math.max(0, total - knownTotal);

  return communityCounts;
}

/**
 * Get target group data (women, youth, farmers, senior citizens)
 */
async function getTargetGroupsData(filters: AnalyticsFilters): Promise<Record<string, number>> {
  const pool = getPool();
  const { clause, params } = buildWhereClause(filters);

  const groupKeywords = {
    'महिला': ['महिला', 'महिलाओं', 'माँ', 'बहन', 'बेटी', 'स्त्री'],
    'युवा': ['युवा', 'युवाओं', 'नौजवान', 'छात्र', 'विद्यार्थी'],
    'किसान': ['किसान', 'किसानों', 'कृषक', 'खेती', 'कृषि'],
    'वरिष्ठ नागरिक': ['वरिष्ठ', 'बुजुर्ग', 'बूढ़े', 'पेंशनर'],
    'अन्य': [] // Catch-all
  };

  const groupCounts: Record<string, number> = {};

  for (const [group, keywords] of Object.entries(groupKeywords)) {
    if (keywords.length === 0) continue;

    const keywordConditions = keywords.map((_, index) => `rt.text ILIKE $${params.length + index + 1}`).join(' OR ');
    const keywordParams = keywords.map(keyword => `%${keyword}%`);

    const query = `
      SELECT COUNT(*) as count
      FROM parsed_events pe
      JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
      ${clause}
      ${clause ? 'AND' : 'WHERE'} (${keywordConditions})
    `;

    const result = await pool.query(query, [...params, ...keywordParams]);
    groupCounts[group] = parseInt(result.rows[0].count);
  }

  return groupCounts;
}

/**
 * Get thematic analysis data
 */
async function getThematicAnalysis(filters: AnalyticsFilters): Promise<Record<string, number>> {
  const pool = getPool();
  const { clause, params } = buildWhereClause(filters);

  const themes = {
    'रोजगार': ['रोजगार', 'नौकरी', 'जॉब', 'काम', 'रोज़गार'],
    'शिक्षा': ['शिक्षा', 'स्कूल', 'कॉलेज', 'पढ़ाई', 'विद्यालय'],
    'स्वास्थ्य': ['स्वास्थ्य', 'हॉस्पिटल', 'डॉक्टर', 'बीमारी', 'इलाज'],
    'आधारभूत संरचना': ['सड़क', 'पानी', 'बिजली', 'घर', 'बिल्डिंग'],
    'अन्य': [] // Catch-all
  };

  const themeCounts: Record<string, number> = {};

  for (const [theme, keywords] of Object.entries(themes)) {
    if (keywords.length === 0) continue;

    const keywordConditions = keywords.map((_, index) => `rt.text ILIKE $${params.length + index + 1}`).join(' OR ');
    const keywordParams = keywords.map(keyword => `%${keyword}%`);

    const query = `
      SELECT COUNT(*) as count
      FROM parsed_events pe
      JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
      ${clause}
      ${clause ? 'AND' : 'WHERE'} (${keywordConditions})
    `;

    const result = await pool.query(query, [...params, ...keywordParams]);
    themeCounts[theme] = parseInt(result.rows[0].count);
  }

  return themeCounts;
}

/**
 * Get Raigarh-specific section data
 */
async function getRaigarhSectionData(filters: AnalyticsFilters): Promise<any> {
  const pool = getPool();
  const raigarhFilters = { ...filters, location: 'रायगढ़' };
  const { clause, params } = buildWhereClause(raigarhFilters);

  // Coverage percentage (simplified - in real app would calculate based on known villages)
  const coverageQuery = `SELECT COUNT(DISTINCT unnest(locations)) as covered_locations FROM parsed_events pe ${clause}`;
  const coverageResult = await pool.query(coverageQuery, params);
  const coveredLocations = parseInt(coverageResult.rows[0].covered_locations);

  // Assume 150 known locations in Raigarh for calculation
  const totalKnownLocations = 150;
  const coveragePercentage = Math.min(100, Math.round((coveredLocations / totalKnownLocations) * 100));

  // Local events (recent events in Raigarh)
  const eventsQuery = `
    SELECT
      DATE(pe.created_at) as date,
      unnest(pe.locations) as location,
      COALESCE(pe.event_type_hi, pe.event_type) as type,
      LEFT(rt.text, 100) as description
    FROM parsed_events pe
    JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
    ${clause}
    ORDER BY pe.created_at DESC
    LIMIT 10
  `;

  const eventsResult = await pool.query(eventsQuery, params);
  const localEvents = eventsResult.rows.map(row => ({
    date: row.date.toISOString().split('T')[0],
    location: row.location,
    type: row.type,
    description: row.description + '...'
  }));

  // Community data for Raigarh
  const communityData = await getCasteCommunityData(raigarhFilters);

  // Engagement metrics
  const engagementQuery = `
    SELECT
      SUM(rt.like_count) as total_likes,
      SUM(rt.retweet_count) as total_retweets,
      SUM(rt.reply_count) as total_replies
    FROM parsed_events pe
    JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
    ${clause}
  `;

  const engagementResult = await pool.query(engagementQuery, params);
  const engagementMetrics = {
    total_likes: parseInt(engagementResult.rows[0].total_likes || 0),
    total_retweets: parseInt(engagementResult.rows[0].total_retweets || 0),
    total_replies: parseInt(engagementResult.rows[0].total_replies || 0)
  };

  return {
    coverage_percentage: coveragePercentage,
    local_events: localEvents,
    community_data: communityData,
    engagement_metrics: engagementMetrics
  };
}

export async function GET(request: NextRequest): Promise<NextResponse<AnalyticsResponse>> {
  try {
    const { searchParams } = new URL(request.url);

    const filters: AnalyticsFilters = {
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      location: searchParams.get('location') || undefined,
      event_type: searchParams.get('event_type') || undefined,
    };

    // Validate date formats
    if (filters.start_date && isNaN(Date.parse(filters.start_date))) {
      return NextResponse.json(
        { success: false, error: 'अमान्य प्रारंभ दिनांक' },
        { status: 400 }
      );
    }

    if (filters.end_date && isNaN(Date.parse(filters.end_date))) {
      return NextResponse.json(
        { success: false, error: 'अमान्य समाप्ति दिनांक' },
        { status: 400 }
      );
    }

    console.log('Generating analytics data:', filters);

    // Get total count
    const pool = getPool();
    const { clause, params } = buildWhereClause(filters);
    const totalQuery = `SELECT COUNT(*) as total FROM parsed_events pe ${clause}`;
    const totalResult = await pool.query(totalQuery, params);
    const totalTweets = parseInt(totalResult.rows[0].total);

    // Generate all analytics data in parallel
    const [
      eventDistribution,
      locationDistribution,
      schemeUsage,
      timeline,
      dayOfWeek,
      casteCommunity,
      targetGroups,
      thematicAnalysis,
      raigarhSection
    ] = await Promise.all([
      getEventDistribution(filters),
      getLocationDistribution(filters),
      getSchemeUsage(filters),
      getTimelineData(filters),
      getDayOfWeekData(filters),
      getCasteCommunityData(filters),
      getTargetGroupsData(filters),
      getThematicAnalysis(filters),
      getRaigarhSectionData(filters)
    ]);

    const analyticsData = {
      total_tweets: totalTweets,
      event_distribution: eventDistribution,
      location_distribution: locationDistribution,
      scheme_usage: schemeUsage,
      timeline,
      day_of_week: dayOfWeek,
      caste_community: casteCommunity,
      target_groups: targetGroups,
      thematic_analysis: thematicAnalysis,
      raigarh_section: raigarhSection
    };

    console.log('Analytics data generated successfully');
    return NextResponse.json({
      success: true,
      data: analyticsData
    });

  } catch (error) {
    console.error('Analytics generation error:', error);
    return NextResponse.json(
      { success: false, error: 'एनालिटिक्स डेटा जनरेट करने में त्रुटि' },
      { status: 500 }
    );
  }
}
