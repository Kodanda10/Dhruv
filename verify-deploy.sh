#!/bin/bash

echo "🔍 PROJECT DHRUV – POST DEPLOY CHECK ($(date))"

echo "=============================================="

PROD_URL="https://your-vercel-app-url.vercel.app"

echo "🌐 Checking live dashboard..."

curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/analytics"

echo ""

echo "🔌 API Checks:"

for endpoint in analytics health parsed-events; do

  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/api/$endpoint")

  echo "  /api/$endpoint → $CODE"

done

echo ""

echo "🎨 Theme consistency test:"

npm run test:theme | grep -E "(PASS|FAIL|Test Suites|Tests)"

echo ""

echo "📊 Lighthouse performance (summary):"

npx lighthouse "$PROD_URL/analytics" --quiet --chrome-flags="--headless" --only-categories=performance,accessibility,best-practices --budget-path=./lighthouse-budget.json --output=json --output-path=./lighthouse-report.json

jq '.categories | {performance: .performance.score, accessibility: .accessibility.score}' ./lighthouse-report.json

echo ""

echo "✅ Verification complete!"

