-- Location resolution persistence tables
CREATE TABLE IF NOT EXISTS location_resolutions (
  place_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  final_choice JSONB NOT NULL,
  decided_by TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audit JSONB,
  PRIMARY KEY (place_key, version)
);

CREATE TABLE IF NOT EXISTS location_alias_cache (
  alias TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  confidence REAL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);
