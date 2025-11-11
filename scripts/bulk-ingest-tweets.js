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
  .filter(file => file.startsWith('parsed_tweets') && file.endsWith('.json'))
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
let batchesProcessed = 0;

for (const file of tweetFiles) {
  const filePath = path.join(dataDir, file);
  console.log(`📖 Processing file: ${file}`);

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const tweets = data.tweets || data;

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
      console.log(`🔄 Processing batch ${batchesProcessed + 1} (tweets ${i + 1}-${Math.min(i + batchSize, tweets.length)})`);

      // Process batch
      const results = await processBatch(batch, skipProcessed);

      totalProcessed += results.processed;
      totalSkipped += results.skipped;
      batchesProcessed++;

      console.log(`✅ Batch ${batchesProcessed} complete: ${results.processed} processed, ${results.skipped} skipped`);

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
  batchesProcessed,
  filesProcessed: tweetFiles.length
};

const summaryPath = path.join(__dirname, '..', 'bulk-ingestion-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log('\n🎉 Bulk ingestion complete!');
console.log(`📊 Summary:`);
console.log(`  - Files processed: ${tweetFiles.length}`);
console.log(`  - Batches processed: ${batchesProcessed}`);
console.log(`  - Tweets processed: ${totalProcessed}`);
console.log(`  - Tweets skipped: ${totalSkipped}`);
console.log(`📄 Summary saved to: ${summaryPath}`);

async function processBatch(tweets, skipProcessed) {
  let processed = 0;
  let skipped = 0;

  for (const tweet of tweets) {
    try {
      // Check if tweet was already processed (if skipProcessed is enabled)
      if (skipProcessed && await isTweetProcessed(tweet.id)) {
        skipped++;
        continue;
      }

      // Process tweet through parsing pipeline
      await processTweet(tweet);
      processed++;

    } catch (error) {
      console.error(`❌ Error processing tweet ${tweet.id}:`, error.message);
      // Continue with next tweet
    }
  }

  return { processed, skipped };
}

async function isTweetProcessed(tweetId) {
  // This would check the database to see if the tweet has already been processed
  // For now, we'll assume all tweets need processing
  return false;
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
        tweet_text: tweet.text,
        created_at: tweet.created_at,
        author_handle: tweet.author_handle || tweet.user?.screen_name,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log(`  ✅ Processed tweet ${tweet.id || tweet.tweet_id}: "${tweet.text?.substring(0, 50)}..."`);
      return result;
    } else {
      throw new Error(`Parsing failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`  ❌ Error processing tweet ${tweet.id || tweet.tweet_id}:`, error.message);
    throw error;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}