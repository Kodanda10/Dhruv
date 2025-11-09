#!/bin/bash
# Create properly formatted RTF file from database tweets

RTF_FILE="database_tweets_readable.rtf"
TEMP_SQL="temp_export.sql"

# Create SQL query to fetch tweets
cat > "$TEMP_SQL" <<'SQL'
SELECT 
    rt.tweet_id,
    rt.text,
    rt.created_at,
    COALESCE(pe.event_type_hi, pe.event_type, 'N/A') as event_type,
    COALESCE(pe.overall_confidence::text, 'N/A') as confidence
FROM raw_tweets rt
LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
WHERE rt.author_handle = 'OPChoudhary_Ind'
ORDER BY rt.created_at DESC;
SQL

# Create RTF header
cat > "$RTF_FILE" <<'RTFHEAD'
{\rtf1\ansi\ansicpg1252\cocoartf2865
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 ================================================================================
OP CHOUDHARY TWEETS - DATABASE EXPORT
================================================================================

RTFHEAD

echo "Generated: $(date)" >> "$RTF_FILE"
echo "" >> "$RTF_FILE"

# Get count
COUNT=$(PGPASSWORD=dhruv_pass psql -h localhost -U dhruv_user -d dhruv_db -t -c "SELECT COUNT(*) FROM raw_tweets WHERE author_handle = 'OPChoudhary_Ind';")
echo "Total Tweets: $COUNT" >> "$RTF_FILE"
echo "" >> "$RTF_FILE"
echo "================================================================================" >> "$RTF_FILE"
echo "" >> "$RTF_FILE"

# Export tweets and format as RTF
PGPASSWORD=dhruv_pass psql -h localhost -U dhruv_user -d dhruv_db -f "$TEMP_SQL" -A -F " | " -t | \
while IFS='|' read -r tweet_id text created_at event_type confidence; do
    echo "Tweet ID: $tweet_id" >> "$RTF_FILE"
    echo "Date: $created_at" >> "$RTF_FILE"
    echo "Event Type: $event_type" >> "$RTF_FILE"
    echo "Confidence: $confidence" >> "$RTF_FILE"
    echo "" >> "$RTF_FILE"
    echo "Text:" >> "$RTF_FILE"
    echo "$text" >> "$RTF_FILE"
    echo "" >> "$RTF_FILE"
    echo "--------------------------------------------------------------------------------" >> "$RTF_FILE"
    echo "" >> "$RTF_FILE"
done

# Add RTF footer
echo "================================================================================" >> "$RTF_FILE"
echo "END OF EXPORT" >> "$RTF_FILE"
echo "================================================================================" >> "$RTF_FILE"
echo "}" >> "$RTF_FILE"

# Cleanup
rm -f "$TEMP_SQL"

echo "✅ Created RTF file: $RTF_FILE"
echo "📊 Total tweets exported: $COUNT"


