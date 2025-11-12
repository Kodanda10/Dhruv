import db from '@/lib/db';
import { FinalChoice, LocationResolveInput } from './types';
import { normalizePlaceName, buildPlaceKey } from './normalize';

let tablesEnsured = false;

async function ensureTables() {
  if (tablesEnsured) return;
  await db.query(
    `CREATE TABLE IF NOT EXISTS location_resolutions (
      place_key TEXT NOT NULL,
      version INTEGER NOT NULL,
      final_choice JSONB NOT NULL,
      decided_by TEXT NOT NULL,
      decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      audit JSONB,
      PRIMARY KEY (place_key, version)
    )`,
    [],
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS location_alias_cache (
      alias TEXT PRIMARY KEY,
      place_id TEXT NOT NULL,
      confidence REAL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB
    )`,
    [],
  );
  tablesEnsured = true;
}

export async function persistResolvedChoice(params: {
  placeName: string;
  kind: string;
  choice: FinalChoice;
  audit: Record<string, any>;
  context?: LocationResolveInput['context'];
  alias?: string;
}): Promise<FinalChoice> {
  await ensureTables();
  const placeKey = buildPlaceKey(params.placeName, params.choice.kind);

  const nextVersionResult = await db.query<{ next_version: number }>(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
     FROM location_resolutions
     WHERE place_key = $1`,
    [placeKey],
  );
  const version = nextVersionResult.rows[0]?.next_version || 1;
  const decidedAt = new Date().toISOString();

  const finalChoice: FinalChoice = {
    ...params.choice,
    version,
    decided_at: decidedAt,
  };

  await db.query(
    `INSERT INTO location_resolutions (place_key, version, final_choice, decided_by, audit)
     VALUES ($1, $2, $3, $4, $5)`,
    [placeKey, version, finalChoice, params.choice.decided_by, params.audit],
  );

  if (params.alias) {
    await db.query(
      `INSERT INTO location_alias_cache (alias, place_id, confidence, metadata)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (alias) DO UPDATE SET
         place_id = EXCLUDED.place_id,
         confidence = EXCLUDED.confidence,
         metadata = EXCLUDED.metadata,
         last_seen_at = NOW()`,
      [
        normalizePlaceName(params.alias),
        params.choice.id,
        params.choice.confidence,
        { place_key: placeKey, context: params.context || null },
      ],
    );
  }

  return finalChoice;
}
