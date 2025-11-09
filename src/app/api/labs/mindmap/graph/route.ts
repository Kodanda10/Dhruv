import { NextRequest, NextResponse } from 'next/server';
import { buildGraph } from '@/labs/mindmap/graph_builder';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const threshold = Math.max(1, parseInt(searchParams.get('threshold') || '2', 10));

    const graphData = await buildGraph(threshold);
    const latency = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      ...graphData,
      latency_ms: latency,
    });
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to build graph',
        latency_ms: latency,
        nodes: [],
        edges: [],
        stats: {
          node_count: 0,
          edge_count: 0,
          build_time_ms: latency,
        },
      },
      { status: 500 }
    );
  }
}

