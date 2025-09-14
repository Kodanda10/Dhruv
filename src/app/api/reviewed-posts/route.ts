import { NextResponse } from 'next/server';

type ReviewedPost = {
  id: string;
  title: string;
  reviewer?: string;
  reviewedAt: string; // ISO timestamp
  notes?: string;
};

function makeTraceId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toBoundedInt(
  value: string | null,
  fallback: number,
  bounds: { min?: number; max?: number } = {},
): number {
  const n = value !== null ? Number(value) : NaN;
  let out = Number.isFinite(n) ? n : fallback;
  if (typeof bounds.min === 'number') out = Math.max(bounds.min, out);
  if (typeof bounds.max === 'number') out = Math.min(bounds.max, out);
  return out;
}

// Minimal placeholder dataset to satisfy API contract during CI/build.
// Replace with real reviewed posts data as needed.
const SAMPLE_REVIEWED_POSTS: ReviewedPost[] = [
  {
    id: 'rvd-1',
    title: 'Reviewed Post — Example',
    reviewer: 'system',
    reviewedAt: new Date(2_000_000).toISOString(),
    notes: 'Placeholder reviewed entry to satisfy Next.js build.',
  },
  {
    id: 'rvd-2',
    title: 'Reviewed Post — Example 2',
    reviewer: 'system',
    reviewedAt: new Date(3_000_000).toISOString(),
  },
];

export async function GET(request: Request) {
  const traceId = makeTraceId();
  const { searchParams } = new URL(request.url);

  const limit = toBoundedInt(searchParams.get('limit'), 20, { min: 1, max: 100 });
  const offset = toBoundedInt(searchParams.get('offset'), 0, { min: 0 });

  const total = SAMPLE_REVIEWED_POSTS.length;
  const items = SAMPLE_REVIEWED_POSTS.slice(offset, offset + limit);

  return NextResponse.json(
    {
      ok: true,
      count: items.length,
      total,
      items,
      traceId,
      timestamp: Date.now(),
    },
    {
      headers: {
        // Reviewed list can be cached briefly; adjust as needed.
        'Cache-Control': 'public, max-age=60',
      },
    },
  );
}
