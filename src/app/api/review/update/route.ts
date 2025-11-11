import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';

const PROHIBITED_PATTERN = /[<>]/;
const ID_PATTERN = /^[A-Za-z0-9:_@.\-]{1,160}$/;

type ReviewPayload = {
  id?: string;
  event_type?: string;
  event_type_hi?: string;
  locations?: any;
  locationsPaths?: any;
  people_mentioned?: any;
  organizations?: any;
  schemes_mentioned?: any;
  review_notes?: string;
  notes?: string;
  action?: string;
};

// Event emission helper
async function emitReviewEvent(eventType: string, data: any) {
  try {
    // In a real implementation, this would emit to an event bus or queue
    console.log(`[REVIEW_EVENT] ${eventType}:`, JSON.stringify(data, null, 2));

    // For now, we'll just log the event. In production, this would:
    // - Send to event queue (Redis/SQS/Kafka)
    // - Trigger downstream processing
    // - Update monitoring dashboards
  } catch (error) {
    console.error('Failed to emit review event:', error);
    // Don't fail the request if event emission fails
  }
}

export async function POST(request: Request) {
  let body: ReviewPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'अमान्य JSON' }, { status: 400 });
  }

  const tweetId = sanitizeId(body.id);
  if (!tweetId) {
    return NextResponse.json({ success: false, error: 'ट्वीट ID आवश्यक है' }, { status: 400 });
  }

  const action = body.action?.toLowerCase();
  if (action === 'approve' || action === 'reject') {
    return handleDecision(action, tweetId, sanitizeNotes(body.notes));
  }
  if (action === 'skip') {
    console.log('Review action: skip', { tweetId });
    return NextResponse.json({ success: true, message: 'ट्वीट छोड़ दिया गया' });
  }

  return handleUpdate(tweetId, body);
}

function sanitizeId(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || !ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function sanitizeText(value?: string | null) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (PROHIBITED_PATTERN.test(trimmed)) return null;
  if (trimmed.length > 400) return null;
  return trimmed;
}

function sanitizeNotes(value?: string | null) {
  return sanitizeText(value);
}

function sanitizeArray(value: any, label: string) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  const cleaned: string[] = [];
  for (const item of arr) {
    if (typeof item !== 'string') {
      throw new Error(`अमान्य ${label} डेटा`);
    }
    const safe = sanitizeText(item);
    if (!safe) {
      throw new Error(`अमान्य ${label} डेटा`);
    }
    cleaned.push(safe);
  }
  return cleaned;
}

function buildLocations(body: ReviewPayload): string[] | null {
  if (Array.isArray(body.locationsPaths) && body.locationsPaths.length) {
    const flattened = body.locationsPaths
      .map((path: any[]) => {
        if (!Array.isArray(path)) return null;
        const names = path
          .map((node) => (typeof node?.name === 'string' ? node.name.trim() : ''))
          .filter(Boolean);
        return names.length ? names[names.length - 1] : null;
      })
      .filter(Boolean) as string[];
    return flattened.length ? flattened : null;
  }

  if (body.locations) {
    return sanitizeArray(body.locations, 'स्थान');
  }

  return null;
}

async function handleDecision(action: 'approve' | 'reject', tweetId: string, notes: string | null) {
  const reviewedAt = new Date().toISOString();
  const pool = getDbPool();

  // Use atomic transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query(
      `UPDATE parsed_events SET review_status = $1, needs_review = false, review_notes = COALESCE($2, review_notes), reviewed_at = $3 WHERE tweet_id = $4`,
      [action === 'approve' ? 'approved' : 'rejected', notes, reviewedAt, tweetId],
    );

    if (!rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'ट्वीट नहीं मिला' }, { status: 404 });
    }

    // Emit review event
    await emitReviewEvent('review.decision', {
      tweetId,
      action,
      decision: action === 'approve' ? 'approved' : 'rejected',
      notes,
      reviewedAt,
      reviewerId: 'system', // In production, get from auth context
    });

    await client.query('COMMIT');

    console.log(`Review action: ${action}`, { tweetId, action, notes });
    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'ट्वीट मंजूरी दे दी गई' : 'ट्वीट अस्वीकार कर दिया गया',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return handleDbError(error);
  } finally {
    client.release();
  }
}

async function handleUpdate(tweetId: string, body: ReviewPayload) {
  const setClauses: string[] = [];
  const params: any[] = [];
  let index = 1;

  const eventType = sanitizeText(body.event_type);
  if (eventType) {
    setClauses.push(`event_type = $${index++}`);
    params.push(eventType);
  } else if (body.event_type) {
    return NextResponse.json({ success: false, error: 'अमान्य घटना प्रकार' }, { status: 400 });
  }

  const eventTypeHi = sanitizeText(body.event_type_hi);
  if (eventTypeHi) {
    setClauses.push(`event_type_hi = $${index++}`);
    params.push(eventTypeHi);
  }

  if (body.people_mentioned != null) {
    try {
      const arr = sanitizeArray(body.people_mentioned, 'व्यक्ति');
      setClauses.push(`people_mentioned = $${index++}`);
      params.push(arr);
    } catch (error) {
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
  }

  if (body.organizations != null) {
    try {
      const arr = sanitizeArray(body.organizations, 'संगठन');
      setClauses.push(`organizations = $${index++}`);
      params.push(arr);
    } catch (error) {
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
  }

  if (body.schemes_mentioned != null) {
    try {
      const arr = sanitizeArray(body.schemes_mentioned, 'योजना');
      setClauses.push(`schemes_mentioned = $${index++}`);
      params.push(arr);
    } catch (error) {
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
  }

  if (body.locations != null || body.locationsPaths != null) {
    try {
      const normalized = buildLocations(body);
      if (normalized) {
        setClauses.push(`locations = $${index}::jsonb`);
        params.push(JSON.stringify(normalized));
        index += 1;
      }
    } catch (error) {
      return NextResponse.json({ success: false, error: 'अमान्य स्थान डेटा' }, { status: 400 });
    }
  }

  const reviewNotes = sanitizeNotes(body.review_notes ?? body.notes);
  if (reviewNotes) {
    setClauses.push(`review_notes = $${index++}`);
    params.push(reviewNotes);
  }

  if (!setClauses.length) {
    return NextResponse.json({ success: false, error: 'अमान्य डेटा' }, { status: 400 });
  }

  const reviewedAt = new Date().toISOString();
  setClauses.push(`review_status = 'edited'`);
  setClauses.push(`reviewed_at = $${index}`);
  params.push(reviewedAt);
  index += 1;

  const query = `UPDATE parsed_events SET ${setClauses.join(', ')} WHERE tweet_id = $${index}`;
  params.push(tweetId);

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query(query, params);
    if (!rowCount) {
      await client.query('ROLLBACK');
      return NextResponse.json({ success: false, error: 'ट्वीट नहीं मिला' }, { status: 404 });
    }

    // Emit review event for updates
    await emitReviewEvent('review.updated', {
      tweetId,
      changes: {
        event_type: eventType,
        event_type_hi: eventTypeHi,
        review_notes: reviewNotes,
        locations: body.locations || body.locationsPaths,
        people_mentioned: body.people_mentioned,
        organizations: body.organizations,
        schemes_mentioned: body.schemes_mentioned,
      },
      reviewedAt,
      reviewerId: 'system', // In production, get from auth context
    });

    await client.query('COMMIT');

    console.log('Review edit', {
      tweetId,
      changes: {
        event_type: eventType,
        review_notes: reviewNotes,
      },
    });

    return NextResponse.json({ success: true, message: 'समीक्षा अपडेट हो गई' });
  } catch (error) {
    await client.query('ROLLBACK');
    return handleDbError(error);
  } finally {
    client.release();
  }
}

function handleDbError(error: unknown) {
  const message = (error as Error)?.message || '';
  if (message.toLowerCase().includes('violates')) {
    return NextResponse.json({ success: false, error: 'अमान्य डेटा' }, { status: 400 });
  }
  if (message.toLowerCase().includes('not found')) {
    return NextResponse.json({ success: false, error: 'ट्वीट नहीं मिला' }, { status: 404 });
  }
  console.error('Review update error:', error);
  return NextResponse.json({ success: false, error: 'डेटाबेस त्रुटि' }, { status: 500 });
}
