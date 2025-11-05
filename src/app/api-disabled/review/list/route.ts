import { NextResponse } from 'next/server';
import { generateSecureTraceId } from '@/lib/utils/security';

type ReviewStatus = 'pending' | 'reviewed' | 'rejected';

type ReviewItem = {
  id: string;
  status: ReviewStatus;
  title?: string;
  snippet?: string;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
};

type PaginatedResponse<T> = {
  ok: true;
  count: number;
  total: number;
  items: T[];
  traceId: string;
  timestamp: number;
  page?: number;
  limit?: number;
  status?: ReviewStatus | 'all';
};

function makeTraceId(): string {
  return generateSecureTraceId();
}

function toIntOr<T extends number>(
  value: string | null,
  fallback: T,
  clamp?: { min?: number; max?: number },
): number {
  const n = value !== null ? Number(value) : NaN;
  let out = Number.isFinite(n) ? n : fallback;
  if (typeof clamp?.min === 'number') out = Math.max(clamp.min, out);
  if (typeof clamp?.max === 'number') out = Math.min(clamp.max, out);
  return out;
}

// Minimal placeholder dataset to satisfy API contract during CI/build.
// Replace with real review queue plumbing as needed.
const SAMPLE_REVIEW_ITEMS: ReviewItem[] = [
  {
    id: 'rvw-1',
    status: 'pending',
    title: 'Sample post pending human review',
    snippet: 'This is a placeholder review item used to satisfy the API contract.',
    createdAt: new Date(0).toISOString(),
  },
  {
    id: 'rvw-2',
    status: 'reviewed',
    title: 'Previously reviewed item',
    snippet: 'Already reviewed with feedback applied.',
    createdAt: new Date(1_000_000).toISOString(),
    updatedAt: new Date(2_000_000).toISOString(),
  },
];

// GET /api/review/list?status=pending|reviewed|rejected|all&limit=...&page=...
export async function GET(request: Request) {
  const traceId = makeTraceId();
  const { searchParams } = new URL(request.url);

  const statusParam = (searchParams.get('status') || 'pending').toLowerCase() as
    | ReviewStatus
    | 'all';
  const limit = toIntOr(searchParams.get('limit'), 20, { min: 1, max: 100 });
  const page = toIntOr(searchParams.get('page'), 1, { min: 1, max: 10_000 });

  const offset = (page - 1) * limit;

  const filtered =
    statusParam === 'all'
      ? SAMPLE_REVIEW_ITEMS
      : SAMPLE_REVIEW_ITEMS.filter((it) => it.status === statusParam);

  const items = filtered.slice(offset, offset + limit);

  const body: PaginatedResponse<ReviewItem> = {
    ok: true,
    count: items.length,
    total: filtered.length,
    items,
    traceId,
    timestamp: Date.now(),
    page,
    limit,
    status: statusParam,
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      // Review queues should reflect latest state on each request
      'Cache-Control': 'no-store',
    },
  });
}
