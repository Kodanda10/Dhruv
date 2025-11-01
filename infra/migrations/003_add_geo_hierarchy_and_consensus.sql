-- Migration 003: Add Geo-Hierarchy and Three-Layer Consensus Schema
-- This migration adds support for geographic hierarchy extraction and three-layer parsing consensus

-- Add consensus and geo-hierarchy columns to parsed_events
ALTER TABLE parsed_events ADD COLUMN IF NOT EXISTS consensus_results JSONB;
ALTER TABLE parsed_events ADD COLUMN IF NOT EXISTS layer_details JSONB;
ALTER TABLE parsed_events ADD COLUMN IF NOT EXISTS geo_hierarchy JSONB;
ALTER TABLE parsed_events ADD COLUMN IF NOT EXISTS gram_panchayats TEXT[];
ALTER TABLE parsed_events ADD COLUMN IF NOT EXISTS ulb_wards JSONB;
ALTER TABLE parsed_events ADD COLUMN IF NOT EXISTS blocks TEXT[];
ALTER TABLE parsed_events ADD COLUMN IF NOT EXISTS assemblies TEXT[];
ALTER TABLE parsed_events ADD COLUMN IF NOT EXISTS districts TEXT[];

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_consensus_results ON parsed_events USING GIN(consensus_results);
CREATE INDEX IF NOT EXISTS idx_geo_hierarchy ON parsed_events USING GIN(geo_hierarchy);
CREATE INDEX IF NOT EXISTS idx_gram_panchayats ON parsed_events USING GIN(gram_panchayats);
CREATE INDEX IF NOT EXISTS idx_blocks ON parsed_events USING GIN(blocks);
CREATE INDEX IF NOT EXISTS idx_assemblies ON parsed_events USING GIN(assemblies);
CREATE INDEX IF NOT EXISTS idx_districts ON parsed_events USING GIN(districts);

-- Create geo_corrections table for human learning audit trail
CREATE TABLE IF NOT EXISTS geo_corrections (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR REFERENCES raw_tweets(tweet_id),
    field_name VARCHAR NOT NULL,
    original_value JSONB,
    corrected_value JSONB,
    parser_sources TEXT[], -- Which parsers suggested original
    corrected_by VARCHAR,
    correction_reason TEXT,
    corrected_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for geo_corrections
CREATE INDEX IF NOT EXISTS idx_corrections_tweet ON geo_corrections(tweet_id);
CREATE INDEX IF NOT EXISTS idx_corrections_field ON geo_corrections(field_name);
CREATE INDEX IF NOT EXISTS idx_corrections_at ON geo_corrections(corrected_at);

-- Add comments for documentation
COMMENT ON COLUMN parsed_events.consensus_results IS 'Results from three-layer parsing consensus (Gemini + Ollama + Custom)';
COMMENT ON COLUMN parsed_events.layer_details IS 'Detailed results from each parsing layer';
COMMENT ON COLUMN parsed_events.geo_hierarchy IS 'Complete geographic hierarchy for each location (Village→GP/ULB→Block→Assembly→District)';
COMMENT ON COLUMN parsed_events.gram_panchayats IS 'Array of Gram Panchayats visited (for rural areas)';
COMMENT ON COLUMN parsed_events.ulb_wards IS 'Array of ULB/Ward objects for urban areas';
COMMENT ON COLUMN parsed_events.blocks IS 'Deduplicated blocks visited';
COMMENT ON COLUMN parsed_events.assemblies IS 'Deduplicated assembly constituencies visited';
COMMENT ON COLUMN parsed_events.districts IS 'Deduplicated districts visited';

COMMENT ON TABLE geo_corrections IS 'Audit trail for human corrections to geo-hierarchy data';
COMMENT ON COLUMN geo_corrections.parser_sources IS 'Which parsers (gemini, ollama, custom) suggested the original value';
COMMENT ON COLUMN geo_corrections.correction_reason IS 'Human explanation for the correction';
