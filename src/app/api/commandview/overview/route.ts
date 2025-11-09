import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';
import { buildSystemHealthResponse } from '@/lib/health/system-health';

type ReviewSummary = {
  needs_review: number;
  approved: number;
  rejected: number;
  edited: number;
  auto_approved: number;
  avg_confidence: number;
};

type RecentReview = {
  tweet_id: string;
  event_type: string | null;
  review_status: string | null;
  reviewed_at: string | null;
  reviewer: string | null;
};

export const dynamic = 'force-dynamic';

export async function GET() {
  const pool = getDbPool();

  try {
    const [summaryResult, recentResult] = await Promise.all([
      pool.query<ReviewSummary>(
        `SELECT
            COUNT(*) FILTER (WHERE needs_review = true) AS needs_review,
            COUNT(*) FILTER (WHERE review_status = 'approved') AS approved,
            COUNT(*) FILTER (WHERE review_status = 'rejected') AS rejected,
            COUNT(*) FILTER (WHERE review_status = 'edited') AS edited,
            COUNT(*) FILTER (WHERE needs_review = false AND (review_status IS NULL OR review_status = 'approved')) AS auto_approved,
            COALESCE(AVG(overall_confidence), 0)::float AS avg_confidence
         FROM parsed_events`,
      ),
      pool.query<RecentReview>(
        `SELECT tweet_id, event_type, review_status, reviewed_at::TEXT, reviewed_by AS reviewer
         FROM parsed_events
         WHERE reviewed_at IS NOT NULL
         ORDER BY reviewed_at DESC
         LIMIT 10`,
      ),
    ]);

    const summaryRow = summaryResult.rows[0] || {
      needs_review: 0,
      approved: 0,
      rejected: 0,
      edited: 0,
      auto_approved: 0,
      avg_confidence: 0,
    };

    const { payload: healthPayload } = await buildSystemHealthResponse();

    return NextResponse.json({
      success: true,
      summary: summaryRow,
      recent_reviews: recentResult.rows,
      health: healthPayload,
    });
  } catch (error) {
    console.error('CommandView overview error:', error);
    return NextResponse.json(
      { success: false, error: 'कमांड व्यू डेटा उपलब्ध नहीं है' },
      { status: 500 },
    );
  }
}
