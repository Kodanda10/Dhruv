-- Migration 002: Create parsed_events table
-- Purpose: Store parsed event data from tweets with confidence scores and review status

CREATE TABLE IF NOT EXISTS parsed_events (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign key to raw_tweets
    tweet_id VARCHAR NOT NULL REFERENCES raw_tweets(tweet_id) ON DELETE CASCADE,
    
    -- Event classification
    event_type VARCHAR,
    event_type_confidence DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Date information
    event_date DATE,
    date_confidence DECIMAL(3,2),
    
    -- Location information (JSONB for flexibility)
    locations JSONB, -- Array of location objects with name, type, confidence
    
    -- People and organizations mentioned
    people_mentioned TEXT[],
    organizations TEXT[],
    
    -- Schemes mentioned
    schemes_mentioned TEXT[],
    
    -- Confidence and review
    overall_confidence DECIMAL(3,2),
    needs_review BOOLEAN DEFAULT false,
    review_status VARCHAR DEFAULT 'pending', -- pending|approved|rejected|edited
    reviewed_at TIMESTAMP,
    reviewed_by VARCHAR,
    
    -- Metadata
    parsed_at TIMESTAMP DEFAULT NOW(),
    parsed_by VARCHAR DEFAULT 'system',
    
    -- Constraints
    CONSTRAINT valid_confidence CHECK (overall_confidence >= 0 AND overall_confidence <= 1),
    CONSTRAINT valid_review_status CHECK (review_status IN ('pending', 'approved', 'rejected', 'edited'))
);

-- Indexes for performance

-- Foreign key lookup
CREATE INDEX IF NOT EXISTS idx_parsed_events_tweet_id ON parsed_events(tweet_id);

-- Timeline queries (event_date filtering)
CREATE INDEX IF NOT EXISTS idx_parsed_events_date ON parsed_events(event_date DESC);

-- Review queue queries (filter by review_status and needs_review)
CREATE INDEX IF NOT EXISTS idx_parsed_events_review_status ON parsed_events(review_status, needs_review) 
    WHERE review_status = 'pending' AND needs_review = true;

-- Event type analysis
CREATE INDEX IF NOT EXISTS idx_parsed_events_type ON parsed_events(event_type);

-- Confidence-based queries
CREATE INDEX IF NOT EXISTS idx_parsed_events_confidence ON parsed_events(overall_confidence DESC);

-- Composite index for analytics queries (date + type)
CREATE INDEX IF NOT EXISTS idx_parsed_events_date_type ON parsed_events(event_date DESC, event_type);

-- Comments for documentation
COMMENT ON TABLE parsed_events IS 'Stores parsed event data extracted from tweets with confidence scores and review status';
COMMENT ON COLUMN parsed_events.tweet_id IS 'Foreign key to raw_tweets table';
COMMENT ON COLUMN parsed_events.event_type IS 'Type of event (inauguration, rally, meeting, etc.)';
COMMENT ON COLUMN parsed_events.event_type_confidence IS 'Confidence score for event type classification (0.00-1.00)';
COMMENT ON COLUMN parsed_events.event_date IS 'Date of the event';
COMMENT ON COLUMN parsed_events.date_confidence IS 'Confidence score for date extraction (0.00-1.00)';
COMMENT ON COLUMN parsed_events.locations IS 'JSONB array of location objects with name, type, confidence';
COMMENT ON COLUMN parsed_events.people_mentioned IS 'Array of people mentioned in the tweet';
COMMENT ON COLUMN parsed_events.organizations IS 'Array of organizations mentioned in the tweet';
COMMENT ON COLUMN parsed_events.schemes_mentioned IS 'Array of government schemes mentioned';
COMMENT ON COLUMN parsed_events.overall_confidence IS 'Overall confidence score for the entire parse (0.00-1.00)';
COMMENT ON COLUMN parsed_events.needs_review IS 'Flag indicating if human review is required (confidence < 0.7)';
COMMENT ON COLUMN parsed_events.review_status IS 'Status of human review: pending, approved, rejected, or edited';

