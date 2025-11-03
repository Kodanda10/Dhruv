/**
 * Geo Analytics By District Endpoint
 * 
 * GET /api/geo-analytics/by-district?district={district_name}
 * 
 * Returns drilldown analytics for a specific district:
 * - All assemblies in the district with event counts
 * - All blocks in the district with event counts
 * - All villages/ULBs in the district
 * - Urban vs Rural breakdown
 * - Event types distribution within district
 * 
 * Query Parameters:
 * - district (required): District name
 * - startDate (optional): Filter from date (ISO 8601)
 * - endDate (optional): Filter to date (ISO 8601)
 * - event_type (optional): Filter by event type
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDBPool } from '@/lib/db/pool';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const district = searchParams.get('district');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const eventType = searchParams.get('event_type');

    if (!district) {
      return NextResponse.json(
        {
          success: false,
          error: 'district parameter is required',
        },
        { status: 400 }
      );
    }

    const pool = getDBPool();

    // Build base WHERE clause (for parsed_events table)
    let baseWhereClause = "WHERE pe.needs_review = false AND pe.review_status = 'approved'";
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      baseWhereClause += ` AND pe.parsed_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      baseWhereClause += ` AND pe.parsed_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (eventType) {
      baseWhereClause += ` AND pe.event_type = $${paramIndex}`;
      params.push(eventType);
      paramIndex++;
    }

    // Build WHERE clause for geo_hierarchy filter
    const geoWhereClause = ` AND geo->>'district' = $${paramIndex}`;
    params.push(district);
    const fullWhereClause = `${baseWhereClause}${geoWhereClause}`;

    // Add geo_hierarchy NOT NULL check to full WHERE clause
    const fullWhereClauseWithGeo = `${fullWhereClause} AND pe.geo_hierarchy IS NOT NULL`;

    // Assemblies in this district
    const assembliesQuery = `
      SELECT 
        geo->>'assembly' as assembly,
        COUNT(DISTINCT pe.id) as event_count
      FROM parsed_events pe,
           jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo
      ${fullWhereClauseWithGeo}
        AND geo->>'assembly' IS NOT NULL
      GROUP BY geo->>'assembly'
      ORDER BY event_count DESC
    `;

    // Blocks in this district
    const blocksQuery = `
      SELECT 
        geo->>'assembly' as assembly,
        geo->>'block' as block,
        COUNT(DISTINCT pe.id) as event_count
      FROM parsed_events pe,
           jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo
      ${fullWhereClauseWithGeo}
        AND geo->>'block' IS NOT NULL
      GROUP BY 
        geo->>'assembly',
        geo->>'block'
      ORDER BY assembly, event_count DESC
    `;

    // Villages/ULBs in this district
    const villagesQuery = `
      SELECT 
        geo->>'village' as village,
        geo->>'assembly' as assembly,
        geo->>'block' as block,
        geo->>'gram_panchayat' as gram_panchayat,
        geo->>'ulb' as ulb,
        geo->>'ward_no' as ward_no,
        geo->>'is_urban' as is_urban,
        COUNT(DISTINCT pe.id) as event_count
      FROM parsed_events pe,
           jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo
      ${fullWhereClauseWithGeo}
        AND geo->>'village' IS NOT NULL
      GROUP BY 
        geo->>'village',
        geo->>'assembly',
        geo->>'block',
        geo->>'gram_panchayat',
        geo->>'ulb',
        geo->>'ward_no',
        geo->>'is_urban'
      ORDER BY event_count DESC
    `;

    // Urban vs Rural breakdown
    const urbanRuralQuery = `
      SELECT 
        CASE 
          WHEN geo->>'is_urban' = 'true' THEN 'urban'
          ELSE 'rural'
        END as area_type,
        COUNT(DISTINCT pe.id) as event_count
      FROM parsed_events pe,
           jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo
      ${fullWhereClauseWithGeo}
      GROUP BY area_type
    `;

    // Event types in this district
    const eventTypesQuery = `
      SELECT 
        pe.event_type,
        COUNT(DISTINCT pe.id) as event_count
      FROM parsed_events pe,
           jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo
      ${fullWhereClauseWithGeo}
        AND pe.event_type IS NOT NULL
      GROUP BY pe.event_type
      ORDER BY event_count DESC
    `;

    // Execute all queries
    const [assembliesResult, blocksResult, villagesResult, urbanRuralResult, eventTypesResult] = await Promise.all([
      pool.query(assembliesQuery, params),
      pool.query(blocksQuery, params),
      pool.query(villagesQuery, params),
      pool.query(urbanRuralQuery, params),
      pool.query(eventTypesQuery, params),
    ]);

    // Format results with null safety
    const assembliesRows = assembliesResult?.rows || [];
    const blocksRows = blocksResult?.rows || [];
    const villagesRows = villagesResult?.rows || [];
    const urbanRuralRows = urbanRuralResult?.rows || [];
    const eventTypesRows = eventTypesResult?.rows || [];

    // Calculate total events
    const totalEvents = assembliesRows.reduce((sum, row) => sum + parseInt(row.event_count || '0'), 0);

    // Format results
    const drilldown = {
      district,
      total_events: totalEvents,
      assemblies: assembliesRows.map(row => ({
        assembly: row.assembly,
        event_count: parseInt(row.event_count || '0'),
      })),
      blocks: blocksRows.map(row => ({
        assembly: row.assembly,
        block: row.block,
        event_count: parseInt(row.event_count || '0'),
      })),
      villages: villagesRows.map(row => ({
        village: row.village,
        assembly: row.assembly,
        block: row.block,
        gram_panchayat: row.gram_panchayat || null,
        ulb: row.ulb || null,
        ward_no: row.ward_no ? parseInt(row.ward_no) : null,
        is_urban: row.is_urban === 'true',
        event_count: parseInt(row.event_count || '0'),
      })),
      urban_rural: urbanRuralRows.reduce((acc, row) => {
        acc[row.area_type] = parseInt(row.event_count || '0');
        return acc;
      }, {} as Record<string, number>),
      event_types: eventTypesRows.map(row => ({
        event_type: row.event_type,
        event_count: parseInt(row.event_count || '0'),
      })),
      filters: {
        start_date: startDate || null,
        end_date: endDate || null,
        event_type: eventType || null,
      },
    };

    return NextResponse.json({
      success: true,
      data: drilldown,
      source: 'database',
    });

  } catch (error) {
    console.error('Geo analytics by-district error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to generate district drilldown',
      },
      { status: 500 }
    );
  }
}

