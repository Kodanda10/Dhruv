#!/usr/bin/env node

/**
 * Bulk Tweet Ingestion Script
 *
 * Processes tweets in batches for bulk ingestion into the review system.
 * All tweets are sent to manual review regardless of parsing consensus.
 *
 * Usage:
 *   node scripts/bulk-ingest-tweets.js --batch-size 50 --max-batches 10 --skip-processed true
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const value = args[i + 1];
    options[key] = value;
    i++; // Skip next arg as it's the value
  }
}

const batchSize = parseInt(options['batch-size'] || '50');
const maxBatches = parseInt(options['max-batches'] || '0'); // 0 = unlimited
const skipProcessed = options['skip-processed'] !== 'false';

const FAILED_TWEETS_LOG = path.join(__dirname, '..', 'failed_tweets.jsonl');

console.log('🚀 Starting Bulk Tweet Ingestion');
console.log(`📊 Batch Size: ${batchSize}`);
console.log(`🔢 Max Batches: ${maxBatches === 0 ? 'unlimited' : maxBatches}`);
console.log(`⏭️  Skip Processed: ${skipProcessed}`);
console.log('');

// Check if data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  console.error('❌ Data directory not found:', dataDir);
  process.exit(1);
}

// Find tweet data files
const tweetFiles = fs.readdirSync(dataDir)
  .filter(file => (file.startsWith('parsed_tweets') || file.startsWith('parsed_events')) && file.includes('.json'))
  .sort();

if (tweetFiles.length === 0) {
  console.error('❌ No parsed tweet files found in data directory');
  process.exit(1);
}

console.log(`📁 Found ${tweetFiles.length} tweet data files:`);
tweetFiles.forEach(file => console.log(`  - ${file}`));
console.log('');

// Process each file
let totalProcessed = 0;
let totalSkipped = 0;
let totalFailed = 0;
let totalDuplicates = 0;
let batchesProcessed = 0;

for (const file of tweetFiles) {
  const filePath = path.join(dataDir, file);
  console.log(`📖 Processing file: ${file}`);

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let tweets;

    if (file.endsWith('.jsonl')) {
      tweets = fileContent.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));
    } else {
      const data = JSON.parse(fileContent);
      tweets = data.tweets || data;
    }

    if (!Array.isArray(tweets)) {
      console.error(`❌ Invalid tweet data format in ${file}`);
      continue;
    }

    console.log(`📊 Found ${tweets.length} tweets in ${file}`);

    // Process tweets in batches
    for (let i = 0; i < tweets.length; i += batchSize) {
      if (maxBatches > 0 && batchesProcessed >= maxBatches) {
        console.log(`🛑 Reached maximum batch limit (${maxBatches})`);
        break;
      }

      const batch = tweets.slice(i, i + batchSize);
      const batchNumber = batchesProcessed + 1;
      console.log(`🔄 Processing batch ${batchNumber} (tweets ${i + 1}-${Math.min(i + batchSize, tweets.length)} of ${tweets.length})`);

      // Process batch
      const results = await processBatch(batch, skipProcessed);

      totalProcessed += results.processed;
      totalSkipped += results.skipped;
      totalFailed += results.failed;
      totalDuplicates += results.duplicates;
      batchesProcessed++;

      console.log(`✅ Batch ${batchNumber} complete: ${results.processed} processed, ${results.skipped} skipped, ${results.failed} failed, ${results.duplicates} duplicates`);

      // Rate limiting pause
      if (i + batchSize < tweets.length) {
        console.log('⏳ Pausing for rate limiting...');
        await sleep(2000); // 2 second pause between batches
      }
    }

  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }

  // Check if we've hit the batch limit
  if (maxBatches > 0 && batchesProcessed >= maxBatches) {
    break;
  }
}

// Generate summary report
const summary = {
  timestamp: new Date().toISOString(),
  batchSize,
  maxBatches: maxBatches === 0 ? 'unlimited' : maxBatches,
  skipProcessed,
  totalProcessed,
  totalSkipped,
  totalFailed,
  totalDuplicates,
  batchesProcessed,
  filesProcessed: tweetFiles.length,
  retryQueueSize: totalFailed // Tweets added to retry queue
};

const summaryPath = path.join(__dirname, '..', 'bulk-ingestion-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log('\n🎉 Bulk ingestion complete!');
console.log(`📊 Summary:`);
console.log(`  - Files processed: ${tweetFiles.length}`);
console.log(`  - Batches processed: ${batchesProcessed}`);
console.log(`  - Tweets processed: ${totalProcessed}`);
console.log(`  - Tweets skipped: ${totalSkipped}`);
console.log(`  - Tweets failed: ${totalFailed}`);
console.log(`  - Tweets re-queued: ${totalFailed}`);
console.log(`  - Duplicates prevented: ${totalDuplicates}`);
console.log(`📄 Summary saved to: ${summaryPath}`);
if (totalFailed > 0) {
  console.log(`🔴 ${totalFailed} failed tweets logged to: ${FAILED_TWEETS_LOG}`);
  console.log(`🔄 ${totalFailed} tweets re-queued to: data/retry_tweets.jsonl`);
}
if (totalDuplicates > 0) {
  console.log(`🚫 ${totalDuplicates} duplicate tweets were prevented from ingestion`);
}

async function processBatch(tweets, skipProcessed) {
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let duplicates = 0;

  for (const tweet of tweets) {
    try {
      const tweetId = tweet.id || tweet.tweet_id;

      // Check for duplicates first
      const duplicateCheck = await checkForDuplicates(tweetId);
      if (duplicateCheck.isDuplicate) {
        duplicates++;
        console.log(`  ⏭️ Skipped duplicate tweet ${tweetId} (${duplicateCheck.reason})`);
        continue;
      }

      // Check if tweet was already processed (if skipProcessed is enabled)
      if (skipProcessed && await isTweetProcessed(tweetId)) {
        skipped++;
        continue;
      }

      // Process tweet through parsing pipeline
      const result = await processTweet(tweet);
      if (result) {
        if (result.duplicate) {
          duplicates++;
          console.log(`  🚫 Duplicate tweet ${tweetId} detected by API - skipping`);
        } else {
          processed++;
        }
      } else {
        failed++;
        fs.appendFileSync(FAILED_TWEETS_LOG, JSON.stringify(tweet) + '\n');
      }

    } catch (error) {
      console.error(`❌ Error processing tweet ${tweet.id || tweet.tweet_id}:`, error.message);
      failed++;
      fs.appendFileSync(FAILED_TWEETS_LOG, JSON.stringify(tweet) + '\n');
      // Continue with next tweet
    }
  }

  return { processed, skipped, failed, duplicates };
}

async function checkForDuplicates(tweetId) {
  // Check if tweet already exists in raw_tweets or parsed_events tables
  const apiUrl = process.env.API_BASE || 'http://localhost:3000';

  try {
    // Check raw_tweets table
    const rawTweetsResponse = await fetch(`${apiUrl}/api/tweets/check-duplicate?tweet_id=${encodeURIComponent(tweetId)}`);
    if (rawTweetsResponse.ok) {
      const rawTweetsResult = await rawTweetsResponse.json();
      if (rawTweetsResult.exists) {
        return { isDuplicate: true, reason: 'already in raw_tweets' };
      }
    }

    // Check parsed_events table
    const parsedEventsResponse = await fetch(`${apiUrl}/api/parsed-events/check-duplicate?tweet_id=${encodeURIComponent(tweetId)}`);
    if (parsedEventsResponse.ok) {
      const parsedEventsResult = await parsedEventsResponse.json();
      if (parsedEventsResult.exists) {
        return { isDuplicate: true, reason: 'already in parsed_events' };
      }
    }

    return { isDuplicate: false };
  } catch (error) {
    console.warn(`⚠️ Could not check duplicates for tweet ${tweetId}:`, error.message);
    // If we can't check, assume it's not a duplicate to be safe
    return { isDuplicate: false };
  }
}

async function processTweet(tweet) {
  // Call the three-layer consensus parsing API
  const apiUrl = process.env.API_BASE || 'http://localhost:3000';
  const endpoint = `${apiUrl}/api/parsing/three-layer-consensus`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tweet_id: tweet.id || tweet.tweet_id,
        tweet_text: tweet.content || tweet.text,
        created_at: tweet.timestamp || tweet.created_at,
        author_handle: tweet.author_handle || tweet.user?.screen_name,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Handle duplicate detection at API level
      if (response.status === 409 && errorData.duplicate) {
        console.log(`  🚫 API detected duplicate tweet ${tweet.id || tweet.tweet_id} - skipping`);
        // Return a special result indicating duplicate
        return { duplicate: true, tweet_id: tweet.id || tweet.tweet_id };
      }

      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log(`  ✅ Processed tweet ${tweet.id || tweet.tweet_id}: "${(tweet.content || tweet.text)?.substring(0, 50)}..."`);
      return result;
    } else {
      throw new Error(`Parsing failed: ${result.error || 'Unknown API error'}`);
    }
  } catch (error) {
    console.error(`  ❌ Error in processTweet for ${tweet.id || tweet.tweet_id}:`, error.message);

    // Extract specific failure reason from error message
    let failureReason = 'unknown_error';
    if (error.message.includes('PARSING_FAILED:')) {
      const match = error.message.match(/PARSING_FAILED:\s*(.+)/);
      if (match) {
        failureReason = match[1].split(';')[0].trim(); // Take first error code
      }
    } else if (error.message.includes('API call failed')) {
      failureReason = 'api_error';
    }

    // Log failed tweet with reason code
    const failedTweetData = {
      ...tweet,
      failure_reason: failureReason,
      failure_timestamp: new Date().toISOString(),
      error_message: error.message
    };

    fs.appendFileSync(FAILED_TWEETS_LOG, JSON.stringify(failedTweetData) + '\n');

    // Re-queue the tweet for later retry (append to a retry file)
    const retryFile = path.join(__dirname, '..', 'data', 'retry_tweets.jsonl');
    fs.appendFileSync(retryFile, JSON.stringify({
      ...tweet,
      retry_count: (tweet.retry_count || 0) + 1,
      last_failure: failureReason,
      queued_at: new Date().toISOString()
    }) + '\n');

    return null; // Return null on failure
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}