import { NextRequest, NextResponse } from 'next/server';
import { fetchAnalyticsData } from '@/lib/analytics/data-source';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') ?? undefined;
    const endDate = searchParams.get('end_date') ?? undefined;
    const location = searchParams.get('location') ?? undefined;

    const data = await fetchAnalyticsData({ startDate, endDate, location });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load analytics data',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { format } = await request.json();
    const data = await fetchAnalyticsData();

    return NextResponse.json({
      success: true,
      data,
      message: `Export to ${String(format || 'json').toUpperCase()} would be generated here`,
    });
  } catch (error) {
    console.error('Export API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export data',
      },
      { status: 500 },
    );
  }
}
