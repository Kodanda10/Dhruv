-- This script creates the necessary tables for the location resolver feature.

-- Table to store the canonical gazetteer data.
-- This table will be populated by the gazetteer loader script.
CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(255) PRIMARY KEY,
    name_hindi VARCHAR(255) NOT NULL,
    name_english VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- e.g., 'village', 'city', 'district'
    state VARCHAR(255) DEFAULT 'Chhattisgarh',
    district VARCHAR(255),
    block VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to log human review decisions for locations.
-- This helps in training the model and tracking accuracy.
CREATE TABLE IF NOT EXISTS location_review_log (
    id SERIAL PRIMARY KEY,
    parsed_location_name VARCHAR(255) NOT NULL,
    resolved_location_id VARCHAR(255) REFERENCES locations(id),
    review_status VARCHAR(50) NOT NULL, -- e.g., 'confirmed', 'rejected', 'manual_entry'
    manual_entry_name VARCHAR(255),
    reviewer_id VARCHAR(255), -- To be linked with a user table in the future
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_locations_name_english ON locations(name_english);
CREATE INDEX IF NOT EXISTS idx_location_review_log_parsed_name ON location_review_log(parsed_location_name);

COMMENT ON TABLE locations IS 'Canonical gazetteer data for location resolution.';
COMMENT ON TABLE location_review_log IS 'Log of human review decisions for location resolution.';