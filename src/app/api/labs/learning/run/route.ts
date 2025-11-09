import { NextResponse } from 'next/server';
import { runLearningJob, getLearningStats } from '@/labs/learning/dynamic-learning';

export const dynamic = 'force-dynamic';

export async function POST() {
  const startTime = Date.now();

  try {
    const result = await runLearningJob();
    const latency = Date.now() - startTime;

    return NextResponse.json({
      ...result,
      success: true,
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Learning job failed',
        latency_ms: latency,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const stats = await getLearningStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get learning stats',
      },
      { status: 500 }
    );
  }
}

