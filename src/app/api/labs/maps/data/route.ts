import { NextResponse } from 'next/server';
import { fetchMapEvents, transformToGeoJSON, getMapStats } from '@/labs/maps/map_data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const events = await fetchMapEvents();
    const geoJson = transformToGeoJSON(events);
    const stats = await getMapStats();

    return NextResponse.json({
      success: true,
      geoJson,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch map data',
      },
      { status: 500 }
    );
  }
}

