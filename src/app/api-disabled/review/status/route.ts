import { NextResponse } from 'next/server';
import { generateSecureTraceId } from '@/lib/utils/security';

type ReviewStatus = 'pending' | 'reviewed' | 'rejected';

type StatusRecord = {
  status: ReviewStatus;
  updatedAt: string; // ISO timestamp
};

function makeTraceId(): string {
  return generateSecureTraceId();
}

// Minimal placeholder store to satisfy API contract during CI/build.
// Replace with real backing storage or service integration as needed.
const SAMPLE_STATUS: Record<string, StatusRecord> = {
  'rvw-1': { status: 'pending', updatedAt: new Date(0).toISOString() },
  'rvw-2': { status: 'reviewed', updatedAt: new Date(2_000_000).toISOString() },
  'rvw-3': { status: 'rejected', updatedAt: new Date(3_000_000).toISOString() },
};

// Derive simple counts for summary responses.
function computeSummaryCounts(src: Record<string, StatusRecord>) {
  let pending = 0;
  let reviewed = 0;
  let rejected = 0;

  for (const key of Object.keys(src)) {
    const s = src[key]?.status;
    if (s === 'pending') pending += 1;
    else if (s === 'reviewed') reviewed += 1;
    else if (s === 'rejected') rejected += 1;
  }
  return { pending, reviewed, rejected, total: pending + reviewed + rejected };
}

// GET /api/review/status?id=<reviewId>
// - If `id` is provided: return the status for that review item (or a default).
// - If `id` is omitted: return a summary of counts across review states.
export async function GET(request: Request) {
  const traceId = makeTraceId();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // If specific id requested, return its status (or a default pending record).
  if (id && id.trim().length > 0) {
    const record = SAMPLE_STATUS[id] ?? {
      status: 'pending' as ReviewStatus,
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(
      {
        ok: true,
        id,
        status: record.status,
        updatedAt: record.updatedAt,
        traceId,
        timestamp: Date.now(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  // Otherwise, return a summary of current review statuses.
  const counts = computeSummaryCounts(SAMPLE_STATUS);
  return NextResponse.json(
    {
      ok: true,
      summary: counts,
      traceId,
      timestamp: Date.now(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
