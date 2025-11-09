import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { buildSystemHealthResponse } from '@/lib/health/system-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { payload, statusCode } = await buildSystemHealthResponse();
  const traceId = randomUUID();

  const responseBody = {
    status: payload.status === 'healthy' ? 'ok' : payload.status,
    traceId,
    timestamp: payload.timestamp,
    version: payload.version,
    uptime_seconds: payload.uptime_seconds,
    flags: {
      database: payload.services.database?.status,
      twitter: payload.services.twitter_api?.status,
      gemini: payload.services.gemini_api?.status,
      ollama: payload.services.ollama_api?.status,
    },
    services: payload.services,
    frontend: payload.frontend,
  };

  return NextResponse.json(responseBody, { status: statusCode });
}
