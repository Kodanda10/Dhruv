#!/bin/bash
#
# Test GitHub Actions Workflow Locally
# Simulates what the workflow will do

set -e

echo "🧪 Testing GitHub Actions Workflow Locally"
echo "=========================================="
echo ""

# Check if secrets are set
if [ -z "$DATABASE_URL" ] || [ -z "$X_BEARER_TOKEN" ] || ([ -z "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ]); then
    echo "❌ Error: Environment variables not set"
    echo "   Please source .env.local or set:"
    echo "   - DATABASE_URL"
    echo "   - X_BEARER_TOKEN"
    echo "   - GEMINI_API_KEY (or GOOGLE_API_KEY)"
    exit 1
fi

echo "✅ Environment variables configured"
echo ""

# Test fetch script
echo "📥 Testing fetch script..."
python3 scripts/fetch_new_tweets_incremental.py --max-tweets 5 --parse --parse-delay 6.0 --handle OPChoudhary_Ind

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Workflow test successful!"
    echo ""
    echo "The GitHub Actions workflow should work correctly."
    echo "Next steps:"
    echo "1. Go to GitHub Actions tab"
    echo "2. Select 'Fetch and Parse New Tweets'"
    echo "3. Click 'Run workflow' to test"
else
    echo ""
    echo "❌ Workflow test failed"
    echo "   Check the errors above"
    exit 1
fi

