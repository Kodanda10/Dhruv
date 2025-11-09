-- Migration 005: Create CMS configuration tables
-- Stores dynamic titles, module toggles, and system configuration

-- CMS Titles Configuration Table
CREATE TABLE IF NOT EXISTS cms_titles (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value_hi TEXT NOT NULL,
  value_en TEXT,
  section VARCHAR(100) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cms_titles_section ON cms_titles(section);
CREATE INDEX IF NOT EXISTS idx_cms_titles_key ON cms_titles(key);

COMMENT ON TABLE cms_titles IS 'Stores dynamic titles and headers for CMS editing';
COMMENT ON COLUMN cms_titles.key IS 'Unique identifier for the title (e.g., "dashboard.main_title")';
COMMENT ON COLUMN cms_titles.value_hi IS 'Hindi text value';
COMMENT ON COLUMN cms_titles.value_en IS 'English text value (optional)';
COMMENT ON COLUMN cms_titles.section IS 'Section where title is used (dashboard, analytics, review, etc.)';

-- Analytics Modules Toggle Table
CREATE TABLE IF NOT EXISTS analytics_modules (
  id SERIAL PRIMARY KEY,
  module_key VARCHAR(100) UNIQUE NOT NULL,
  module_name_hi VARCHAR(255) NOT NULL,
  module_name_en VARCHAR(255),
  enabled BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_modules_enabled ON analytics_modules(enabled);
CREATE INDEX IF NOT EXISTS idx_analytics_modules_order ON analytics_modules(display_order);

COMMENT ON TABLE analytics_modules IS 'Stores analytics module visibility toggles';
COMMENT ON COLUMN analytics_modules.module_key IS 'Unique module identifier (event_type, geo_mapping, etc.)';
COMMENT ON COLUMN analytics_modules.enabled IS 'Whether module is visible in UI';

-- Insert default analytics modules
INSERT INTO analytics_modules (module_key, module_name_hi, module_name_en, enabled, display_order) VALUES
  ('event_type', 'इवेंट प्रकार विश्लेषण', 'Event Type Analysis', TRUE, 1),
  ('geo_mapping', 'भौगोलिक मैपिंग', 'Geo-Mapping', TRUE, 2),
  ('tour_coverage', 'दौरा कवरेज', 'Tour Coverage', TRUE, 3),
  ('development_works', 'विकास कार्य', 'Development Works', TRUE, 4),
  ('community_outreach', 'सामुदायिक आउटरीच', 'Community Outreach', TRUE, 5),
  ('schemes', 'योजनाएं', 'Schemes', TRUE, 6),
  ('beneficiary_groups', 'लाभार्थी समूह', 'Beneficiary Groups', TRUE, 7),
  ('thematic', 'विषयगत विश्लेषण', 'Thematic Analysis', TRUE, 8),
  ('raigarh', 'रायगढ़ विधानसभा', 'Raigarh Constituency', TRUE, 9)
ON CONFLICT (module_key) DO NOTHING;

-- System Configuration Table
CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(255) UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);

COMMENT ON TABLE system_config IS 'Stores general system configuration as JSONB';
COMMENT ON COLUMN system_config.config_key IS 'Unique configuration key';
COMMENT ON COLUMN system_config.config_value IS 'Configuration value as JSONB';

-- Insert default titles
INSERT INTO cms_titles (key, value_hi, value_en, section) VALUES
  ('dashboard.main_title', 'सोशल मीडिया एनालिटिक्स डैशबोर्ड', 'Social Media Analytics Dashboard', 'dashboard'),
  ('analytics.section_title', 'एनालिटिक्स', 'Analytics', 'analytics'),
  ('review.section_title', 'समीक्षा', 'Review', 'review'),
  ('commandview.section_title', 'कमांड व्यू', 'Command View', 'commandview')
ON CONFLICT (key) DO NOTHING;


