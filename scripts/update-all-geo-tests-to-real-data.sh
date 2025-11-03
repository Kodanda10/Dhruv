#!/bin/bash
# Update all geo-analytics test files to use real data from parsed_tweets.json

# Pattern to replace createTestData functions
REPLACE_PATTERN='
async function createTestData(pool: Pool): Promise<void> {
  const { setupRealTestData } = await import("./geo-analytics-real-data-loader");
  await setupRealTestData(pool, 50);
}
'

# Pattern to replace createComprehensiveTestData
REPLACE_COMPREHENSIVE='
async function createComprehensiveTestData(pool: Pool) {
  const { setupRealTestData } = await import("./geo-analytics-real-data-loader");
  await setupRealTestData(pool, 100);
  console.log("✅ Real test data loaded from parsed_tweets.json");
}
'

echo "Updating test files to use real data from parsed_tweets.json..."



