#!/bin/bash
# Test data pipeline - verify API endpoints return real database data

echo "=========================================="
echo "DATA PIPELINE TEST"
echo "=========================================="
echo ""

DB_URL="${DATABASE_URL:-postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db}"

echo "1. Checking database connection..."
psql "$DB_URL" -c "SELECT COUNT(*) as total_tweets FROM raw_tweets;" -t || {
    echo "❌ Database connection failed"
    exit 1
}

echo ""
echo "2. Checking parsed events count..."
psql "$DB_URL" -c "SELECT COUNT(*) as total_parsed FROM parsed_events;" -t

echo ""
echo "3. Checking OP Choudhary tweets..."
psql "$DB_URL" -c "SELECT COUNT(*) as op_tweets FROM raw_tweets WHERE author_handle ILIKE '%op%choudhary%';" -t

echo ""
echo "4. Sample parsed event structure:"
psql "$DB_URL" -c "SELECT pe.id, pe.tweet_id, rt.author_handle, pe.event_type, pe.overall_confidence, pe.needs_review FROM parsed_events pe JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id LIMIT 3;" -t

echo ""
echo "✅ Data pipeline check complete"
echo ""
echo "Next steps:"
echo "1. Ensure DATABASE_URL is set correctly"
echo "2. Test Next.js API: curl http://localhost:3000/api/parsed-events?limit=5"
echo "3. Test Flask API: curl http://localhost:5000/api/parsed-events?limit=5"


