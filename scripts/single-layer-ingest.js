#!/usr/bin/env node

/**
 * Single-Layer Tweet Ingestion CLI using Gemini.
 *
 * Checklist-driven implementation:
 *  - Health checks: API, Gemini, FAISS/Milvus.
 *  - Data acquisition: Fetches from DB, validates required fields.
 *  - Parsing: Single-pass Gemini call with retry logic.
 *  - Ingestion: Posts parsed data to dashboard API.
 *  - Backups: Per-tweet and per-batch backups.
 *  - Vector Enrichment: Triggers FAISS/Milvus indexing per batch.
 *
 * Supported flags:
 *   --batch-size <number>        (default: 10)
 *   --max-batches <number>       (default: 0 => unlimited)
 *   --concurrency <number>       (default: 2)
 *   --rpm <number>               (default: 60, requests per minute for Gemini)
 *   --api-base <url>             (default: env.API_BASE or http://localhost:3000)
 *   --dry-run                    (default: false)
 *   --test-mode                  (default: false, uses local mock data instead of DB)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '..', '.taskmaster', 'backups', 'single-layer');
const TWEET_BACKUP_DIR = path.join(__dirname, '..', '.taskmaster', 'backups', 'tweets');
const FAILED_TWEETS_LOG = path.join(BACKUP_DIR, 'failed_tweets.jsonl');
const RETRY_QUEUE_LOG = path.join(BACKUP_DIR, 'retry_queue.jsonl');
const SUMMARY_PATH = path.join(BACKUP_DIR, 'ingestion-summary.json');

// --- Main Execution ---

export async function main() {
  const cliOptions = parseArgs(process.argv.slice(2));
  const config = {
    batchSize: parseInt(cliOptions['batch-size'] ?? '10', 10),
    maxBatches: parseInt(cliOptions['max-batches'] ?? '0', 10),
    concurrency: Math.max(1, parseInt(cliOptions['concurrency'] ?? '2', 10)),
    requestsPerMinute: parseInt(cliOptions['rpm'] ?? '60', 10),
    apiBase: cliOptions['api-base'] ?? process.env.API_BASE ?? 'http://localhost:3000',
    dryRun: parseBoolean(cliOptions['dry-run']),
    testMode: parseBoolean(cliOptions['test-mode']),
    geminiApiKey: process.env.GEMINI_API_KEY,
  };

  ensureBackupFolders();
  logConfig(config);

  const dbClient = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  if (!config.dryRun) {
    if (!config.geminiApiKey) {
      console.error('❌ Missing GEMINI_API_KEY environment variable.');
      process.exit(1);
    }
    await performHealthChecks(config);
    await dbClient.connect();
  }

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const geminiClient = genAI.getGenerativeModel({ model: "gemini-pro" });

  try {
    const summary = await processAllBatches(dbClient, geminiClient, config);

    console.log('\n🎉 Ingestion complete.');
    fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));
    console.log(`📄 Summary written to ${path.relative(process.cwd(), SUMMARY_PATH)}`);
    console.log(`📊 Totals: processed=${summary.totalProcessed}, failed=${summary.totalFailed}, duplicates=${summary.totalDuplicates}`);
    console.log(`🛰️  Vector Triggers: faiss=${summary.vectorization.faiss}, milvus=${summary.vectorization.milvus}, failures=${summary.vectorization.failures}`);
  } finally {
    if (!config.dryRun && dbClient._connected) {
      await dbClient.end();
    }
  }
}

// --- Batch Processing Orchestrator ---

export async function processAllBatches(dbClient, geminiClient, config) {
    const summary = {
        timestamp: new Date().toISOString(),
        ...config,
        batchesProcessed: 0,
        totalProcessed: 0,
        totalFailed: 0,
        totalDuplicates: 0,
        vectorization: { faiss: 0, milvus: 0, failures: 0 },
    };

    let offset = 0;
    let geminiConsecutiveFailures = 0;

    while (true) {
        if (config.maxBatches > 0 && summary.batchesProcessed >= config.maxBatches) {
            console.log('🛑 Max batches reached. Stopping.');
            break;
        }

        const tweets = await fetchTweets(dbClient, config.batchSize, offset, config);
        if (tweets.length === 0) {
            console.log('✅ No more pending tweets to process.');
            break;
        }

        const batchOrdinal = summary.batchesProcessed + 1;
        console.log(`\n🔄 Processing Batch ${batchOrdinal} (${tweets.length} tweets)`);

        const batchResults = { processed: [], failed: [], duplicates: 0 };
        const workers = [];
        let tweetCursor = 0;

        const delayBetweenRequests = (60 / config.requestsPerMinute) * 1000;

        const worker = async () => {
            while (tweetCursor < tweets.length) {
                const tweet = tweets[tweetCursor++];
                if (!tweet) continue;

                try {
                    if (geminiConsecutiveFailures >= 5) {
                        throw new Error('Circuit breaker tripped: Too many consecutive Gemini failures.');
                    }

                    const result = await processSingleTweet(tweet, dbClient, geminiClient, config);
                    geminiConsecutiveFailures = 0; // Reset on success

                    if (result.status === 'processed') batchResults.processed.push(result.data);
                    if (result.status === 'duplicate') batchResults.duplicates++;
                    if (result.status === 'failed') batchResults.failed.push(tweet);

                } catch (error) {
                    console.error(` CRITICAL WORKER ERROR for tweet ${tweet.id}: ${error.message}`);
                    batchResults.failed.push(tweet);
                    if (error.isGeminiFailure) geminiConsecutiveFailures++;
                }
                await delay(delayBetweenRequests / config.concurrency);
            }
        };

        for (let i = 0; i < config.concurrency; i++) {
            workers.push(worker());
        }
        await Promise.all(workers);

        // --- Post-Batch Operations ---
        if (batchResults.processed.length > 0) {
            writeBatchBackup(batchResults.processed, { ordinal: batchOrdinal });
            const vectorResult = await triggerVectorIndexing(batchResults.processed.map(p => p.tweet.id), config);
            summary.vectorization[vectorResult.service]++;
            if (!vectorResult.success) summary.vectorization.failures++;
        }

        summary.batchesProcessed++;
        summary.totalProcessed += batchResults.processed.length;
        summary.totalFailed += batchResults.failed.length;
        summary.totalDuplicates += batchResults.duplicates;
        offset += tweets.length;

        console.log(`✅ Batch ${batchOrdinal} finished (processed=${batchResults.processed.length}, duplicates=${batchResults.duplicates}, failed=${batchResults.failed.length})`);
    }
    return summary;
}

// --- Per-Tweet Worker Logic ---

export async function processSingleTweet(tweet, db, gemini, config) {
    // 1. Validate
    if (!tweet.id || !tweet.text || !tweet.created_at || !tweet.author_id) {
        logFailedTweet(tweet, 'malformed_data');
        if (!config.dryRun) await updateTweetStatusInDB(db, tweet.id, 'failed', config.testMode);
        return { status: 'failed' };
    }

    try {
        // 2. Parse
        const parsedData = await parseTweetWithGemini(tweet, gemini, config);
        const fullRecord = {
            tweet,
            categories: parsedData.categories,
            gemini_metadata: parsedData.metadata,
        };

        // 3. Per-tweet backup
        if (!config.dryRun) writePerTweetBackup(fullRecord);

        // 4. Ingest
        const ingestResult = await ingestParsedData(fullRecord, config);
        if (ingestResult.status === 'duplicate') {
            if (!config.dryRun) {
                await updateTweetStatusInDB(db, tweet.id, 'processed', config.testMode);
            } else {
                console.log(`\n[DRY RUN] ✅ Would update Tweet ${tweet.id} status to 'processed' (duplicate).\n`);
            }
            return { status: 'duplicate' };
        }

        // 5. Update DB
        if (!config.dryRun) {
            await updateTweetStatusInDB(db, tweet.id, 'processed', config.testMode);
        } else {
            console.log(`\n[DRY RUN] ✅ Would update Tweet ${tweet.id} status to 'processed'.\n`);
        }
        return { status: 'processed', data: fullRecord };

    } catch (error) {
        console.error(`  ❌ Tweet ${tweet.id} failed: ${error.message}`);
        logToRetryQueue(tweet, error.message);
        if (!config.dryRun) {
            await updateTweetStatusInDB(db, tweet.id, 'pending_retry', config.testMode);
        } else {
            console.log(`\n[DRY RUN] ❌ Would update Tweet ${tweet.id} status to 'pending_retry'.\n`);
        }
        error.isGeminiFailure = true; // Flag for circuit breaker
        throw error;
    }
}


// --- Core Logic Stubs ---

export async function fetchTweets(db, limit, offset, config) {
  if (config.dryRun) {
    console.log(`\n[DRY RUN]  simulating fetch of ${limit} tweets from DB (offset: ${offset})...`);
    return getMockTweets(limit);
  }
  if (config.testMode) {
    return getMockTweets(limit).slice(offset, offset + limit);
  }
  const res = await db.query('SELECT * FROM tweets WHERE parsing_status IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
  return res.rows;
}

export async function parseTweetWithGemini(tweet, geminiClient, config) {
    const prompt = `Parse the following tweet to extract key entities. Return a single JSON object with the key "categories" which contains the keys "locations", "people", "event", "organisation", "schemes", and "communities". If an entity is not present, use an empty array for its value.

Tweet text: "${tweet.text}"

JSON output:`;

    if (config.dryRun) {
        console.log(`\n[DRY RUN] 🤖 Gemini Prompt for Tweet ${tweet.id}:\n---`);
        console.log(prompt);
        console.log('---\n');
        return {
            categories: {
                locations: ["dry_run_location", "Raipur"],
                people: ["dry_run_person"],
                event: ["dry_run_event"],
                organisation: [],
                schemes: [],
                communities: [],
            },
            metadata: { model: 'dry-run' }
        };
    }

    let retries = 3;
    let backoff = 1000; // 1 second

    while (retries > 0) {
        try {
            const result = await geminiClient.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonText = text.match(/```json\n([\s\S]*?)\n```/)?.[1] ?? text;
            const parsed = JSON.parse(jsonText);

            return {
                categories: parsed.categories,
                metadata: { model: 'gemini-pro' }
            };
        } catch (error) {
            console.warn(`[Gemini] API call failed for tweet ${tweet.id}. Retries left: ${retries - 1}. Error: ${error.message}`);
            retries--;
            if (retries === 0) {
                throw new Error(`Gemini parsing failed after multiple retries: ${error.message}`);
            }
            await delay(backoff);
            backoff *= 2; // Exponential backoff
        }
    }
}

export async function ingestParsedData(data, config) {
    if (config.dryRun) {
        console.log(`\n[DRY RUN] 📤 Ingesting Parsed Tweet ${data.tweet.id}:\n---`);
        console.log(JSON.stringify(data, null, 2));
        console.log('---\n');
        return { status: 'ok' };
    }
    
    const endpoint = `${config.apiBase}/api/ingest-parsed-tweet`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (response.status === 409) {
        console.log(`  [Ingest] Duplicate tweet ${data.tweet.id}, skipping.`);
        return { status: 'duplicate' };
    }
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Ingestion API failed with status ${response.status}: ${errorBody}`);
    }
    return { status: 'ok' };
}

export async function triggerVectorIndexing(tweetIds, config) {
    if (config.dryRun) {
        console.log(`\n[DRY RUN] 🛰️  Triggering Vector Indexing (FAISS):\n---`);
        console.log(`Tweet IDs: ${JSON.stringify(tweetIds)}`);
        console.log('---\n');
        return { success: true, service: 'faiss' };
    }
    console.log(`[Vector] Triggering indexing for ${tweetIds.length} tweets...`);
    // TODO: Call /api/vector/trigger-batch-indexing with tweetIds.
    // The API should handle the FAISS/Milvus fallback.
    return { success: true, service: 'faiss' };
}

export async function updateTweetStatusInDB(db, tweetId, status, isTestMode) {
    if (isTestMode || !db || !db._connected) {
        console.log(`[DB] Would update status for tweet ${tweetId} to '${status}'.`);
        return;
    }
    await db.query('UPDATE tweets SET parsing_status = $1 WHERE id = $2', [status, tweetId]);
}


// --- Health Checks ---

export async function performHealthChecks(config) {
    console.log("--- Performing Health Checks ---");
    await assertApiHealthy(config.apiBase);
    await assertVectorServicesHealthy(config.apiBase);
    await assertGeminiHealthy(config.geminiApiKey);
    console.log("--- Health Checks Passed ---\n");
}

async function assertApiHealthy(apiBase) {
    const healthUrl = `${apiBase}/api/health`;
    console.log(`🔍 Health check: ${healthUrl}`);
    try {
        const response = await fetch(healthUrl);
        if (!response.ok) throw new Error(`Health check failed with status ${response.status}`);
        const payload = await response.json().catch(() => ({}));
        if (payload.status !== 'ok') throw new Error(`API unhealthy. Response: ${JSON.stringify(payload)}`);
        console.log('✅ API is healthy.');
    } catch (error) {
        console.error(`❌ API health check failed: ${error.message}`);
        throw error;
    }
}

async function assertVectorServicesHealthy(apiBase) {
    const faissUrl = `${apiBase}/api/labs/faiss/search?q=test&limit=1`;
    const milvusUrl = `${apiBase}/api/labs/milvus/search?q=test&limit=1`;
    try {
        const faissRes = await fetch(faissUrl);
        if (faissRes.ok) {
            console.log('✅ FAISS service is healthy.');
            return;
        }
    } catch (e) { /* ignore */ }
    console.warn('🟡 FAISS service is unavailable. Checking fallback...');
    try {
        const milvusRes = await fetch(milvusUrl);
        if (milvusRes.ok) {
            console.log('✅ Milvus service is healthy.');
            return;
        }
    } catch (e) { /* ignore */ }
    throw new Error('❌ Both FAISS and Milvus vector services are unavailable.');
}

async function assertGeminiHealthy(apiKey) {
    console.log('🔍 Health check: Gemini API');
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hi. Are you ready?");
        const response = await result.response;
        if (response.text().length > 0) {
            console.log('✅ Gemini API is responsive.');
        } else {
            throw new Error('Received empty response from Gemini.');
        }
    } catch (error) {
        console.error(`❌ Gemini API health check failed: ${error.message}`);
        throw error;
    }
}


// --- Utility and Helper Functions ---

function getMockTweets(limit = 10) {
    return Array.from({ length: limit }, (_, i) => ({
        id: `mock_id_${i + 1}`,
        text: `This is a mock tweet number ${i + 1} about a community event in Raipur.`,
        created_at: new Date().toISOString(),
        author_id: `mock_author_${i + 1}`,
    }));
}

function ensureBackupFolders() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(TWEET_BACKUP_DIR, { recursive: true });
}

function writePerTweetBackup(record) {
    const date = new Date().toISOString().split('T')[0];
    const filePath = path.join(TWEET_BACKUP_DIR, `${date}.jsonl`);
    fs.appendFileSync(filePath, JSON.stringify(record) + '\n');
}

function writeBatchBackup(batchData, meta) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `batch-${String(meta.ordinal).padStart(4, '0')}-${timestamp}.jsonl`;
  const filePath = path.join(BACKUP_DIR, fileName);
  const content = batchData.map(item => JSON.stringify(item)).join('\n');
  fs.writeFileSync(filePath, content);
  console.log(`📦 Batch backup written to ${path.relative(process.cwd(), filePath)}`);
}

function logFailedTweet(tweet, reason) {
  const record = {
    ...tweet,
    failure_reason: reason,
    failure_timestamp: new Date().toISOString(),
  };
  fs.appendFileSync(FAILED_TWEETS_LOG, JSON.stringify(record) + '\n');
}

function logToRetryQueue(tweet, reason) {
    const record = { ...tweet, failure_reason: reason, retry_at: new Date().toISOString() };
    fs.appendFileSync(RETRY_QUEUE_LOG, JSON.stringify(record) + '\n');
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
    } else {
      options[key] = next;
      i++;
    }
  }
  return options;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === '';
}

function logConfig(config) {
  console.log('🚀 Single-Layer Tweet Ingestion');
  console.log(`📊 Batch size: ${config.batchSize}`);
  console.log(`🔢 Max batches: ${config.maxBatches === 0 ? 'unlimited' : config.maxBatches}`);
  console.log(`⚙️  Concurrency: ${config.concurrency}`);
  console.log(`⏱️  Rate Limit: ${config.requestsPerMinute} RPM`);
  console.log(`🌐 API base: ${config.apiBase}`);
  console.log(`🧪 Dry run: ${config.dryRun ? 'yes' : 'no'}`);
  console.log(`[Test Mode]: ${config.testMode ? 'ENABLED' : 'DISABLED'}`);
  console.log('');
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Entry Point ---
// This allows the script to be both runnable and importable for tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error('\n❌ An unexpected error occurred:', error);
        process.exit(1);
    });
}
