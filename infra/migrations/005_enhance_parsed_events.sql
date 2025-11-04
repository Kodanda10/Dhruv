BEGIN;

-- Add missing columns to parsed_events table for enhanced parsing
ALTER TABLE parsed_events 
ADD COLUMN IF NOT EXISTS event_type_en VARCHAR(100),
ADD COLUMN IF NOT EXISTS event_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS schemes_en TEXT[],
ADD COLUMN IF NOT EXISTS reasoning TEXT,
ADD COLUMN IF NOT EXISTS matched_scheme_ids INTEGER[],
ADD COLUMN IF NOT EXISTS matched_event_id INTEGER,
ADD COLUMN IF NOT EXISTS generated_hashtags TEXT[],
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Update the trigger function to handle new column names
CREATE OR REPLACE FUNCTION increment_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'parsed_events' THEN
        -- Update scheme usage if scheme mentioned
        UPDATE ref_schemes 
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE name_hi = ANY(NEW.schemes_mentioned) OR name_en = ANY(NEW.schemes_en);
        
        -- Update event type usage
        UPDATE ref_event_types
        SET usage_count = usage_count + 1
        WHERE name_hi = NEW.event_type OR name_en = NEW.event_type_en;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
