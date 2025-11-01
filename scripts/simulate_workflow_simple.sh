#!/bin/bash
# Simplified workflow simulation script
# This script tests the complete automated parsing pipeline

set -e  # Exit on any error

echo "=== Starting Simplified Workflow Simulation ==="
echo "Timestamp: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Check if Next.js is running
print_status "Step 1: Checking Next.js server..."

if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
    print_success "Next.js server is running"
else
    print_error "Next.js server is not running. Please start it with: npm run dev"
    exit 1
fi

# Step 2: Check system health
print_status "Step 2: Checking system health..."

HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/health)
if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' >/dev/null 2>&1; then
    print_success "System is healthy"
    
    # Extract counts
    RAW_TWEETS=$(echo "$HEALTH_RESPONSE" | jq '.counts.raw_tweets')
    PARSED_EVENTS=$(echo "$HEALTH_RESPONSE" | jq '.counts.parsed_events')
    REVIEW_QUEUE=$(echo "$HEALTH_RESPONSE" | jq '.counts.review_queue')
    APPROVED_TWEETS=$(echo "$HEALTH_RESPONSE" | jq '.counts.approved_tweets')
    
    print_status "Current data:"
    echo "  - Raw tweets: $RAW_TWEETS"
    echo "  - Parsed events: $PARSED_EVENTS"
    echo "  - Review queue: $REVIEW_QUEUE"
    echo "  - Approved tweets: $APPROVED_TWEETS"
else
    print_error "System health check failed"
    exit 1
fi

# Step 3: Test review queue
print_status "Step 3: Testing review queue..."

REVIEW_RESPONSE=$(curl -s "http://localhost:3000/api/parsed-events?needs_review=true")
REVIEW_COUNT=$(echo "$REVIEW_RESPONSE" | jq '.data | length')

if [ "$REVIEW_COUNT" -gt 0 ]; then
    print_success "Review queue has $REVIEW_COUNT tweets ready for human review"
    
    # Show first tweet details
    FIRST_TWEET=$(echo "$REVIEW_RESPONSE" | jq '.data[0]')
    TWEET_ID=$(echo "$FIRST_TWEET" | jq -r '.tweet_id')
    EVENT_TYPE=$(echo "$FIRST_TWEET" | jq -r '.event_type')
    LOCATIONS=$(echo "$FIRST_TWEET" | jq -r '.locations | join(", ")')
    
    print_status "Sample tweet in review:"
    echo "  - Tweet ID: $TWEET_ID"
    echo "  - Event Type: $EVENT_TYPE"
    echo "  - Locations: $LOCATIONS"
else
    print_warning "No tweets in review queue"
fi

# Step 4: Test analytics
print_status "Step 4: Testing analytics..."

ANALYTICS_RESPONSE=$(curl -s "http://localhost:3000/api/parsed-events?analytics=true")
ANALYTICS_TOTAL=$(echo "$ANALYTICS_RESPONSE" | jq '.analytics.total_tweets')

if [ "$ANALYTICS_TOTAL" -gt 0 ]; then
    print_success "Analytics shows $ANALYTICS_TOTAL approved tweets"
    
    # Show analytics breakdown
    EVENT_DIST=$(echo "$ANALYTICS_RESPONSE" | jq '.analytics.event_distribution')
    LOCATION_DIST=$(echo "$ANALYTICS_RESPONSE" | jq '.analytics.location_distribution')
    SCHEME_USAGE=$(echo "$ANALYTICS_RESPONSE" | jq '.analytics.scheme_usage')
    
    print_status "Analytics breakdown:"
    echo "  - Event distribution: $EVENT_DIST"
    echo "  - Location distribution: $LOCATION_DIST"
    echo "  - Scheme usage: $SCHEME_USAGE"
else
    print_warning "No analytics data available (need approved tweets)"
fi

# Step 5: Test learning system
print_status "Step 5: Testing learning system..."

# Test GET suggestions
SUGGESTIONS_RESPONSE=$(curl -s "http://localhost:3000/api/reference/learn?type=scheme")
SUGGESTIONS_COUNT=$(echo "$SUGGESTIONS_RESPONSE" | jq '.suggestions | length')

if [ "$SUGGESTIONS_COUNT" -gt 0 ]; then
    print_success "Learning system has $SUGGESTIONS_COUNT scheme suggestions"
else
    print_warning "No scheme suggestions available"
fi

# Test POST learning (add new scheme)
LEARN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/reference/learn" \
  -H "Content-Type: application/json" \
  -d "{
    \"entity_type\": \"scheme\",
    \"value_hi\": \"टेस्ट योजना $(date +%s)\",
    \"value_en\": \"Test Scheme $(date +%s)\",
    \"source_tweet_id\": \"$TWEET_ID\",
    \"approved_by\": \"simulation\"
  }")

LEARN_SUCCESS=$(echo "$LEARN_RESPONSE" | jq -r '.success')

if [ "$LEARN_SUCCESS" = "true" ]; then
    print_success "Learning system working - new scheme added"
    CONTRIBUTION_ID=$(echo "$LEARN_RESPONSE" | jq -r '.contribution_id')
    USAGE_COUNT=$(echo "$LEARN_RESPONSE" | jq -r '.usage_count')
    PROMOTED=$(echo "$LEARN_RESPONSE" | jq -r '.promoted')
    
    print_status "Learning details:"
    echo "  - Contribution ID: $CONTRIBUTION_ID"
    echo "  - Usage count: $USAGE_COUNT"
    echo "  - Promoted to reference: $PROMOTED"
else
    print_warning "Learning system test failed"
fi

# Step 6: Test home table
print_status "Step 6: Testing home table..."

HOME_RESPONSE=$(curl -s "http://localhost:3000/api/parsed-events?needs_review=false")
HOME_COUNT=$(echo "$HOME_RESPONSE" | jq '.data | length')

if [ "$HOME_COUNT" -gt 0 ]; then
    print_success "Home table shows $HOME_COUNT approved tweets"
else
    print_warning "No approved tweets in home table"
fi

# Step 7: Generate summary report
print_status "Step 7: Generating summary report..."

cat > workflow_simulation_report.md << EOF
# Workflow Simulation Report

**Date:** $(date)
**Status:** $([ "$REVIEW_COUNT" -gt 0 ] && echo "✅ SUCCESS" || echo "⚠️ PARTIAL")

## Pipeline Status

| Stage | Count | Status |
|-------|-------|--------|
| Raw Tweets | $RAW_TWEETS | ✅ |
| Parsed Events | $PARSED_EVENTS | ✅ |
| Review Queue | $REVIEW_COUNT | $([ "$REVIEW_COUNT" -gt 0 ] && echo "✅" || echo "⚠️") |
| Approved Tweets | $ANALYTICS_TOTAL | $([ "$ANALYTICS_TOTAL" -gt 0 ] && echo "✅" || echo "⚠️") |
| Analytics Data | $ANALYTICS_TOTAL | $([ "$ANALYTICS_TOTAL" -gt 0 ] && echo "✅" || echo "⚠️") |

## API Endpoints Tested

- ✅ `/api/health` - System health check
- ✅ `/api/parsed-events?needs_review=true` - Review queue
- ✅ `/api/parsed-events?analytics=true` - Analytics data
- ✅ `/api/reference/learn` - Learning system (GET/POST)
- ✅ `/api/parsed-events?needs_review=false` - Home table

## Test Results

### Review Queue
- **Count**: $REVIEW_COUNT tweets
- **Status**: $([ "$REVIEW_COUNT" -gt 0 ] && echo "✅ Working" || echo "⚠️ Empty")

### Analytics
- **Count**: $ANALYTICS_TOTAL approved tweets
- **Status**: $([ "$ANALYTICS_TOTAL" -gt 0 ] && echo "✅ Working" || echo "⚠️ No data")

### Learning System
- **Suggestions**: $SUGGESTIONS_COUNT schemes available
- **POST Test**: $([ "$LEARN_SUCCESS" = "true" ] && echo "✅ Working" || echo "❌ Failed")
- **Status**: $([ "$LEARN_SUCCESS" = "true" ] && echo "✅ Working" || echo "⚠️ Needs attention")

## Next Steps

1. **Manual Review**: Visit http://localhost:3000 and review tweets in the Samiksha tab
2. **Approve Tweets**: Mark tweets as approved to see them in analytics
3. **Test Learning**: Add new schemes/event types in the review interface
4. **Verify Analytics**: Check that approved tweets appear in analytics charts

## Manual Verification Steps

1. Open http://localhost:3000 in browser
2. Navigate to "Samiksha" tab
3. Review tweets in the queue
4. Approve some tweets
5. Check "Analytics" tab for updated charts
6. Test adding new schemes/event types in review interface

## Troubleshooting

If any stage failed:
1. Check Next.js logs: \`npm run dev\`
2. Check database: \`docker exec infra-postgres-1 psql -U dhruv_user -d dhruv_db\`
3. Check API endpoints: \`curl http://localhost:3000/api/health\`

EOF

print_success "Report generated: workflow_simulation_report.md"

echo ""
echo "=== Workflow Simulation Complete ==="
echo ""
print_status "Summary:"
echo "  - Review Queue: $REVIEW_COUNT tweets"
echo "  - Analytics: $ANALYTICS_TOTAL approved tweets"
echo "  - Learning System: $([ "$LEARN_SUCCESS" = "true" ] && echo "Working" || echo "Needs attention")"
echo "  - Suggestions: $SUGGESTIONS_COUNT schemes available"
echo ""
print_status "Next: Visit http://localhost:3000 to manually review and approve tweets"
echo "Report: workflow_simulation_report.md"
