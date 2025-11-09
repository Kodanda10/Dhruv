-- Remove English-only tweets from OP Choudhary account
-- OPC only tweets in Hindi, so English tweets are likely spam or errors

-- First, check what will be deleted
SELECT COUNT(*) as tweets_to_delete
FROM raw_tweets
WHERE author_handle = 'OPChoudhary_Ind'
  AND text !~ '[अ-ह]'  -- No Devanagari characters
  AND text !~ '[०-९]'  -- No Devanagari numerals
  AND LENGTH(text) > 10;  -- More than just URLs

-- Delete English-only tweets
-- WARNING: Run the SELECT above first to verify!
-- DELETE FROM raw_tweets
-- WHERE author_handle = 'OPChoudhary_Ind'
--   AND text !~ '[अ-ह]'
--   AND text !~ '[०-९]'
--   AND LENGTH(text) > 10;

-- Also delete corresponding parsed_events
-- DELETE FROM parsed_events
-- WHERE tweet_id IN (
--   SELECT tweet_id
--   FROM raw_tweets
--   WHERE author_handle = 'OPChoudhary_Ind'
--     AND text !~ '[अ-ह]'
--     AND text !~ '[०-९]'
--     AND LENGTH(text) > 10
-- );


