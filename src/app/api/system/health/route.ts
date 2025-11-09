import { NextRequest, NextResponse } from 'next/server';
import { buildSystemHealthResponse } from '@/lib/health/system-health';
import { traceMiddleware } from '@/middleware/traceLogger';

export const dynamic = 'force-dynamic';

async function handler(request: NextRequest) {
  const { payload, statusCode } = await buildSystemHealthResponse();
  return NextResponse.json(payload, { status: statusCode });
}

export const GET = traceMiddleware(handler);
