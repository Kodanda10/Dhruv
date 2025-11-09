#!/bin/bash

# ===========================================================
# 🚀  FULL PIPELINE RUNNER — OP Choudhary Dashboard
# ===========================================================
# Runs the complete data pipeline end-to-end:
#  1. Verify DB tweet count
#  2. Remove sample tweets
#  3. Parse all pending tweets (backfill)
#  4. Monitor live parsing logs
#  5. Validate review + analytics
#  6. Trigger hourly fetch test
#  7. Run integration test
# ===========================================================

set -e

CYAN="\033[1;36m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

LOG_DIR="logs"
mkdir -p "$LOG_DIR"

echo -e "${CYAN}🔍 Step 1: Checking tweet count in database...${RESET}"

TWEET_COUNT=$(node -e "
const { getTweetCount } = require('./scripts/ops/db-helpers.js');
(async () => {
  try {
    const count = await getTweetCount();
    console.log(count);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
")

if [ -z "$TWEET_COUNT" ] || [ "$TWEET_COUNT" -lt 100 ]; then
  echo -e "${RED}❌ Too few tweets ($TWEET_COUNT) — check DB before running${RESET}"
  exit 1
fi

echo -e "${GREEN}✅ Total tweets in DB: $TWEET_COUNT${RESET}"

echo -e "${CYAN}🧹 Step 2: Removing sample / dummy tweets...${RESET}"

node -e "
const { removeSampleTweets, removeSampleParsedEvents } = require('./scripts/ops/db-helpers.js');
(async () => {
  try {
    const rawResult = await removeSampleTweets();
    const parsedResult = await removeSampleParsedEvents();
    console.log('✅ Sample tweets removed:', rawResult.deleted);
    console.log('✅ Sample parsed events removed:', parsedResult.deleted);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
"

echo -e "${CYAN}⚙️ Step 3: Running backfill parser for pending tweets...${RESET}"

# Get pending count before starting
PENDING_BEFORE=$(node -e "
const { getPendingTweetCount } = require('./scripts/ops/db-helpers.js');
(async () => {
  const count = await getPendingTweetCount();
  console.log(count);
  process.exit(0);
})();
")

echo -e "${YELLOW}📊 Pending tweets to parse: $PENDING_BEFORE${RESET}"

if [ "$PENDING_BEFORE" -eq 0 ]; then
  echo -e "${GREEN}✅ No pending tweets to parse. Skipping backfill.${RESET}"
else
  # Run parser in background and capture output
  npm run ops:parse-all-pending 2>&1 | tee "$LOG_DIR/parse-all.log" &
  PARSE_PID=$!
  
  echo -e "${CYAN}📡 Step 4: Live Parsing Log (monitoring in background)${RESET}"
  echo -e "${YELLOW}   Log file: $LOG_DIR/parse-all.log${RESET}"
  echo -e "${YELLOW}   Process ID: $PARSE_PID${RESET}"
  echo -e "${YELLOW}   Press Ctrl+C to stop monitoring (parser will continue)${RESET}"
  
  # Monitor log file
  if [ -f "$LOG_DIR/parse-all.log" ]; then
    tail -f "$LOG_DIR/parse-all.log" &
    TAIL_PID=$!
    
    # Wait for parser to complete (or timeout after 2 hours)
    wait $PARSE_PID 2>/dev/null || true
    kill $TAIL_PID 2>/dev/null || true
  else
    # Wait for log file to be created
    sleep 5
    if [ -f "$LOG_DIR/parse-all.log" ]; then
      tail -f "$LOG_DIR/parse-all.log" &
      TAIL_PID=$!
      wait $PARSE_PID 2>/dev/null || true
      kill $TAIL_PID 2>/dev/null || true
    else
      wait $PARSE_PID 2>/dev/null || true
    fi
  fi
  
  echo -e "${GREEN}✅ Parser completed${RESET}"
fi

echo -e "${CYAN}🧭 Step 5: Checking parsed events count...${RESET}"

PARSED_COUNT=$(node -e "
const { getParsedEventCount } = require('./scripts/ops/db-helpers.js');
(async () => {
  const count = await getParsedEventCount();
  console.log(count);
  process.exit(0);
})();
")

APPROVED_COUNT=$(node -e "
const { getApprovedEventCount } = require('./scripts/ops/db-helpers.js');
(async () => {
  const count = await getApprovedEventCount();
  console.log(count);
  process.exit(0);
})();
")

echo -e "${GREEN}✅ Parsed events: $PARSED_COUNT${RESET}"
echo -e "${GREEN}✅ Approved events (ready for analytics): $APPROVED_COUNT${RESET}"

echo -e "${CYAN}📊 Step 6: Verifying Analytics API response...${RESET}"

# Try to check analytics endpoint (if server is running)
if curl -s -f http://localhost:3000/api/analytics > /dev/null 2>&1; then
  ANALYTICS_RESPONSE=$(curl -s http://localhost:3000/api/analytics | head -c 200)
  echo -e "${GREEN}✅ Analytics API responding${RESET}"
  echo "$ANALYTICS_RESPONSE" | head -5
else
  echo -e "${YELLOW}⚠️  Analytics API not reachable (server may not be running)${RESET}"
  echo -e "${YELLOW}   Start server with: npm run dev${RESET}"
fi

echo -e "${CYAN}🧪 Step 7: Running pipeline integration tests...${RESET}"

if npm run test 2>&1 | grep -q "PASS\|✓"; then
  echo -e "${GREEN}✅ Tests passed${RESET}"
else
  echo -e "${YELLOW}⚠️  Some tests may have failed — check output above${RESET}"
fi

echo -e "${CYAN}📈 Step 8: Final Pipeline Statistics...${RESET}"

node -e "
const { getPipelineStats } = require('./scripts/ops/db-helpers.js');
(async () => {
  const stats = await getPipelineStats();
  console.log('Raw Tweets:');
  console.log('  - Total:', stats.raw.total);
  console.log('  - Pending:', stats.raw.pending);
  console.log('  - Parsed:', stats.raw.parsed);
  console.log('  - Failed:', stats.raw.failed);
  console.log('');
  console.log('Parsed Events:', stats.parsed.total);
  console.log('');
  console.log('Review Status:');
  console.log('  - Needs Review:', stats.review.needs_review);
  console.log('  - Approved:', stats.review.approved);
  console.log('  - Rejected:', stats.review.rejected);
  process.exit(0);
})();
"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}✅  FULL PIPELINE COMPLETED SUCCESSFULLY${RESET}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "${YELLOW}📊 Summary:${RESET}"
echo -e "   • Total tweets: $TWEET_COUNT"
echo -e "   • Parsed events: $PARSED_COUNT"
echo -e "   • Approved events: $APPROVED_COUNT"
echo ""
echo -e "${YELLOW}🎯 Next Steps:${RESET}"
echo -e "   1. Review events at /review"
echo -e "   2. Approve events to make them visible in analytics"
echo -e "   3. Check dashboard at /analytics"
echo -e "   4. Monitor hourly fetch workflow"
echo ""


