#!/bin/bash
# Direct database check script

DB_URL="${DATABASE_URL:-postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db}"

echo "=========================================="
echo "DATABASE TWEETS CHECK"
echo "=========================================="
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ psql not found. Please install PostgreSQL client."
    exit 1
fi

# Run queries
psql "$DB_URL" <<EOF
\echo '📊 Total tweets in database:'
SELECT COUNT(*) as total FROM raw_tweets;

\echo ''
\echo '📊 Total parsed events:'
SELECT COUNT(*) as total FROM parsed_events;

\echo ''
\echo '📋 raw_tweets table columns:'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'raw_tweets'
ORDER BY ordinal_position;

\echo ''
\echo '🔍 Checking for OP Choudhary tweets (by author_username):'
SELECT COUNT(*) as count 
FROM raw_tweets 
WHERE author_username ILIKE '%op%choudhary%' 
   OR author_username ILIKE '%opchoudhary%';

\echo ''
\echo '📝 Sample OP Choudhary tweets (if any):'
SELECT tweet_id, LEFT(text, 100) as text_preview, created_at, author_username 
FROM raw_tweets 
WHERE author_username ILIKE '%op%choudhary%' 
   OR author_username ILIKE '%opchoudhary%'
ORDER BY created_at DESC 
LIMIT 3;

\echo ''
\echo '📝 Sample of all tweets (last 5):'
SELECT tweet_id, LEFT(text, 100) as text_preview, created_at, 
       COALESCE(author_username, author_id::text, 'unknown') as author
FROM raw_tweets 
ORDER BY created_at DESC 
LIMIT 5;

\echo ''
\echo '📊 Parsed events from OP Choudhary:'
SELECT COUNT(*) as count
FROM parsed_events pe
JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
WHERE rt.author_username ILIKE '%op%choudhary%' 
   OR rt.author_username ILIKE '%opchoudhary%';
EOF


