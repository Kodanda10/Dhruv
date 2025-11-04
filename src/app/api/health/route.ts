import { NextResponse } from 'next/server';
import { generateSecureTraceId } from '@/lib/utils/security';

export async function GET() {
  const traceId = generateSecureTraceId();
  return NextResponse.json({ status: 'ok', traceId });
}

