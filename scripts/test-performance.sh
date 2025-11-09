#!/bin/bash
# Performance & Stress Test Script
# Tests API endpoints under load and verifies benchmarks

set -e

echo "🔥 Starting Performance & Stress Tests..."
echo ""

# Check if server is running
if ! curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
  echo "❌ Server not running on port 3001. Please start it first:"
  echo "   npm run start"
  exit 1
fi

# Run k6 load test
echo "📈 Running k6 load tests..."
if command -v k6 &> /dev/null; then
  k6 run tests/load.k6.js
else
  echo "⚠️  k6 not installed. Install it: https://k6.io/docs/getting-started/installation/"
fi

echo ""
echo "✅ Performance tests complete!"

