import { NextResponse } from 'next/server';

type BulkPost = {
  id: string | number;
  corrections?: Record<string, unknown>;
};

type BulkFeedbackPayload = {
  posts?: BulkPost[];
  action?: string;
  corrections?: Record<string, unknown>;
};

function makeTraceId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(request: Request) {
  const traceId = makeTraceId();

  try {
    const payload = (await request.json()) as BulkFeedbackPayload;

    const posts = Array.isArray(payload?.posts) ? payload.posts : [];
    const action = typeof payload?.action === 'string' ? payload.action : 'none';

    // Normalize IDs to strings and drop falsy/invalid entries
    const processedIds = posts
      .map((p) => (p && p.id != null ? String(p.id) : ''))
      .filter((id) => id.length > 0);

    // Minimal validation: accept empty as no-ops and return success (keeps UI simple)
    const result = {
      success: true,
      action,
      count: processedIds.length,
      ids: processedIds,
      traceId,
      // Echo back corrections if provided at top-level for transparency
      corrections: payload?.corrections ?? {},
      timestamp: Date.now(),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid JSON payload',
        traceId,
      },
      { status: 400 },
    );
  }
}
