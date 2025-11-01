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

    // Build WHERE clause
    let whereClause = `WHERE needs_review = false AND review_status = 'approved' AND geo_hierarchy->>'district' = $1`;
    const params: any[] = [district];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND parsed_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND parsed_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (eventType) {
      whereClause += ` AND event_type = $${paramIndex}`;
      params.push(eventType);
      paramIndex++;
    }

    // Assemblies in this district
    const assembliesQuery = `
      SELECT 
        geo_hierarchy->>'assembly' as assembly,
        COUNT(*) as event_count
      FROM parsed_events
      ${whereClause}
        AND geo_hierarchy->>'assembly' IS NOT NULL
      GROUP BY geo_hierarchy->>'assembly'
      ORDER BY event_count DESC
    `;

    // Blocks in this district
    const blocksQuery = `
      SELECT 
        geo_hierarchy->>'assembly' as assembly,
        geo_hierarchy->>'block' as block,
        COUNT(*) as event_count
      FROM parsed_events
      ${whereClause}
        AND geo_hierarchy->>'block' IS NOT NULL
      GROUP BY 
        geo_hierarchy->>'assembly',
        geo_hierarchy->>'block'
      ORDER BY assembly, event_count DESC
    `;

    // Villages/ULBs in this district
    const villagesQuery = `
      SELECT 
        geo_hierarchy->>'village' as village,
        geo_hierarchy->>'assembly' as assembly,
        geo_hierarchy->>'block' as block,
        geo_hierarchy->>'gram_panchayat' as gram_panchayat,
        geo_hierarchy->>'ulb' as ulb,
        geo_hierarchy->>'ward_no' as ward_no,
        geo_hierarchy->>'is_urban' as is_urban,
        COUNT(*) as event_count
      FROM parsed_events
      ${whereClause}
        AND geo_hierarchy->>'village' IS NOT NULL
      GROUP BY 
        geo_hierarchy->>'village',
        geo_hierarchy->>'assembly',
        geo_hierarchy->>'block',
        geo_hierarchy->>'gram_panchayat',
        geo_hierarchy->>'ulb',
        geo_hierarchy->>'ward_no',
        geo_hierarchy->>'is_urban'
      ORDER BY event_count DESC
    `;

    // Urban vs Rural breakdown
    const urbanRuralQuery = `
      SELECT 
        CASE 
          WHEN geo_hierarchy->>'is_urban' = 'true' THEN 'urban'
          ELSE 'rural'
        END as area_type,
        COUNT(*) as event_count
      FROM parsed_events
      ${whereClause}
        AND geo_hierarchy IS NOT NULL
      GROUP BY area_type
    `;

    // Event types in this district
    const eventTypesQuery = `
      SELECT 
        event_type,
        COUNT(*) as event_count
      FROM parsed_events
      ${whereClause}
        AND event_type IS NOT NULL
      GROUP BY event_type
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

    // Calculate total events
    const totalEvents = assembliesResult.rows.reduce((sum, row) => sum + parseInt(row.event_count), 0);

    // Format results
    const drilldown = {
      district,
      total_events: totalEvents,
      assemblies: assembliesResult.rows.map(row => ({
        assembly: row.assembly,
        event_count: parseInt(row.event_count),
      })),
      blocks: blocksResult.rows.map(row => ({
        assembly: row.assembly,
        block: row.block,
        event_count: parseInt(row.event_count),
      })),
      villages: villagesResult.rows.map(row => ({
        village: row.village,
        assembly: row.assembly,
        block: row.block,
        gram_panchayat: row.gram_panchayat || null,
        ulb: row.ulb || null,
        ward_no: row.ward_no ? parseInt(row.ward_no) : null,
        is_urban: row.is_urban === 'true',
        event_count: parseInt(row.event_count),
      })),
      urban_rural: urbanRuralResult.rows.reduce((acc, row) => {
        acc[row.area_type] = parseInt(row.event_count);
        return acc;
      }, {} as Record<string, number>),
      event_types: eventTypesResult.rows.map(row => ({
        event_type: row.event_type,
        event_count: parseInt(row.event_count),
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

