/**
 * Geo Analytics Summary Endpoint
 * 
 * GET /api/geo-analytics/summary
 * 
 * Returns aggregated geo-hierarchy analytics across all approved tweets:
 * - Total events by district
 * - Total events by assembly
 * - Total events by block
 * - Urban vs Rural distribution
 * - Top locations by event count
 * 
 * Query Parameters:
 * - startDate (optional): Filter from date (ISO 8601)
 * - endDate (optional): Filter to date (ISO 8601)
 * - event_type (optional): Filter by event type
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDBPool } from '@/lib/db/pool';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const eventType = searchParams.get('event_type');

    const pool = getDBPool();

    // Build WHERE clause
    let whereClause = "WHERE needs_review = false AND review_status = 'approved'";
    const params: any[] = [];
    let paramIndex = 1;

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

    // Aggregate by district (geo_hierarchy is a separate JSONB column)
    const districtQuery = `
      SELECT 
        geo_hierarchy->>'district' as district,
        COUNT(*) as event_count
      FROM parsed_events
      ${whereClause}
        AND geo_hierarchy->>'district' IS NOT NULL
      GROUP BY geo_hierarchy->>'district'
      ORDER BY event_count DESC
    `;

    // Aggregate by assembly
    const assemblyQuery = `
      SELECT 
        geo_hierarchy->>'district' as district,
        geo_hierarchy->>'assembly' as assembly,
        COUNT(*) as event_count
      FROM parsed_events
      ${whereClause}
        AND geo_hierarchy->>'district' IS NOT NULL
        AND geo_hierarchy->>'assembly' IS NOT NULL
      GROUP BY 
        geo_hierarchy->>'district',
        geo_hierarchy->>'assembly'
      ORDER BY district, event_count DESC
    `;

    // Aggregate by block
    const blockQuery = `
      SELECT 
        geo_hierarchy->>'district' as district,
        geo_hierarchy->>'assembly' as assembly,
        geo_hierarchy->>'block' as block,
        COUNT(*) as event_count
      FROM parsed_events
      ${whereClause}
        AND geo_hierarchy->>'district' IS NOT NULL
        AND geo_hierarchy->>'block' IS NOT NULL
      GROUP BY 
        geo_hierarchy->>'district',
        geo_hierarchy->>'assembly',
        geo_hierarchy->>'block'
      ORDER BY district, assembly, event_count DESC
    `;

    // Urban vs Rural distribution
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

    // Top locations (village/ULB)
    const topLocationsQuery = `
      SELECT 
        geo_hierarchy->>'village' as location,
        geo_hierarchy->>'district' as district,
        geo_hierarchy->>'ulb' as ulb,
        geo_hierarchy->>'is_urban' as is_urban,
        COUNT(*) as event_count
      FROM parsed_events
      ${whereClause}
        AND geo_hierarchy->>'village' IS NOT NULL
      GROUP BY 
        geo_hierarchy->>'village',
        geo_hierarchy->>'district',
        geo_hierarchy->>'ulb',
        geo_hierarchy->>'is_urban'
      ORDER BY event_count DESC
      LIMIT 20
    `;

    // Execute all queries
    const [districtResult, assemblyResult, blockResult, urbanRuralResult, topLocationsResult] = await Promise.all([
      pool.query(districtQuery, params),
      pool.query(assemblyQuery, params),
      pool.query(blockQuery, params),
      pool.query(urbanRuralQuery, params),
      pool.query(topLocationsQuery, params),
    ]);

    // Format results
    const summary = {
      total_events: districtResult.rows.reduce((sum, row) => sum + parseInt(row.event_count), 0),
      by_district: districtResult.rows.map(row => ({
        district: row.district,
        event_count: parseInt(row.event_count),
      })),
      by_assembly: assemblyResult.rows.map(row => ({
        district: row.district,
        assembly: row.assembly,
        event_count: parseInt(row.event_count),
      })),
      by_block: blockResult.rows.map(row => ({
        district: row.district,
        assembly: row.assembly,
        block: row.block,
        event_count: parseInt(row.event_count),
      })),
      urban_rural: urbanRuralResult.rows.reduce((acc, row) => {
        acc[row.area_type] = parseInt(row.event_count);
        return acc;
      }, {} as Record<string, number>),
      top_locations: topLocationsResult.rows.map(row => ({
        location: row.location,
        district: row.district,
        ulb: row.ulb || null,
        is_urban: row.is_urban === 'true',
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
      data: summary,
      source: 'database',
    });

  } catch (error) {
    console.error('Geo analytics summary error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to generate geo analytics summary',
      },
      { status: 500 }
    );
  }
}

