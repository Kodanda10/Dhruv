-- Migration 007: Create geo_corrections table
-- Purpose: Store geo-hierarchy corrections made during human review for learning system
-- Part of Phase 3.2: Learning System for Geo Corrections

BEGIN;

CREATE TABLE IF NOT EXISTS geo_corrections (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign key to tweet
    tweet_id VARCHAR NOT NULL,
    
    -- Field name (always 'geo_hierarchy' for geo corrections, but flexible for other fields)
    field_name VARCHAR(50) NOT NULL DEFAULT 'geo_hierarchy',
    
    -- Original and corrected values (stored as JSONB for structured geo-hierarchy data)
    original_value JSONB,
    corrected_value JSONB NOT NULL,
    
    -- Metadata
    corrected_by VARCHAR NOT NULL,
    correction_reason TEXT,
    corrected_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_field_name CHECK (field_name IN ('geo_hierarchy', 'location', 'geo_location'))
);

-- Indexes for performance

-- Lookup by tweet_id (for learning lookups)
CREATE INDEX IF NOT EXISTS idx_geo_corrections_tweet_id ON geo_corrections(tweet_id);

-- Lookup by original location name (for alias learning)
-- This requires extracting the location name from original_value JSONB
CREATE INDEX IF NOT EXISTS idx_geo_corrections_field_name ON geo_corrections(field_name);

-- Timeline queries (most recent corrections first)
CREATE INDEX IF NOT EXISTS idx_geo_corrections_corrected_at ON geo_corrections(corrected_at DESC);

-- Lookup by reviewer (for audit/tracking)
CREATE INDEX IF NOT EXISTS idx_geo_corrections_corrected_by ON geo_corrections(corrected_by);

-- GIN index for JSONB queries (for searching within original/corrected hierarchies)
CREATE INDEX IF NOT EXISTS idx_geo_corrections_original_value ON geo_corrections USING GIN(original_value);
CREATE INDEX IF NOT EXISTS idx_geo_corrections_corrected_value ON geo_corrections USING GIN(corrected_value);

-- Comments for documentation
COMMENT ON TABLE geo_corrections IS 'Stores geo-hierarchy corrections made during human review for learning system';
COMMENT ON COLUMN geo_corrections.tweet_id IS 'Tweet ID associated with the correction';
COMMENT ON COLUMN geo_corrections.field_name IS 'Field name being corrected (geo_hierarchy, location, etc.)';
COMMENT ON COLUMN geo_corrections.original_value IS 'Original geo-hierarchy (or location name) before correction (JSONB)';
COMMENT ON COLUMN geo_corrections.corrected_value IS 'Corrected geo-hierarchy after human review (JSONB)';
COMMENT ON COLUMN geo_corrections.corrected_by IS 'Username/ID of reviewer who made the correction';
COMMENT ON COLUMN geo_corrections.correction_reason IS 'Reason/notes for the correction (helps with learning)';
COMMENT ON COLUMN geo_corrections.corrected_at IS 'Timestamp when correction was made';

COMMIT;


