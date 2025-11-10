import { NextResponse } from 'next/server';

type Post = {
  id: string;
  title: string;
  content?: string;
  createdAt: string; // ISO string
};

function makeTraceId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Minimal in-memory sample to satisfy type expectations.
// This can be replaced by real data plumbing later.
const SAMPLE_POSTS: Post[] = [
  {
    id: '1',
    title: 'Sample Post',
    content: 'This is a placeholder post returned by the minimal API handler.',
    createdAt: new Date(0).toISOString(),
  },
];

export async function GET(request: Request) {
  const traceId = makeTraceId();

  // Optional basic pagination support via query params
  const { searchParams } = new URL(request.url);
  const limit = Math.max(
    0,
    Math.min(100, Number(searchParams.get('limit')) || SAMPLE_POSTS.length),
  );
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

  const slice = SAMPLE_POSTS.slice(offset, offset + limit);

  return NextResponse.json(
    {
      ok: true,
      count: slice.length,
      total: SAMPLE_POSTS.length,
      posts: slice,
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
