-- Migration 004: Create Dynamic Learning Tables
-- Stores human feedback and learned patterns for AI improvement

-- Learning feedback table - stores human corrections and AI suggestions
CREATE TABLE IF NOT EXISTS learning_feedback (
  id SERIAL PRIMARY KEY,
  tweet_id VARCHAR(50) NOT NULL,
  session_id VARCHAR(100),
  reviewer_id VARCHAR(100),
  original_data JSONB NOT NULL, -- Original tweet and parsed data
  ai_suggestions JSONB, -- What AI suggested before human review
  human_corrections JSONB NOT NULL, -- What human corrected
  learned_entities TEXT[], -- Array of learned entity types (event_type:meeting, location:raipur, etc.)
  confidence_score DECIMAL(3,2), -- Overall confidence of the learning
  patterns_updated INTEGER DEFAULT 0, -- How many patterns were updated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning patterns table - stores learned patterns for future suggestions
CREATE TABLE IF NOT EXISTS learning_patterns (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(50) NOT NULL, -- 'event_type', 'location', 'person', 'organization', 'scheme'
  pattern_key TEXT NOT NULL, -- The pattern/key that was learned
  pattern_value TEXT, -- The corrected value
  confidence DECIMAL(3,2) DEFAULT 0.5, -- Confidence in this pattern
  usage_count INTEGER DEFAULT 1, -- How many times this pattern has been used
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pattern_type, pattern_key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_feedback_tweet_id ON learning_feedback(tweet_id);
CREATE INDEX IF NOT EXISTS idx_learning_feedback_created_at ON learning_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_type_key ON learning_patterns(pattern_type, pattern_key);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_confidence ON learning_patterns(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_usage ON learning_patterns(usage_count DESC);

-- Comments for documentation
COMMENT ON TABLE learning_feedback IS 'Stores human feedback and corrections for dynamic learning system';
COMMENT ON TABLE learning_patterns IS 'Stores learned patterns from human corrections for improved AI suggestions';
COMMENT ON COLUMN learning_feedback.original_data IS 'JSON containing original tweet text and AI parsing results';
COMMENT ON COLUMN learning_feedback.ai_suggestions IS 'JSON containing what AI suggested before human review';
COMMENT ON COLUMN learning_feedback.human_corrections IS 'JSON containing human corrections and improvements';
COMMENT ON COLUMN learning_feedback.learned_entities IS 'Array of entity types that were learned (event_type:meeting, location:raipur, etc.)';
COMMENT ON COLUMN learning_feedback.confidence_score IS 'Confidence score for this learning instance (0.00-1.00)';
COMMENT ON COLUMN learning_patterns.pattern_type IS 'Type of pattern: event_type, location, person, organization, scheme';
COMMENT ON COLUMN learning_patterns.pattern_key IS 'The key/pattern that triggers this learned value';
COMMENT ON COLUMN learning_patterns.pattern_value IS 'The corrected/learned value for this pattern';
COMMENT ON COLUMN learning_patterns.confidence IS 'Confidence in this learned pattern (increases with usage)';
COMMENT ON COLUMN learning_patterns.usage_count IS 'How many times this pattern has been applied successfully';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON learning_feedback TO app_user;
-- GRANT SELECT, INSERT, UPDATE ON learning_patterns TO app_user;
-- GRANT USAGE ON SEQUENCE learning_feedback_id_seq TO app_user;
-- GRANT USAGE ON SEQUENCE learning_patterns_id_seq TO app_user;
