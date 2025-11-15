import { NextResponse } from 'next/server';
import { suggestEventTypes } from '@/labs/events/event-resolver';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedEventType = searchParams.get('parsedEventType');
    const tweetText = searchParams.get('tweetText'); // Not used yet, but will be for advanced matching

    if (!parsedEventType) {
      return NextResponse.json({ error: 'Missing parsedEventType query parameter.' }, { status: 400 });
    }

    // Pass tweetText to the resolver, even if not fully utilized yet
    const suggestions = await suggestEventTypes(parsedEventType, tweetText || '');
    return NextResponse.json(suggestions);
  } catch (error: any) {
    console.error('API Error suggesting event types:', error);
    return NextResponse.json({ error: error.message || 'Failed to suggest event types.' }, { status: 500 });
  }
}
