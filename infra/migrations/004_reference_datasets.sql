BEGIN;

-- Reference Schemes Table
CREATE TABLE IF NOT EXISTS ref_schemes (
    id SERIAL PRIMARY KEY,
    scheme_code VARCHAR(50) UNIQUE NOT NULL,
    name_hi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    category VARCHAR(20) NOT NULL, -- 'central' or 'state'
    description_hi TEXT,
    description_en TEXT,
    ministry VARCHAR(100),
    eligibility TEXT,
    benefits TEXT,
    application_process TEXT,
    official_url VARCHAR(300),
    is_active BOOLEAN DEFAULT true,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Central Govt Schemes (Seed Data)
INSERT INTO ref_schemes (scheme_code, name_hi, name_en, category, ministry, description_hi, description_en) VALUES
('PM_KISAN', 'प्रधानमंत्री किसान सम्मान निधि', 'PM-KISAN', 'central', 'Agriculture', 'किसानों को वित्तीय सहायता', 'Financial support to farmers'),
('AYUSHMAN_BHARAT', 'आयुष्मान भारत', 'Ayushman Bharat', 'central', 'Health', 'स्वास्थ्य बीमा योजना', 'Health insurance scheme'),
('UJJWALA', 'प्रधानमंत्री उज्ज्वला योजना', 'PM Ujjwala Yojana', 'central', 'Petroleum', 'मुफ्त गैस कनेक्शन', 'Free LPG connections'),
('PMAY', 'प्रधानमंत्री आवास योजना', 'PM Awas Yojana', 'central', 'Housing', 'सभी के लिए आवास', 'Housing for all')
ON CONFLICT (scheme_code) DO NOTHING;

-- Chhattisgarh State Schemes (Seed Data)
INSERT INTO ref_schemes (scheme_code, name_hi, name_en, category, ministry, description_hi, description_en) VALUES
('CM_KISAN_CG', 'मुख्यमंत्री किसान योजना', 'CM Kisan Yojana CG', 'state', 'Agriculture', 'किसानों को राज्य सहायता', 'State support to farmers'),
('GODHAN_NYAY', 'गोधन न्याय योजना', 'Godhan Nyay Yojana', 'state', 'Agriculture', 'गाय के गोबर की खरीद', 'Cow dung procurement'),
('RAJIV_YUVA_MITAN', 'राजीव युवा मितान क्लब', 'Rajiv Yuva Mitan Club', 'state', 'Youth Affairs', 'युवा विकास कार्यक्रम', 'Youth development program')
ON CONFLICT (scheme_code) DO NOTHING;

-- Reference Event Types Table
CREATE TABLE IF NOT EXISTS ref_event_types (
    id SERIAL PRIMARY KEY,
    event_code VARCHAR(50) UNIQUE NOT NULL,
    name_hi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    aliases_hi TEXT[], -- Array of Hindi variants
    aliases_en TEXT[], -- Array of English variants
    category VARCHAR(50), -- 'administrative', 'political', 'social', 'religious'
    usage_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed Event Types
INSERT INTO ref_event_types (event_code, name_hi, name_en, aliases_hi, aliases_en, category) VALUES
('MEETING', 'बैठक', 'Meeting', ARRAY['मुलाकात', 'चर्चा'], ARRAY['discussion', 'meeting'], 'administrative'),
('RALLY', 'रैली', 'Rally', ARRAY['सम्मेलन', 'जनसभा'], ARRAY['conference', 'public meeting'], 'political'),
('INSPECTION', 'निरीक्षण', 'Inspection', ARRAY['समीक्षा', 'जांच'], ARRAY['review', 'examination'], 'administrative'),
('INAUGURATION', 'उद्घाटन', 'Inauguration', ARRAY['शिलान्यास', 'भूमिपूजन'], ARRAY['foundation', 'opening'], 'administrative'),
('DISTRIBUTION', 'वितरण', 'Distribution', ARRAY['बंटवारा', 'प्रदान'], ARRAY['handover', 'giving'], 'social'),
('VISIT', 'दौरा', 'Visit', ARRAY['भ्रमण', 'यात्रा'], ARRAY['tour', 'trip'], 'administrative'),
('CELEBRATION', 'समारोह', 'Celebration', ARRAY['उत्सव', 'जयंती'], ARRAY['festival', 'anniversary'], 'social'),
('WORSHIP', 'पूजा', 'Worship', ARRAY['प्रार्थना', 'आरती'], ARRAY['prayer', 'ritual'], 'religious')
ON CONFLICT (event_code) DO NOTHING;

-- Reference Hashtags Table (for intelligent suggestions)
CREATE TABLE IF NOT EXISTS ref_hashtags (
    id SERIAL PRIMARY KEY,
    hashtag VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50), -- 'scheme', 'event', 'location', 'general'
    related_entity_id INT, -- FK to schemes/events/locations
    usage_count INT DEFAULT 0,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_used TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- User Contributed Data Tracking (Dynamic Learning)
CREATE TABLE IF NOT EXISTS user_contributed_data (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'event_type', 'scheme', 'hashtag', 'location', 'organization'
    value_hi VARCHAR(200),
    value_en VARCHAR(200),
    aliases TEXT[], -- Additional variants user provided
    source_tweet_id VARCHAR REFERENCES raw_tweets(tweet_id),
    contributed_at TIMESTAMP DEFAULT NOW(),
    approved_by VARCHAR(100), -- 'human' or username
    approval_status VARCHAR(20) DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
    usage_count INT DEFAULT 1,
    metadata JSONB -- Store additional context
);

-- Indexes for performance
CREATE INDEX idx_schemes_category ON ref_schemes(category);
CREATE INDEX idx_schemes_active ON ref_schemes(is_active);
CREATE INDEX idx_event_types_active ON ref_event_types(is_active);
CREATE INDEX idx_hashtags_category ON ref_hashtags(category);
CREATE INDEX idx_user_contrib_type ON user_contributed_data(entity_type);
CREATE INDEX idx_user_contrib_status ON user_contributed_data(approval_status);

-- Function to auto-update usage counts
CREATE OR REPLACE FUNCTION increment_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'parsed_events' THEN
        -- Update scheme usage if scheme mentioned
        UPDATE ref_schemes 
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE name_hi = ANY(NEW.schemes) OR name_en = ANY(NEW.schemes);
        
        -- Update event type usage
        UPDATE ref_event_types
        SET usage_count = usage_count + 1
        WHERE name_hi = NEW.event_type OR name_en = NEW.event_type;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_usage_on_approval
AFTER INSERT OR UPDATE ON parsed_events
FOR EACH ROW
WHEN (NEW.review_status = 'approved')
EXECUTE FUNCTION increment_usage_count();

COMMIT;
