import { NextResponse } from 'next/server';
import { checkMilvusHealth } from '@/labs/milvus/milvus_fallback';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await checkMilvusHealth();
    
    return NextResponse.json(health, {
      status: health.status === 'healthy' ? 200 : 503,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        latency_ms: 0,
        error: error.message || 'Health check failed',
        connected: false,
      },
      { status: 503 }
    );
  }
}

