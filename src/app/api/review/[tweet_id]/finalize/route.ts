import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import db from "@/lib/db";
import { redis } from "@/lib/redis";

type FinalizeBody = {
  action: "APPROVE" | "SKIP" | "DEFER";
  parser_version: string;
  decisions: {
    event?: any;
    location?: any;
    people?: any[];
    tags?: string[];
    schemes?: any[];
  };
  evidence?: any;
  policy?: any;
  consensus_meta?: any;
  notes?: string;
};

export async function POST(req: Request, { params }: { params: { tweet_id: string } }) {
  const { tweet_id } = params;
  const body = (await req.json()) as FinalizeBody;

  const include = body.action === "APPROVE";
  const now = new Date();

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const reviewRecordsUpsertQuery = `
      INSERT INTO review_records (tweet_id, decisions, parser_version, evidence, policy, consensus_meta, status, include_in_analytics, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (tweet_id)
      DO UPDATE SET
        decisions = EXCLUDED.decisions,
        parser_version = EXCLUDED.parser_version,
        evidence = EXCLUDED.evidence,
        policy = EXCLUDED.policy,
        consensus_meta = EXCLUDED.consensus_meta,
        status = EXCLUDED.status,
        include_in_analytics = EXCLUDED.include_in_analytics,
        updated_at = EXCLUDED.updated_at;
    `;
    await client.query(reviewRecordsUpsertQuery, [
      tweet_id,
      body.decisions,
      body.parser_version,
      body.evidence,
      body.policy,
      body.consensus_meta,
      body.action,
      include,
      now,
      now,
    ]);

    const reviewAuditInsertQuery = `
      INSERT INTO review_audit (tweet_id, action, payload, notes, created_at)
      VALUES ($1, $2, $3, $4, $5);
    `;
    await client.query(reviewAuditInsertQuery, [
      tweet_id,
      body.action,
      body,
      body.notes ?? null,
      now,
    ]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Transaction Error:", error);
    return NextResponse.json({ error: "Database transaction failed" }, { status: 500 });
  } finally {
    client.release();
  }

  revalidateTag("home:list");
  revalidateTag("analytics:summary");
  revalidateTag("analytics:by-geo");
  revalidateTag("mindmap:data");
  revalidateTag("map:data");

  // Publish live update (optional for local development)
  try {
    await redis.publish("events:review-updated", JSON.stringify({
      tweet_id,
      status: body.action,
      include_in_analytics: include,
      at: now.toISOString(),
    }));
  } catch (redisError) {
    console.warn("Redis publish failed (continuing without live updates):", redisError instanceof Error ? redisError.message : String(redisError));
  }

  return NextResponse.json({ ok: true, tweet_id, status: body.action, include_in_analytics: include });
}
