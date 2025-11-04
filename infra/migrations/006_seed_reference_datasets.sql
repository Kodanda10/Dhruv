BEGIN;

-- Migration 006: Seed Reference Datasets for Gemini Parser Integration
-- Purpose: Populate ref_hashtags and enhance user_contributed_data for intelligent parsing

-- Seed Reference Hashtags for intelligent suggestions
INSERT INTO ref_hashtags (hashtag, category, usage_count, is_active) VALUES
-- Location hashtags
('#छत्तीसगढ़', 'location', 100, true),
('#Chhattisgarh', 'location', 50, true),
('#रायगढ़', 'location', 30, true),
('#Raigarh', 'location', 15, true),
('#बिलासपुर', 'location', 25, true),
('#Bilaspur', 'location', 12, true),
('#दुर्ग', 'location', 20, true),
('#Durg', 'location', 10, true),
('#राजनांदगांव', 'location', 18, true),
('#Rajnandgaon', 'location', 9, true),
('#बस्तर', 'location', 15, true),
('#Bastar', 'location', 8, true),
('#सरगुजा', 'location', 12, true),
('#Surguja', 'location', 6, true),

-- Scheme hashtags
('#किसान', 'scheme', 40, true),
('#Kisan', 'scheme', 20, true),
('#युवा', 'scheme', 20, true),
('#Yuva', 'scheme', 10, true),
('#स्वास्थ्य', 'scheme', 25, true),
('#Health', 'scheme', 12, true),
('#शिक्षा', 'scheme', 22, true),
('#Education', 'scheme', 11, true),
('#आवास', 'scheme', 18, true),
('#Housing', 'scheme', 9, true),
('#गैस', 'scheme', 15, true),
('#Gas', 'scheme', 8, true),

-- Event hashtags
('#बैठक', 'event', 35, true),
('#Meeting', 'event', 18, true),
('#रैली', 'event', 15, true),
('#Rally', 'event', 8, true),
('#निरीक्षण', 'event', 20, true),
('#Inspection', 'event', 10, true),
('#उद्घाटन', 'event', 12, true),
('#Inauguration', 'event', 6, true),
('#वितरण', 'event', 16, true),
('#Distribution', 'event', 8, true),
('#दौरा', 'event', 14, true),
('#Visit', 'event', 7, true),
('#समारोह', 'event', 10, true),
('#Celebration', 'event', 5, true),

-- General political hashtags
('#राजनीति', 'general', 30, true),
('#Politics', 'general', 15, true),
('#सरकार', 'general', 25, true),
('#Government', 'general', 12, true),
('#विकास', 'general', 20, true),
('#Development', 'general', 10, true),
('#जनता', 'general', 18, true),
('#Public', 'general', 9, true),
('#लोकतंत्र', 'general', 15, true),
('#Democracy', 'general', 8, true)
ON CONFLICT (hashtag) DO NOTHING;

-- Add sample user contributed data for testing
INSERT INTO user_contributed_data (entity_type, value_hi, value_en, aliases, approval_status, usage_count, metadata) VALUES
-- Event types
('event_type', 'नया कार्यक्रम', 'New Program', ARRAY['कार्यक्रम', 'प्रोग्राम'], 'approved', 5, '{"source": "human_review", "confidence": 0.9}'),
('event_type', 'विशेष बैठक', 'Special Meeting', ARRAY['विशेष', 'स्पेशल'], 'approved', 3, '{"source": "human_review", "confidence": 0.85}'),

-- Schemes
('scheme', 'नई किसान योजना', 'New Kisan Scheme', ARRAY['किसान', 'योजना'], 'approved', 2, '{"source": "human_review", "confidence": 0.8}'),
('scheme', 'युवा उद्यमिता', 'Youth Entrepreneurship', ARRAY['युवा', 'उद्यमिता'], 'pending', 1, '{"source": "human_review", "confidence": 0.7}'),

-- Hashtags
('hashtag', '#नयाहैशटैग', '#NewHashtag', ARRAY['#नया', '#हैशटैग'], 'approved', 3, '{"source": "human_review", "confidence": 0.9}'),
('hashtag', '#विकासपथ', '#DevelopmentPath', ARRAY['#विकास', '#पथ'], 'approved', 2, '{"source": "human_review", "confidence": 0.85}'),

-- Locations
('location', 'नया गांव', 'New Village', ARRAY['गांव', 'विलेज'], 'approved', 1, '{"source": "human_review", "confidence": 0.8}'),
('location', 'विशेष क्षेत्र', 'Special Area', ARRAY['क्षेत्र', 'एरिया'], 'pending', 1, '{"source": "human_review", "confidence": 0.75}'),

-- Organizations
('organization', 'नया संगठन', 'New Organization', ARRAY['संगठन', 'ऑर्गनाइजेशन'], 'approved', 2, '{"source": "human_review", "confidence": 0.85}'),
('organization', 'युवा मंडल', 'Youth Council', ARRAY['मंडल', 'काउंसिल'], 'approved', 1, '{"source": "human_review", "confidence": 0.8}');

-- Update existing schemes with more comprehensive data
UPDATE ref_schemes SET 
  description_hi = CASE 
    WHEN scheme_code = 'PM_KISAN' THEN 'किसानों को वित्तीय सहायता प्रदान करने वाली केंद्र सरकार की योजना'
    WHEN scheme_code = 'CM_KISAN_CG' THEN 'छत्तीसगढ़ राज्य में किसानों को राज्य स्तरीय सहायता प्रदान करने वाली योजना'
    WHEN scheme_code = 'GODHAN_NYAY' THEN 'गाय के गोबर की खरीद कर किसानों को आय प्रदान करने वाली योजना'
    WHEN scheme_code = 'RAJIV_YUVA_MITAN' THEN 'युवाओं के विकास और रोजगार के लिए राज्य सरकार की योजना'
    ELSE description_hi
  END,
  description_en = CASE 
    WHEN scheme_code = 'PM_KISAN' THEN 'Central government scheme providing financial assistance to farmers'
    WHEN scheme_code = 'CM_KISAN_CG' THEN 'State government scheme providing state-level assistance to farmers in Chhattisgarh'
    WHEN scheme_code = 'GODHAN_NYAY' THEN 'Scheme providing income to farmers by purchasing cow dung'
    WHEN scheme_code = 'RAJIV_YUVA_MITAN' THEN 'State government scheme for youth development and employment'
    ELSE description_en
  END
WHERE scheme_code IN ('PM_KISAN', 'CM_KISAN_CG', 'GODHAN_NYAY', 'RAJIV_YUVA_MITAN');

-- Update existing event types with more comprehensive aliases
UPDATE ref_event_types SET 
  aliases_hi = CASE 
    WHEN event_code = 'MEETING' THEN ARRAY['मुलाकात', 'चर्चा', 'बैठक', 'सम्मेलन']
    WHEN event_code = 'RALLY' THEN ARRAY['सम्मेलन', 'जनसभा', 'रैली', 'सभा']
    WHEN event_code = 'INSPECTION' THEN ARRAY['समीक्षा', 'जांच', 'निरीक्षण', 'परीक्षण']
    WHEN event_code = 'INAUGURATION' THEN ARRAY['शिलान्यास', 'भूमिपूजन', 'उद्घाटन', 'प्रारंभ']
    WHEN event_code = 'DISTRIBUTION' THEN ARRAY['बंटवारा', 'प्रदान', 'वितरण', 'दान']
    WHEN event_code = 'VISIT' THEN ARRAY['भ्रमण', 'यात्रा', 'दौरा', 'सैर']
    WHEN event_code = 'CELEBRATION' THEN ARRAY['उत्सव', 'जयंती', 'समारोह', 'त्योहार']
    WHEN event_code = 'WORSHIP' THEN ARRAY['प्रार्थना', 'आरती', 'पूजा', 'उपासना']
    ELSE aliases_hi
  END,
  aliases_en = CASE 
    WHEN event_code = 'MEETING' THEN ARRAY['discussion', 'meeting', 'conference', 'gathering']
    WHEN event_code = 'RALLY' THEN ARRAY['conference', 'public meeting', 'rally', 'assembly']
    WHEN event_code = 'INSPECTION' THEN ARRAY['review', 'examination', 'inspection', 'assessment']
    WHEN event_code = 'INAUGURATION' THEN ARRAY['foundation', 'opening', 'inauguration', 'launch']
    WHEN event_code = 'DISTRIBUTION' THEN ARRAY['handover', 'giving', 'distribution', 'donation']
    WHEN event_code = 'VISIT' THEN ARRAY['tour', 'trip', 'visit', 'excursion']
    WHEN event_code = 'CELEBRATION' THEN ARRAY['festival', 'anniversary', 'celebration', 'ceremony']
    WHEN event_code = 'WORSHIP' THEN ARRAY['prayer', 'ritual', 'worship', 'devotion']
    ELSE aliases_en
  END
WHERE event_code IN ('MEETING', 'RALLY', 'INSPECTION', 'INAUGURATION', 'DISTRIBUTION', 'VISIT', 'CELEBRATION', 'WORSHIP');

COMMIT;
