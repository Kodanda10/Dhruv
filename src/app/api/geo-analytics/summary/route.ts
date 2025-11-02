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

    // Build WHERE clause with pe alias for parsed_events table
    let whereClause = "WHERE pe.needs_review = false AND pe.review_status = 'approved'";
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND pe.parsed_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND pe.parsed_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (eventType) {
      whereClause += ` AND pe.event_type = $${paramIndex}`;
      params.push(eventType);
      paramIndex++;
    }

    // Aggregate by district (geo_hierarchy is a JSONB array, expand with jsonb_array_elements)
    const districtQuery = `
      SELECT 
        geo->>'district' as district,
        COUNT(DISTINCT pe.id) as event_count
      FROM parsed_events pe,
           jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo
      ${whereClause}
        AND pe.geo_hierarchy IS NOT NULL
        AND geo->>'district' IS NOT NULL
      GROUP BY geo->>'district'
      ORDER BY event_count DESC
    `;

    // Aggregate by assembly
    const assemblyQuery = `
      SELECT 
        geo->>'district' as district,
        geo->>'assembly' as assembly,
        COUNT(DISTINCT pe.id) as event_count
      FROM parsed_events pe,
           jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo
      ${whereClause}
        AND pe.geo_hierarchy IS NOT NULL
        AND geo->>'district' IS NOT NULL
        AND geo->>'assembly' IS NOT NULL
      GROUP BY 
        geo->>'district',
        geo->>'assembly'
      ORDER BY district, event_count DESC
    `;

    // Aggregate by block
    const blockQuery = `
      SELECT 
        geo->>'district' as district,
        geo->>'assembly' as assembly,
        geo->>'block' as block,
        COUNT(DISTINCT pe.id) as event_count
      FROM parsed_events pe,
           jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo
      ${whereClause}
        AND pe.geo_hierarchy IS NOT NULL
        AND geo->>'district' IS NOT NULL
        AND geo->>'block' IS NOT NULL
      GROUP BY 
        geo->>'district',
        geo->>'assembly',
        geo->>'block'
      ORDER BY district, assembly, event_count DESC
    `;

    // Urban vs Rural distribution
    const urbanRuralQuery = `
      SELECT 
        CASE 
          WHEN geo->>'is_urban' = 'true' THEN 'urban'
          ELSE 'rural'
        END as area_type,
        COUNT(DISTINCT pe.id) as event_count
      FROM parsed_events pe,
           jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo
      ${whereClause}
        AND pe.geo_hierarchy IS NOT NULL
      GROUP BY area_type
    `;

    // Top locations (village/ULB)
    const topLocationsQuery = `
      SELECT 
        geo->>'village' as location,
        geo->>'district' as district,
        geo->>'ulb' as ulb,
        geo->>'is_urban' as is_urban,
        COUNT(DISTINCT pe.id) as event_count
      FROM parsed_events pe,
           jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo
      ${whereClause}
        AND pe.geo_hierarchy IS NOT NULL
        AND geo->>'village' IS NOT NULL
      GROUP BY 
        geo->>'village',
        geo->>'district',
        geo->>'ulb',
        geo->>'is_urban'
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

    // Format results with null safety
    const districtRows = districtResult?.rows || [];
    const assemblyRows = assemblyResult?.rows || [];
    const blockRows = blockResult?.rows || [];
    const urbanRuralRows = urbanRuralResult?.rows || [];
    const topLocationsRows = topLocationsResult?.rows || [];

    const summary = {
      total_events: districtRows.reduce((sum, row) => sum + parseInt(row.event_count || '0'), 0),
      by_district: districtRows.map(row => ({
        district: row.district,
        event_count: parseInt(row.event_count || '0'),
      })),
      by_assembly: assemblyRows.map(row => ({
        district: row.district,
        assembly: row.assembly,
        event_count: parseInt(row.event_count || '0'),
      })),
      by_block: blockRows.map(row => ({
        district: row.district,
        assembly: row.assembly,
        block: row.block,
        event_count: parseInt(row.event_count || '0'),
      })),
      urban_rural: urbanRuralRows.reduce((acc, row) => {
        acc[row.area_type] = parseInt(row.event_count || '0');
        return acc;
      }, {} as Record<string, number>),
      top_locations: topLocationsRows.map(row => ({
        location: row.location,
        district: row.district,
        ulb: row.ulb || null,
        is_urban: row.is_urban === 'true',
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

