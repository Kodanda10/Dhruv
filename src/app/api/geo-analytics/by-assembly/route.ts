/**
 * Geo Analytics By Assembly Endpoint
 * 
 * GET /api/geo-analytics/by-assembly?district={district}&assembly={assembly_name}
 * 
 * Returns drilldown analytics for a specific assembly constituency:
 * - All blocks in the assembly with event counts
 * - All villages/ULBs in the assembly
 * - Urban vs Rural breakdown within assembly
 * - Event types distribution within assembly
 * 
 * Query Parameters:
 * - district (required): District name
 * - assembly (required): Assembly constituency name
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
    const assembly = searchParams.get('assembly');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const eventType = searchParams.get('event_type');

    if (!district || !assembly) {
      return NextResponse.json(
        {
          success: false,
          error: 'district and assembly parameters are required',
        },
        { status: 400 }
      );
    }

    const pool = getDBPool();

    // Build WHERE clause
    let whereClause = `WHERE needs_review = false AND review_status = 'approved' AND geo_hierarchy->>'district' = $1 AND geo_hierarchy->>'assembly' = $2`;
    const params: any[] = [district, assembly];
    let paramIndex = 3;

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

    // Blocks in this assembly
    const blocksQuery = `
      SELECT 
        geo_hierarchy->>'block' as block,
        COUNT(*) as event_count
      FROM parsed_events
      ${whereClause}
        AND geo_hierarchy->>'block' IS NOT NULL
      GROUP BY geo_hierarchy->>'block'
      ORDER BY event_count DESC
    `;

    // Villages/ULBs in this assembly
    const villagesQuery = `
      SELECT 
        geo_hierarchy->>'village' as village,
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

    // Event types in this assembly
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
    const [blocksResult, villagesResult, urbanRuralResult, eventTypesResult] = await Promise.all([
      pool.query(blocksQuery, params),
      pool.query(villagesQuery, params),
      pool.query(urbanRuralQuery, params),
      pool.query(eventTypesQuery, params),
    ]);

    // Calculate total events
    const totalEvents = blocksResult.rows.reduce((sum, row) => sum + parseInt(row.event_count), 0);

    // Format results
    const drilldown = {
      district,
      assembly,
      total_events: totalEvents,
      blocks: blocksResult.rows.map(row => ({
        block: row.block,
        event_count: parseInt(row.event_count),
      })),
      villages: villagesResult.rows.map(row => ({
        village: row.village,
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
    console.error('Geo analytics by-assembly error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to generate assembly drilldown',
      },
      { status: 500 }
    );
  }
}

