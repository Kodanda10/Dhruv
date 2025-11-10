-- This script creates the necessary tables for the event type resolver feature.

-- Table to store the canonical event type data.
CREATE TABLE IF NOT EXISTS event_types (
    id VARCHAR(255) PRIMARY KEY,
    name_hindi VARCHAR(255) NOT NULL,
    name_english VARCHAR(255) NOT NULL,
    description_hindi TEXT,
    description_english TEXT,
    category VARCHAR(100), -- e.g., 'Political', 'Social', 'Economic'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to log human review decisions for event types.
CREATE TABLE IF NOT EXISTS event_type_review_log (
    id SERIAL PRIMARY KEY,
    parsed_event_type_name VARCHAR(255) NOT NULL,
    resolved_event_type_id VARCHAR(255) REFERENCES event_types(id),
    review_status VARCHAR(50) NOT NULL, -- e.g., 'confirmed', 'rejected', 'manual_entry'
    manual_entry_name VARCHAR(255),
    reviewer_id VARCHAR(255), -- To be linked with a user table in the future
    tweet_id VARCHAR(255), -- Reference to the tweet being reviewed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_types_name_english ON event_types(name_english);
CREATE INDEX IF NOT EXISTS idx_event_type_review_log_parsed_name ON event_type_review_log(parsed_event_type_name);

COMMENT ON TABLE event_types IS 'Canonical data for event types.';
COMMENT ON TABLE event_type_review_log IS 'Log of human review decisions for event type resolution.';
