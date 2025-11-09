import { NextRequest, NextResponse } from 'next/server';
import { search, getIndexStats } from '@/labs/faiss/search';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '5', 10), 20);

    // Allow empty query for stats only
    if (!query.trim() && limit > 0) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // If query is empty and limit is 0, return stats only
    if (!query.trim() && limit === 0) {
      const stats = await getIndexStats().catch(() => null);
      return NextResponse.json({
        success: true,
        results: [],
        latency_ms: Date.now() - startTime,
        backend: 'faiss',
        query: '',
        limit: 0,
        stats,
      });
    }

    // Perform search
    const results = await search(query, limit);
    const latency = Date.now() - startTime;

    // Get index stats
    const stats = await getIndexStats().catch(() => null);

    return NextResponse.json({
      success: true,
      results,
      latency_ms: latency,
      backend: 'faiss',
      query,
      limit,
      stats,
    });
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Search failed',
        latency_ms: latency,
      },
      { status: 500 }
    );
  }
}

