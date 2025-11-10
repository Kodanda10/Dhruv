BEGIN;

-- Seed a representative tweet if it does not already exist
INSERT INTO raw_tweets (
  tweet_id,
  text,
  created_at,
  author_handle,
  retweet_count,
  reply_count,
  like_count,
  quote_count,
  hashtags,
  mentions,
  urls
)
VALUES (
  'seed_tweet_1',
  'मुख्यमंत्री ने रायपुर में किसानों से मुलाकात की और योजनाओं की समीक्षा की।',
  '2025-01-01T10:00:00Z',
  'OPChoudhary_Ind',
  12,
  4,
  150,
  3,
  ARRAY['#छत्तीसगढ़', '#किसान']::text[],
  ARRAY['किसान प्रतिनिधि']::text[],
  ARRAY['https://example.com/news/seed-tweet-1']::text[]
)
ON CONFLICT (tweet_id) DO NOTHING;

-- Seed parsed event linked to the above tweet for analytics/tests
INSERT INTO parsed_events (
  tweet_id,
  event_type,
  event_type_en,
  event_code,
  event_date,
  locations,
  people_mentioned,
  organizations,
  schemes_mentioned,
  schemes_en,
  overall_confidence,
  needs_review,
  review_status,
  reasoning,
  generated_hashtags,
  parsed_at,
  parsed_by,
  updated_at
)
SELECT
  'seed_tweet_1',
  'बैठक',
  'Meeting',
  'MEETING',
  '2025-01-01',
  jsonb_build_array(jsonb_build_object('name', 'रायपुर', 'type', 'district', 'confidence', 0.95)),
  ARRAY['किसान प्रतिनिधि']::text[],
  ARRAY['कृषि विभाग']::text[],
  ARRAY['PM_KISAN']::text[],
  ARRAY['PM Kisan']::text[],
  0.92,
  false,
  'approved',
  'Seeded entry for integration tests',
  ARRAY['#छत्तीसगढ़', '#किसान']::text[],
  NOW(),
  'seed-script',
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM parsed_events WHERE tweet_id = 'seed_tweet_1');

-- Ensure geo corrections table has at least one entry for learning workflows
INSERT INTO geo_corrections (
  tweet_id,
  field_name,
  original_value,
  corrected_value,
  corrected_by,
  correction_reason
)
SELECT
  'seed_tweet_1',
  'geo_hierarchy',
  jsonb_build_object('district', 'रायपूर'),
  jsonb_build_object('district', 'रायपुर', 'assembly', 'रायपुर शहर उत्तर'),
  'seed-reviewer',
  'Standardize district spelling'
WHERE NOT EXISTS (
  SELECT 1 FROM geo_corrections WHERE tweet_id = 'seed_tweet_1' AND field_name = 'geo_hierarchy'
);

COMMIT;
