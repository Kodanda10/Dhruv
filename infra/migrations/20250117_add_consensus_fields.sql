-- Migration: Add consensus parsing fields to parsed_events table
-- Date: 2025-01-17
-- Description: Adds fields to support three-layer consensus parsing (Rules/Regex + Gemini + Ollama)

BEGIN;

-- Add consensus-related columns to parsed_events table
ALTER TABLE parsed_events
ADD COLUMN IF NOT EXISTS consensus_data JSONB,
ADD COLUMN IF NOT EXISTS consensus_summary JSONB,
ADD COLUMN IF NOT EXISTS parser_version VARCHAR(20) DEFAULT 'v1.0.0',
ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50);

-- Add review_notes column for storing consensus finalization notes
ALTER TABLE parsed_events
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_parsed_events_parser_version ON parsed_events(parser_version);
CREATE INDEX IF NOT EXISTS idx_parsed_events_batch_id ON parsed_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_parsed_events_consensus_summary ON parsed_events USING GIN(consensus_summary);

-- Add comments for documentation
COMMENT ON COLUMN parsed_events.consensus_data IS 'JSONB object containing consensus results from all three parsing layers (rules, gemini, ollama)';
COMMENT ON COLUMN parsed_events.consensus_summary IS 'JSONB object with consensus statistics (total_fields, agreed_fields, disagreed_fields, sources)';
COMMENT ON COLUMN parsed_events.parser_version IS 'Version of the parser that processed this tweet (for idempotency and tracking)';
COMMENT ON COLUMN parsed_events.batch_id IS 'Batch identifier for grouping tweets processed together in workflows';
COMMENT ON COLUMN parsed_events.review_notes IS 'Notes from consensus finalization process and human review';

-- Verify the columns were added
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'parsed_events'
    AND column_name IN ('consensus_data', 'consensus_summary', 'parser_version', 'batch_id', 'review_notes')
ORDER BY column_name;

COMMIT;