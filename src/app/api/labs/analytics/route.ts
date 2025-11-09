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
      source: 'labs-proxy',
    });
  } catch (error) {
    console.error('[Labs Analytics] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load labs analytics data',
      },
      { status: 500 },
    );
  }
}
