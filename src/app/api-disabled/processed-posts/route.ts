import { NextResponse } from 'next/server';
import { generateSecureTraceId } from '@/lib/utils/security';

type ProcessedPost = {
  id: string;
  when: string; // ISO timestamp or human-readable date
  where?: string; // location (Hi/En as applicable)
  what?: string; // activity/event
  which?: string; // entities/tags
  how?: string; // brief summary/context
};

function makeTraceId(): string {
  return generateSecureTraceId();
}

// Minimal placeholder dataset to satisfy API contract during CI/build.
// Replace with real processing output wiring as needed.
const SAMPLE_PROCESSED_POSTS: ProcessedPost[] = [
  {
    id: 'p-1',
    when: new Date(0).toISOString(),
    where: 'Raipur',
    what: 'Sample activity',
    which: '#example',
    how: 'Parsed fields populated by a placeholder route.',
  },
];

export async function GET(request: Request) {
  const traceId = makeTraceId();

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit'));
  const offsetParam = Number(searchParams.get('offset'));

  const total = SAMPLE_PROCESSED_POSTS.length;
  const limit = Number.isFinite(limitParam) ? Math.max(0, Math.min(100, limitParam)) : total;
  const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;

  const items = SAMPLE_PROCESSED_POSTS.slice(offset, offset + limit);

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
        'Cache-Control': 'public, max-age=60',
      },
    },
  );
}
