-- Migration: Add Hindi labels to parsed_events table
-- TDD: Comprehensive tests ensure Hindi labels are stored and retrieved correctly
-- Date: 2025-11-04
-- Description: Adds event_type_hi column to store Hindi translations alongside English event types

-- Add Hindi label column to parsed_events table
ALTER TABLE parsed_events
ADD COLUMN event_type_hi VARCHAR(100);

-- Create index for efficient Hindi label queries
CREATE INDEX idx_parsed_events_event_type_hi ON parsed_events(event_type_hi);

-- Add comment for documentation
COMMENT ON COLUMN parsed_events.event_type_hi IS 'Hindi translation of event_type for localized display';

-- Verify the column was added
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'parsed_events'
    AND column_name = 'event_type_hi';
