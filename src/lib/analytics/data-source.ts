import fs from 'fs';
import path from 'path';
import { Pool, PoolClient, QueryResult } from 'pg';

const DEFAULT_DB_URL = 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DB_URL,
  ssl: shouldUseSSL(process.env.DATABASE_URL),
});

function shouldUseSSL(connectionString?: string) {
  if (!connectionString) {
    return undefined;
  }
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

const HINDI_DAYS = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];

const RAIGARH_TARGET_TOTAL = loadRaigarhTargets();

export interface AnalyticsData {
  total_tweets: number;
  event_distribution: Record<string, number>;
  location_distribution: Record<string, number>;
  scheme_usage: Record<string, number>;
  timeline: { date: string; count: number }[];
  day_of_week: Record<string, number>;
  caste_community: Record<string, number>;
  target_groups: Record<string, number>;
  thematic_analysis: Record<string, number>;
  raigarh_section: {
    coverage_percentage: number;
    local_events: {
      date: string;
      location: string;
      type: string;
      description: string;
    }[];
    community_data: Record<string, number>;
    engagement_metrics: {
      total_likes: number;
      total_retweets: number;
      total_replies: number;
    };
  };
}

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  location?: string;
}

interface FilterClause {
  whereClause: string;
  values: any[];
}

function normalizeDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function normalizeLocation(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'रायगढ़ / छत्तीसगढ़') return undefined;
  return trimmed;
}

const APPROVED_EVENT_CONDITION =
  `pe.needs_review = false AND (pe.review_status IS NULL OR pe.review_status = 'approved')`;

function buildFilterClause(filters: AnalyticsFilters): FilterClause {
  const conditions: string[] = [APPROVED_EVENT_CONDITION];
  const values: any[] = [];
  let index = 1;

  const startDate = normalizeDate(filters.startDate);
  const endDate = normalizeDate(filters.endDate);
  const location = normalizeLocation(filters.location);

  if (startDate) {
    conditions.push(`COALESCE(pe.event_date, DATE(pe.parsed_at)) >= $${index}`);
    values.push(startDate);
    index += 1;
  }

  if (endDate) {
    conditions.push(`COALESCE(pe.event_date, DATE(pe.parsed_at)) <= $${index}`);
    values.push(endDate);
    index += 1;
  }

  if (location) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(pe.locations, '[]'::jsonb)) loc
      WHERE COALESCE(loc->>'district', '') ILIKE $${index}
        OR COALESCE(loc->>'name', '') ILIKE $${index}
    )`);
    values.push(`%${location}%`);
    index += 1;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, values };
}

const COMMUNITY_KEYWORDS = [/समाज/, /सभा/, /महासभा/, /कमेटी/, /यादव/i, /साहू/i, /तेली/i, /गौंड/i, /मुस्लिम/i, /खरी/];
const TARGET_GROUPS: Record<string, RegExp[]> = {
  'महिला': [/महिला/, /नारी/],
  'युवा': [/युवा/, /छात्र/, /छात्रा/],
  'किसान': [/किसान/, /कृषक/],
  'वरिष्ठ नागरिक': [/वरिष्ठ/, /सीनियर/],
  'उद्यमी': [/उद्यमी/, /व्यवसाय/],
};

const THEME_KEYWORDS: Record<string, RegExp[]> = {
  'रोज़गार': [/रोजगार/, /रोज़गार/, /रोजगार/i],
  'शिक्षा': [/शिक्षा/, /school/i, /college/i],
  'स्वास्थ्य': [/स्वास्थ्य/, /health/, /अस्पताल/],
  'आधारभूत संरचना': [/सड़क/, /पुल/, /इन्फ्रा/, /आधारभूत/],
  'कृषि': [/कृषि/, /खेती/],
  'खेल': [/खेल/, /sports/i],
};

function loadRaigarhTargets(): number {
  try {
    const filePath = path.join(process.cwd(), 'data', 'raigarh_assembly_constituency_detailed.json');
    const file = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(file);
    const uniqueVillages = new Set<string>();
    const blocks = data?.blocks || {};
    Object.values<any>(blocks).forEach((block) => {
      const gps = block?.gram_panchayats || {};
      Object.values<any>(gps).forEach((villages: string[]) => {
        (villages || []).forEach((v) => {
          if (typeof v === 'string' && v.trim()) {
            uniqueVillages.add(normalizeVillage(v));
          }
        });
      });
    });
    return uniqueVillages.size || 0;
  } catch (error) {
    console.warn('Unable to load Raigarh targets for coverage calculation:', error);
    return 0;
  }
}

function normalizeVillage(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

type TagRow = {
  label_hi: string | null;
  label_en: string | null;
  slug: string | null;
  count: number;
};

type RaigarhEventRow = {
  event_date: string | null;
  event_type: string | null;
  text: string | null;
  location_name: string | null;
  district: string | null;
};

export async function fetchAnalyticsData(filters: AnalyticsFilters = {}): Promise<AnalyticsData> {
  const { whereClause, values } = buildFilterClause(filters);
  const filteredCTE = `WITH filtered AS (
    SELECT pe.*, COALESCE(pe.event_date, DATE(pe.parsed_at)) AS resolved_date
    FROM parsed_events pe
    ${whereClause}
  )`;

  const client = await pool.connect();

  try {
    const [
      totalRows,
      eventRows,
      locationRows,
      schemeRows,
      timelineRows,
      dayRows,
      tagRowsResult,
      raigarhRows,
      raigarhCommunityRows,
      engagementRow,
    ] = await Promise.all([
      client.query(`${filteredCTE} SELECT COUNT(*)::INT AS count FROM filtered`, values),
      client.query(
        `${filteredCTE} SELECT COALESCE(NULLIF(TRIM(event_type), ''), 'अनिर्दिष्ट') AS key, COUNT(*)::INT AS count FROM filtered GROUP BY key ORDER BY count DESC`,
        values,
      ),
      client.query(
        `${filteredCTE}
         SELECT COALESCE(NULLIF(TRIM(loc->>'district'), ''), NULLIF(TRIM(loc->>'name'), ''), 'अनिर्दिष्ट') AS key,
                COUNT(*)::INT AS count
         FROM filtered
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(filtered.locations, '[]'::jsonb)) loc
         GROUP BY key
         ORDER BY count DESC
         LIMIT 50`,
        values,
      ),
      client.query(
        `${filteredCTE}
         SELECT LOWER(scheme) AS key, COUNT(*)::INT AS count
         FROM filtered
         CROSS JOIN LATERAL unnest(COALESCE(filtered.schemes_mentioned, ARRAY[]::text[])) scheme
         GROUP BY key
         ORDER BY count DESC
         LIMIT 50`,
        values,
      ),
      client.query(
        `${filteredCTE}
         SELECT TO_CHAR(resolved_date, 'YYYY-MM-DD') AS date, COUNT(*)::INT AS count
         FROM filtered
         WHERE resolved_date IS NOT NULL
         GROUP BY resolved_date
         ORDER BY resolved_date DESC
         LIMIT 90`,
        values,
      ),
      client.query(
        `${filteredCTE}
         SELECT EXTRACT(DOW FROM resolved_date)::INT AS dow, COUNT(*)::INT AS count
         FROM filtered
         WHERE resolved_date IS NOT NULL
         GROUP BY dow`,
        values,
      ),
      queryTags(client, filteredCTE, values),
      client.query<RaigarhEventRow>(
        `${filteredCTE}
         SELECT COALESCE(filtered.resolved_date::TEXT, '') AS event_date,
                COALESCE(filtered.event_type, 'अनिर्दिष्ट') AS event_type,
                rt.text,
                loc->>'name' AS location_name,
                loc->>'district' AS district
         FROM filtered
         JOIN raw_tweets rt ON rt.tweet_id = filtered.tweet_id
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(filtered.locations, '[]'::jsonb)) loc
         WHERE (COALESCE(loc->>'district', '') ILIKE '%रायगढ़%' OR COALESCE(loc->>'name', '') ILIKE '%रायगढ़%')
         ORDER BY filtered.resolved_date DESC NULLS LAST, filtered.parsed_at DESC
         LIMIT 50`,
        values,
      ),
      queryRaigarhCommunity(client, filteredCTE, values),
      client.query(
        `${filteredCTE}
         SELECT COALESCE(SUM(rt.like_count), 0)::BIGINT AS likes,
                COALESCE(SUM(rt.retweet_count), 0)::BIGINT AS retweets,
                COALESCE(SUM(rt.reply_count), 0)::BIGINT AS replies
         FROM filtered
         JOIN raw_tweets rt ON rt.tweet_id = filtered.tweet_id`,
        values,
      ),
    ]);

    const total = totalRows.rows[0]?.count || 0;
    const event_distribution = rowsToMap(eventRows.rows);
    const location_distribution = rowsToMap(locationRows.rows);
    const scheme_usage = rowsToMap(schemeRows.rows, 'अनिर्दिष्ट योजना');
    const timeline = timelineRows.rows
      .map((row) => ({ date: row.date, count: Number(row.count) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const day_of_week = dayRows.rows.reduce<Record<string, number>>((acc, row) => {
      const dayIndex = Number(row.dow);
      if (!Number.isNaN(dayIndex)) {
        const label = HINDI_DAYS[dayIndex] || `${dayIndex}`;
        acc[label] = Number(row.count);
      }
      return acc;
    }, {});

    const { casteMap, targetMap, themeMap } = deriveTagInsights(tagRowsResult.rows);

    const raigarhLocalEvents = raigarhRows.rows.map((row) => ({
      date: row.event_date || '',
      location: row.location_name || row.district || 'रायगढ़',
      type: row.event_type || 'अनिर्दिष्ट',
      description: summarizeText(row.text || ''),
    }));

    const uniqueRaigarhLocations = new Set(
      raigarhRows.rows
        .map((row) => normalizeVillage(row.location_name || row.district || ''))
        .filter(Boolean),
    ).size;

    const coverage_percentage = RAIGARH_TARGET_TOTAL
      ? Math.min(100, Math.round((uniqueRaigarhLocations / RAIGARH_TARGET_TOTAL) * 100))
      : Math.min(100, uniqueRaigarhLocations * 3);

    const raigarhCommunityData = rowsToMap((raigarhCommunityRows || { rows: [] }).rows, 'रायगढ़ समाज');

    const engagementRowData = engagementRow.rows[0] || { likes: 0, retweets: 0, replies: 0 };

    return {
      total_tweets: total,
      event_distribution,
      location_distribution,
      scheme_usage,
      timeline,
      day_of_week,
      caste_community: casteMap,
      target_groups: targetMap,
      thematic_analysis: themeMap,
      raigarh_section: {
        coverage_percentage,
        local_events: raigarhLocalEvents.slice(0, 10),
        community_data: raigarhCommunityData,
        engagement_metrics: {
          total_likes: Number(engagementRowData.likes || 0),
          total_retweets: Number(engagementRowData.retweets || 0),
          total_replies: Number(engagementRowData.replies || 0),
        },
      },
    };
  } finally {
    client.release();
  }
}

function rowsToMap(rows: any[], fallback?: string): Record<string, number> {
  if (!rows || rows.length === 0) {
    return fallback ? { [fallback]: 0 } : {};
  }
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.key || fallback || 'अनिर्दिष्ट';
    acc[key] = Number(row.count) || 0;
    return acc;
  }, {});
}

function deriveTagInsights(rows: TagRow[] = []): {
  casteMap: Record<string, number>;
  targetMap: Record<string, number>;
  themeMap: Record<string, number>;
} {
  const casteMap: Record<string, number> = {};
  const targetMap: Record<string, number> = Object.keys(TARGET_GROUPS).reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
  const themeMap: Record<string, number> = Object.keys(THEME_KEYWORDS).reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  rows.forEach((row) => {
    const label = row.label_hi || row.label_en || row.slug || '';
    if (!label) return;
    const normalized = label.trim();
    const count = Number(row.count) || 0;

    if (COMMUNITY_KEYWORDS.some((regex) => regex.test(normalized))) {
      casteMap[normalized] = (casteMap[normalized] || 0) + count;
    }

    Object.entries(TARGET_GROUPS).forEach(([group, patterns]) => {
      if (patterns.some((regex) => regex.test(normalized))) {
        targetMap[group] = (targetMap[group] || 0) + count;
      }
    });

    Object.entries(THEME_KEYWORDS).forEach(([theme, patterns]) => {
      if (patterns.some((regex) => regex.test(normalized))) {
        themeMap[theme] = (themeMap[theme] || 0) + count;
      }
    });
  });

  return { casteMap, targetMap, themeMap };
}

async function queryTags(client: PoolClient, filteredCTE: string, values: any[]): Promise<QueryResult<TagRow>> {
  try {
    return await client.query<TagRow>(
      `${filteredCTE}
       SELECT t.label_hi, t.label_en, t.slug, COUNT(*)::INT AS count
       FROM filtered
       JOIN tweet_tags tt ON tt.tweet_id = filtered.tweet_id
       JOIN tags t ON t.id = tt.tag_id
       GROUP BY t.id, t.label_hi, t.label_en, t.slug
       ORDER BY count DESC
       LIMIT 200`,
      values,
    );
  } catch (error: any) {
    if (error?.message?.includes('relation') && error?.message?.includes('tweet_tags')) {
      console.warn('tweet_tags table missing, skipping tag insights');
      return { rows: [] } as any;
    }
    throw error;
  }
}

async function queryRaigarhCommunity(client: PoolClient, filteredCTE: string, values: any[]): Promise<QueryResult<any>> {
  try {
    return await client.query(
      `${filteredCTE}
       , raigarh AS (
         SELECT *
         FROM filtered
         WHERE EXISTS (
           SELECT 1
           FROM jsonb_array_elements(COALESCE(filtered.locations, '[]'::jsonb)) loc
           WHERE COALESCE(loc->>'district', '') ILIKE '%रायगढ़%'
              OR COALESCE(loc->>'name', '') ILIKE '%रायगढ़%'
         )
       )
       SELECT t.label_hi AS key, COUNT(*)::INT AS count
       FROM raigarh
       JOIN tweet_tags tt ON tt.tweet_id = raigarh.tweet_id
       JOIN tags t ON t.id = tt.tag_id
       GROUP BY t.label_hi
       ORDER BY count DESC
       LIMIT 50`,
      values,
    );
  } catch (error: any) {
    if (error?.message?.includes('relation') && error?.message?.includes('tweet_tags')) {
      return { rows: [] } as any;
    }
    throw error;
  }
}

function summarizeText(text: string, limit = 120): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}...`;
}
