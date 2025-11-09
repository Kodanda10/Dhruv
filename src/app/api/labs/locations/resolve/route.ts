import { NextRequest, NextResponse } from 'next/server';
import { resolveLocation } from '@/labs/locations/resolver';
import { LocationResolveInput } from '@/labs/locations/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as LocationResolveInput;
    if (!payload?.detected_place) {
      return NextResponse.json(
        { success: false, error: 'detected_place is required' },
        { status: 400 },
      );
    }

    const result = await resolveLocation(payload);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('[labs.locations.resolve]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'resolution failed' },
      { status: 500 },
    );
  }
}
