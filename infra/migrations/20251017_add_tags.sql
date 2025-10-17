-- Tags taxonomy for topics on tweets
-- idempotent-ish: use IF NOT EXISTS guards where supported

BEGIN;

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  label_hi TEXT NOT NULL,
  label_en TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active|proposed|archived
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tag_aliases (
  id SERIAL PRIMARY KEY,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  lang TEXT,
  confidence DOUBLE PRECISION DEFAULT 1.0,
  UNIQUE(tag_id, alias)
);

CREATE TABLE IF NOT EXISTS tweet_tags (
  tweet_id TEXT NOT NULL,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'human', -- human|parser|regex|fuzzy|bm25
  confidence DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tweet_id, tag_id)
);

COMMIT;


