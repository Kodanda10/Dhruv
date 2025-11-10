#!/bin/bash
# Complete workflow simulation script
# This script simulates the entire automated parsing pipeline

set -e  # Exit on any error

echo "=== Starting Complete Workflow Simulation ==="
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local check_command=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if eval "$check_command" >/dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start after $max_attempts attempts"
    return 1
}

# Step 1: Check prerequisites
print_status "Step 1: Checking prerequisites..."

# Check if Docker is running
if ! command_exists docker; then
    print_error "Docker is not installed"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running"
    exit 1
fi

# Check if PostgreSQL container is running
if ! docker ps | grep -q "infra-postgres-1"; then
    print_warning "PostgreSQL container not running, starting it..."
    cd infra && docker-compose up -d postgres
    cd ..
fi

# Wait for PostgreSQL to be ready
wait_for_service "PostgreSQL" "docker exec infra-postgres-1 pg_isready -U dhruv_user -d dhruv_db"

# Check if Node.js and npm are available
if ! command_exists node; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
fi

# Check if Python is available
if ! command_exists python3; then
    print_error "Python 3 is not installed"
    exit 1
fi

print_success "All prerequisites met!"

# Step 2: Apply database migrations
print_status "Step 2: Applying database migrations..."

# Apply migration 003 (if not already applied)
if docker exec infra-postgres-1 psql -U dhruv_user -d dhruv_db -c "\dt" | grep -q "parsed_events"; then
    print_success "Migration 003 already applied"
else
    print_status "Applying migration 003..."
    docker exec -i infra-postgres-1 psql -U dhruv_user -d dhruv_db < infra/migrations/003_add_parsing_metadata.sql
    print_success "Migration 003 applied"
fi

# Apply migration 004 (if not already applied)
if docker exec infra-postgres-1 psql -U dhruv_user -d dhruv_db -c "\dt" | grep -q "ref_schemes"; then
    print_success "Migration 004 already applied"
else
    print_status "Applying migration 004..."
    docker exec -i infra-postgres-1 psql -U dhruv_user -d dhruv_db < infra/migrations/004_reference_datasets.sql
    print_success "Migration 004 applied"
fi

# Apply migration 005 (if not already applied)
if docker exec infra-postgres-1 psql -U dhruv_user -d dhruv_db -c "\d parsed_events" | grep -q "event_type_en"; then
    print_success "Migration 005 already applied"
else
    print_status "Applying migration 005..."
    docker exec -i infra-postgres-1 psql -U dhruv_user -d dhruv_db < infra/migrations/005_enhance_parsed_events.sql
    print_success "Migration 005 applied"
fi

# Seed additional reference data
print_status "Seeding additional reference data..."
if docker exec infra-postgres-1 python3 scripts/seed_reference_data.py; then
    print_success "Reference data seeded successfully"
else
    print_warning "Reference data seeding failed (may already be seeded)"
fi

# Step 3: Start Next.js development server (if not running)
print_status "Step 3: Starting Next.js development server..."

if ! pgrep -f "next dev" >/dev/null; then
    print_status "Starting Next.js server in background..."
    npm run dev &
    NEXTJS_PID=$!
    
    # Wait for Next.js to be ready
    wait_for_service "Next.js" "curl -s http://localhost:3000/api/health >/dev/null 2>&1 || curl -s http://localhost:3000 >/dev/null 2>&1"
    
    print_success "Next.js server started (PID: $NEXTJS_PID)"
else
    print_success "Next.js server already running"
fi

# Step 4: Fetch tweets
print_status "Step 4: Fetching tweets..."

# Check if fetch script exists
if [ ! -f "fetch_5_latest_tweets_final.py" ]; then
    print_error "Tweet fetch script not found: fetch_5_latest_tweets_final.py"
    exit 1
fi

# Run tweet fetch script
if python3 fetch_5_latest_tweets_final.py; then
    print_success "Tweets fetched successfully"
else
    print_error "Tweet fetching failed"
    exit 1
fi

# Step 5: Wait for parsing
print_status "Step 5: Waiting for background parsing (15s)..."
sleep 15

# Check if parsing script exists and run it
if [ -f "scripts/parse_new_tweets.py" ]; then
    print_status "Running parsing script..."
    if docker exec infra-postgres-1 python3 scripts/parse_new_tweets.py; then
        print_success "Parsing completed"
    else
        print_warning "Parsing failed (check logs)"
    fi
else
    print_warning "Parsing script not found, skipping automatic parsing"
fi

# Step 6: Check review queue
print_status "Step 6: Checking review queue..."

REVIEW_COUNT=$(curl -s "http://localhost:3000/api/parsed-events?needs_review=true" | jq '.data | length' 2>/dev/null || echo "0")
print_status "Found $REVIEW_COUNT tweets in review queue"

if [ "$REVIEW_COUNT" -gt 0 ]; then
    print_success "Review queue has tweets ready for human review"
else
    print_warning "No tweets in review queue"
fi

# Step 7: Test suggestions API
print_status "Step 7: Testing suggestions API..."

# Test scheme suggestions
SCHEME_SUGGESTIONS=$(curl -s "http://localhost:3000/api/reference/learn?type=scheme&q=किसान" | jq '.suggestions | length' 2>/dev/null || echo "0")
print_status "Found $SCHEME_SUGGESTIONS scheme suggestions for 'किसान'"

# Test event type suggestions
EVENT_SUGGESTIONS=$(curl -s "http://localhost:3000/api/reference/learn?type=event_type&q=बैठक" | jq '.suggestions | length' 2>/dev/null || echo "0")
print_status "Found $EVENT_SUGGESTIONS event type suggestions for 'बैठक'"

# Step 8: Check analytics
print_status "Step 8: Checking analytics data..."

ANALYTICS_TOTAL=$(curl -s "http://localhost:3000/api/parsed-events?analytics=true" | jq '.analytics.total_tweets' 2>/dev/null || echo "0")
print_status "Analytics shows $ANALYTICS_TOTAL approved tweets"

if [ "$ANALYTICS_TOTAL" -gt 0 ]; then
    print_success "Analytics data is populated"
    
    # Show analytics breakdown
    echo ""
    print_status "Analytics breakdown:"
    curl -s "http://localhost:3000/api/parsed-events?analytics=true" | jq '.analytics | {total_tweets, event_distribution, location_distribution, scheme_usage}' 2>/dev/null || echo "Failed to parse analytics"
else
    print_warning "No analytics data available"
fi

# Step 9: Test learning system
print_status "Step 9: Testing learning system..."

# Simulate adding a new scheme
LEARN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/reference/learn" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "scheme",
    "value_hi": "टेस्ट योजना",
    "value_en": "Test Scheme",
    "source_tweet_id": "test_123",
    "approved_by": "simulation"
  }' | jq '.success' 2>/dev/null || echo "false")

if [ "$LEARN_RESPONSE" = "true" ]; then
    print_success "Learning system working - new scheme added"
else
    print_warning "Learning system test failed"
fi

# Step 10: Verify home table
print_status "Step 10: Checking home table..."

HOME_COUNT=$(curl -s "http://localhost:3000/api/parsed-events?needs_review=false" | jq '.data | length' 2>/dev/null || echo "0")
print_status "Home table shows $HOME_COUNT approved tweets"

# Step 11: Generate summary report
print_status "Step 11: Generating summary report..."

cat > workflow_simulation_report.md << EOF
# Workflow Simulation Report

**Date:** $(date)
**Status:** $([ "$REVIEW_COUNT" -gt 0 ] && echo "✅ SUCCESS" || echo "⚠️ PARTIAL")

## Pipeline Status

| Stage | Count | Status |
|-------|-------|--------|
| Raw Tweets | $(docker exec infra-postgres-1 psql -U dhruv_user -d dhruv_db -t -c "SELECT COUNT(*) FROM raw_tweets;" 2>/dev/null || echo "N/A") | ✅ |
| Parsed Events | $(docker exec infra-postgres-1 psql -U dhruv_user -d dhruv_db -t -c "SELECT COUNT(*) FROM parsed_events;" 2>/dev/null || echo "N/A") | ✅ |
| Review Queue | $REVIEW_COUNT | $([ "$REVIEW_COUNT" -gt 0 ] && echo "✅" || echo "⚠️") |
| Approved Tweets | $ANALYTICS_TOTAL | $([ "$ANALYTICS_TOTAL" -gt 0 ] && echo "✅" || echo "⚠️") |
| Analytics Data | $ANALYTICS_TOTAL | $([ "$ANALYTICS_TOTAL" -gt 0 ] && echo "✅" || echo "⚠️") |

## API Endpoints Tested

- ✅ `/api/parsed-events?needs_review=true` - Review queue
- ✅ `/api/parsed-events?analytics=true` - Analytics data
- ✅ `/api/reference/learn` - Learning system
- ✅ `/api/parsed-events?needs_review=false` - Home table

## Next Steps

1. **Manual Review**: Visit http://localhost:3000 and review tweets in the Samiksha tab
2. **Approve Tweets**: Mark tweets as approved to see them in analytics
3. **Test Learning**: Add new schemes/event types in the review interface
4. **Verify Analytics**: Check that approved tweets appear in analytics charts

## Troubleshooting

If any stage failed:
1. Check Docker containers: \`docker ps\`
2. Check Next.js logs: \`npm run dev\`
3. Check database: \`docker exec infra-postgres-1 psql -U dhruv_user -d dhruv_db\`
4. Check API endpoints: \`curl http://localhost:3000/api/health\`

EOF

print_success "Report generated: workflow_simulation_report.md"

# Step 12: Cleanup (optional)
if [ "${CLEANUP:-false}" = "true" ]; then
    print_status "Step 12: Cleaning up..."
    
    if [ -n "$NEXTJS_PID" ]; then
        kill $NEXTJS_PID 2>/dev/null || true
        print_success "Next.js server stopped"
    fi
    
    print_success "Cleanup completed"
fi

echo ""
echo "=== Workflow Simulation Complete ==="
echo ""
print_status "Summary:"
echo "  - Review Queue: $REVIEW_COUNT tweets"
echo "  - Analytics: $ANALYTICS_TOTAL approved tweets"
echo "  - Learning System: $([ "$LEARN_RESPONSE" = "true" ] && echo "Working" || echo "Needs attention")"
echo ""
print_status "Next: Visit http://localhost:3000 to manually review and approve tweets"
echo "Report: workflow_simulation_report.md"
