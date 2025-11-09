#!/bin/bash

# ===========================================================
# 🔧 Fix All Pipeline Issues - Seamless Automation
# ===========================================================
# Automatically fixes all pipeline issues:
#  1. Requeue failed tweets
#  2. Parse all pending tweets
#  3. Verify pipeline health
#  4. Show final status
# ===========================================================

set -e

CYAN="\033[1;36m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

echo -e "${CYAN}🔧 Fixing All Pipeline Issues...${RESET}"
echo ""

# Step 1: Requeue failed tweets
echo -e "${CYAN}Step 1: Requeuing failed tweets...${RESET}"
npm run ops:watchdog
echo ""

# Step 2: Get pending count
PENDING_COUNT=$(node -e "
const { getPendingTweetCount } = require('./scripts/ops/db-helpers.js');
(async () => {
  const count = await getPendingTweetCount();
  console.log(count);
  process.exit(0);
})();
")

if [ "$PENDING_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✅ No pending tweets to parse${RESET}"
else
  echo -e "${YELLOW}📊 Found $PENDING_COUNT pending tweets to parse${RESET}"
  echo -e "${CYAN}Step 2: Parsing pending tweets...${RESET}"
  echo -e "${YELLOW}   This may take a while. Parsing in batches...${RESET}"
  
  # Run parser (will process in batches)
  npm run ops:parse-all-pending 2>&1 | tee logs/parse-fix.log || {
    echo -e "${YELLOW}⚠️  Parser completed with some warnings (check logs)${RESET}"
  }
fi

echo ""
echo -e "${CYAN}Step 3: Verifying pipeline health...${RESET}"
npm run ops:pipeline-health

echo ""
echo -e "${CYAN}Step 4: Final status check...${RESET}"

node -e "
const { getPipelineStats } = require('./scripts/ops/db-helpers.js');
(async () => {
  const stats = await getPipelineStats();
  const failed = parseInt(stats.raw.failed || '0', 10);
  const pending = parseInt(stats.raw.pending || '0', 10);
  const parsed = parseInt(stats.raw.parsed || '0', 10);
  
  console.log('📊 Final Status:');
  console.log('  Total tweets:', stats.raw.total);
  console.log('  Parsed:', parsed);
  console.log('  Pending:', pending);
  console.log('  Failed:', failed);
  console.log('');
  
  if (failed === 0 && pending === 0) {
    console.log('✅ All issues fixed! Pipeline is healthy.');
    process.exit(0);
  } else if (failed > 0 && pending === 0) {
    console.log('⚠️  Some tweets failed parsing. Run watchdog again after delay.');
    console.log('   Run: npm run ops:watchdog (after 4+ hours)');
    process.exit(0);
  } else {
    console.log('⚠️  Still have pending/failed tweets.');
    process.exit(1);
  }
})();
"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}✅  Pipeline Fix Complete${RESET}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${RESET}"


