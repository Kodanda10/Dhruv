import { QueryResult } from 'pg';
import { db } from '../db';
import { AnalyticsData, AnalyticsFilters, RaigarhEventRow, TagRow } from '../types';
import { buildFilterClause, deriveTagInsights, HINDI_DAYS, RAIGARH_TARGET_TOTAL, normalizeVillage, summarizeText, rowsToMap, COMMUNITY_KEYWORDS, TARGET_GROUPS, THEME_KEYWORDS } from './utils';

interface TimelineRow {
  date: string;
  count: string;
}

interface DayRow {
  dow: string;
  count: string;
}

export async function fetchAnalyticsData(filters: AnalyticsFilters = {}): Promise<AnalyticsData> {
  const { whereClause, values } = buildFilterClause(filters);
  const filteredCTE = `WITH filtered AS (
    SELECT pe.*, COALESCE(pe.event_date, DATE(pe.parsed_at)) AS resolved_date
    FROM parsed_events pe
    ${whereClause}
  )`;

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
      db.query(`SELECT COUNT(*)::INT AS count FROM raw_tweets`, []),
      db.query(
        `${filteredCTE} SELECT COALESCE(NULLIF(TRIM(event_type), ''), 'अनिर्दिष्ट') AS key, COUNT(*)::INT AS count FROM filtered GROUP BY key ORDER BY count DESC`,
        values,
      ),
      db.query(
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
      db.query(
        `${filteredCTE}
         SELECT LOWER(scheme) AS key, COUNT(*)::INT AS count
         FROM filtered
         CROSS JOIN LATERAL unnest(COALESCE(filtered.schemes_mentioned, ARRAY[]::text[])) scheme
         GROUP BY key
         ORDER BY count DESC
         LIMIT 50`,
        values,
      ),
      db.query<TimelineRow>(
        `${filteredCTE}
         SELECT TO_CHAR(resolved_date, 'YYYY-MM-DD') AS date, COUNT(*)::INT AS count
         FROM filtered
         WHERE resolved_date IS NOT NULL
         GROUP BY resolved_date
         ORDER BY resolved_date DESC
         LIMIT 90`,
        values,
      ),
      db.query<DayRow>(
        `${filteredCTE}
         SELECT EXTRACT(DOW FROM resolved_date)::INT AS dow, COUNT(*)::INT AS count
         FROM filtered
         WHERE resolved_date IS NOT NULL
         GROUP BY dow`,
        values,
      ),
      queryTags(filteredCTE, values),
      db.query<RaigarhEventRow>(
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
      queryRaigarhCommunity(filteredCTE, values),
      db.query(
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
        total_villages: RAIGARH_TARGET_TOTAL,
        visited_villages: uniqueRaigarhLocations,
        local_events: raigarhLocalEvents.slice(0, 10),
        community_data: raigarhCommunityData,
        engagement_metrics: {
          total_likes: Number(engagementRowData.likes || 0),
          total_retweets: Number(engagementRowData.retweets || 0),
          total_replies: Number(engagementRowData.replies || 0),
        },
      },
    };
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    throw new Error('Failed to fetch analytics data from the database.');
  }
}

async function queryTags(filteredCTE: string, values: any[]): Promise<QueryResult<TagRow>> {
  try {
    const result = await db.query<TagRow>(
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
    return result;
  } catch (error: any) {
    if (error?.message?.includes('relation') && error?.message?.includes('tweet_tags')) {
      console.warn('tweet_tags table missing, skipping tag insights');
      return { rows: [] } as any;
    }
    throw error;
  }
}

async function queryRaigarhCommunity(filteredCTE: string, values: any[]): Promise<QueryResult<any>> {
  try {
    return await db.query(
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
