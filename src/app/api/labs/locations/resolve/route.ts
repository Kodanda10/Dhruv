import { NextResponse } from 'next/server';
import { resolveLocation } from '@/labs/locations/resolver';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedLocation = searchParams.get('parsedLocation');

    if (!parsedLocation) {
      return NextResponse.json({ error: 'Missing parsedLocation query parameter.' }, { status: 400 });
    }

    const suggestions = await resolveLocation(parsedLocation);
    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error('API Error resolving location:', error);
    return NextResponse.json({ error: error.message || 'Failed to resolve location.' }, { status: 500 });
  }
}