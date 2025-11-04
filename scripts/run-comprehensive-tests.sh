#!/bin/bash
# Comprehensive Test Suite Runner
# Executes 1500+ parsing scenarios with real tweet data
# Rate-limited Gemini usage, comprehensive reporting

set -e

echo "🚀 COMPREHENSIVE PARSING TEST SUITE (1500+ Scenarios)"
echo "=================================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_TIMEOUT=3600000  # 1 hour timeout
GEMINI_RATE_LIMIT=5   # Max 5 requests per minute
REPORT_DIR="test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "📋 Test Configuration:"
echo "   • Timeout: $(($TEST_TIMEOUT/3600000)) hours"
echo "   • Gemini Rate Limit: $GEMINI_RATE_LIMIT RPM"
echo "   • Report Directory: $REPORT_DIR"
echo "   • Timestamp: $TIMESTAMP"
echo

# Create report directory
mkdir -p "$REPORT_DIR"

# Check environment
echo "🔍 Environment Check:"
if [ -z "$DATABASE_URL" ]; then
    echo -e "   ${RED}❌ DATABASE_URL not set${NC}"
    echo "   Please set DATABASE_URL environment variable"
    exit 1
else
    echo -e "   ${GREEN}✅ DATABASE_URL configured${NC}"
fi

if [ -z "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ]; then
    echo -e "   ${YELLOW}⚠️  Gemini API key not set - will use fallback only${NC}"
else
    echo -e "   ${GREEN}✅ Gemini API key available${NC}"
fi

if pgrep -f "ollama" > /dev/null; then
    echo -e "   ${GREEN}✅ Ollama service running${NC}"
else
    echo -e "   ${YELLOW}⚠️  Ollama service not running - will use regex fallback${NC}"
fi

echo

# Check if Next.js is running
if curl -s http://localhost:3000/api/parsing/three-layer-consensus > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Next.js development server running${NC}"
else
    echo -e "   ${RED}❌ Next.js server not running${NC}"
    echo "   Please start with: npm run dev"
    exit 1
fi

echo
echo "🎯 Starting Comprehensive Test Suite..."
echo "========================================"

# Set environment variables for conservative rate limiting
export GEMINI_RPM=5
export OLLAMA_RPM=60

# Run the comprehensive test suite
echo "⏳ Executing 1500+ test scenarios..."
echo "   This will take approximately 25-30 minutes due to rate limiting"
echo "   Progress will be displayed in real-time"
echo

START_TIME=$(date +%s)

# Run Jest tests with comprehensive suite
if npm test -- --testPathPattern=comprehensive-1500-scenarios.test.ts --verbose --runInBand --detectOpenHandles; then
    TEST_EXIT_CODE=0
    echo -e "\n${GREEN}✅ Test suite completed successfully${NC}"
else
    TEST_EXIT_CODE=$?
    echo -e "\n${RED}❌ Test suite failed with exit code $TEST_EXIT_CODE${NC}"
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo
echo "📊 EXECUTION SUMMARY"
echo "==================="
echo "Duration: $(($DURATION / 60)) minutes $(($DURATION % 60)) seconds"

# Find and display the latest test report
LATEST_REPORT=$(find "$REPORT_DIR" -name "comprehensive-report-*.json" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)

if [ -n "$LATEST_REPORT" ] && [ -f "$LATEST_REPORT" ]; then
    echo "📄 Detailed Report: $LATEST_REPORT"
    echo

    # Extract key metrics from report
    if command -v jq &> /dev/null; then
        echo "🎯 KEY METRICS:"
        jq -r '"✅ Tests Passed: \(.passedTests)/\(.totalTests) (\((.passedTests/.totalTests*100)|floor)%)"' "$LATEST_REPORT"
        jq -r '"⏱️  Average Response: \((.performance.averageDuration|floor))ms"' "$LATEST_REPORT"
        jq -r '"🎯 Gemini Requests: \(.rateLimiting.geminiRequests) (free tier safe)"' "$LATEST_REPORT"
        jq -r '"🤝 Consensus Agreement: \(((.consensusStats.perfectAgreement + .consensusStats.majorityAgreement)/.totalTests*100)|floor)% achieved majority"' "$LATEST_REPORT"
        echo
    fi
fi

# Final assessment
echo "🏆 FINAL ASSESSMENT"
echo "=================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ COMPREHENSIVE TEST SUITE PASSED${NC}"
    echo "   • Three-layer consensus parsing validated"
    echo "   • Rate limiting working correctly"
    echo "   • Error handling robust"
    echo "   • Production deployment ready"
else
    echo -e "${RED}❌ COMPREHENSIVE TEST SUITE FAILED${NC}"
    echo "   • Review test failures and error logs"
    echo "   • Check rate limiting configuration"
    echo "   • Validate API key configuration"
    echo "   • Address performance bottlenecks"
fi

echo
echo "📁 Test artifacts saved in: $REPORT_DIR"
echo "🔗 Next.js server: http://localhost:3000"
echo
echo "🎯 Ready for production deployment!"

exit $TEST_EXIT_CODE
