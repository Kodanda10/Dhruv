#!/bin/bash
# Simple script to export tweets to readable format using psql

OUTPUT_FILE="database_tweets_export.txt"
RTF_FILE="database_tweets_export.rtf"

echo "Exporting OP Choudhary tweets from database..."

PGPASSWORD=dhruv_pass psql -h localhost -U dhruv_user -d dhruv_db <<EOF > "$OUTPUT_FILE"
\echo ================================================================================
\echo OP CHOUDHARY TWEETS - DATABASE EXPORT
\echo ================================================================================
\echo 
\echo Generated: $(date)
\echo 

SELECT 
    'Tweet #' || ROW_NUMBER() OVER (ORDER BY rt.created_at DESC) as tweet_num,
    'ID: ' || rt.tweet_id as id,
    'Date: ' || rt.created_at::text as date,
    'Author: @' || rt.author_handle as author,
    'Event: ' || COALESCE(pe.event_type_hi, pe.event_type, 'N/A') as event,
    'Confidence: ' || COALESCE(pe.overall_confidence::text, 'N/A') as confidence,
    'Text: ' || rt.text as text,
    '---' as separator
FROM raw_tweets rt
LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
WHERE rt.author_handle = 'OPChoudhary_Ind'
ORDER BY rt.created_at DESC
LIMIT 50;

\echo ================================================================================
\echo END OF EXPORT
\echo ================================================================================
EOF

echo "✅ Exported to $OUTPUT_FILE"
echo "📄 Showing first 20 lines:"
head -20 "$OUTPUT_FILE"


