#!/usr/bin/env node

/**
 * Fixture-aware bulk ingestion CLI with FAISS/Milvus validation hooks.
 *
 * Features:
 *  - Health checks before hitting ingestion APIs (skip with --skip-health-check)
 *  - Dry-run mode for fixtures (no API writes, still exercises batching)
 *  - Concurrency limiting so FAISS/Gemini/Ollama usage stays predictable
 *  - .taskmaster/backups snapshots for every batch + failure log
 *
 * Supported flags:
 *   --batch-size <number>        (default: 25)
 *   --max-batches <number>       (default: 0 => unlimited)
 *   --concurrency <number>       (default: 4)
 *   --api-base <url>             (default: env.API_BASE or http://localhost:3000)
 *   --source-file <path>         (default: autodetect parsed_tweets*.json in data/)
 *   --dry-run                    (default: false)
 *   --skip-health-check          (default: false)
 *   --skip-processed             (default: true; relies on duplicate API)
 *   --allow-vector-failures      (default: false; skip FAISS/Milvus health guardrail)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '..', '.taskmaster', 'backups');
const FAILED_TWEETS_LOG = path.join(BACKUP_DIR, 'failed_tweets.jsonl');
const SUMMARY_PATH = path.join(BACKUP_DIR, 'bulk-ingestion-summary.json');
const RETRY_QUEUE_PATH = path.join(__dirname, '..', 'data', 'retry_tweets.jsonl');

const cliOptions = parseArgs(process.argv.slice(2));
const config = {
  batchSize: parseInt(cliOptions['batch-size'] ?? '25', 10),
  maxBatches: parseInt(cliOptions['max-batches'] ?? '0', 10),
  concurrency: Math.max(1, parseInt(cliOptions['concurrency'] ?? '4', 10)),
  apiBase: cliOptions['api-base'] ?? process.env.API_BASE ?? 'http://localhost:3000',
  sourceFile: cliOptions['source-file'],
  dryRun: parseBoolean(cliOptions['dry-run']),
  skipHealthCheck: parseBoolean(cliOptions['skip-health-check']),
  skipProcessed: parseBoolean(cliOptions['skip-processed'], true),
  allowVectorFailures: parseBoolean(cliOptions['allow-vector-failures']),
};

run()
  .catch(error => {
    console.error('❌ Bulk ingestion failed:', error.message);
    process.exit(1);
  });

async function run() {
  ensureBackupFolder();
  logConfig();

  if (!config.skipHealthCheck && !config.dryRun) {
    await assertServicesHealthy(config.apiBase);
  }

  if (!config.allowVectorFailures) {
    await assertVectorSearchHealthy(config.apiBase);
  }

  const sourceFiles = resolveSourceFiles(config.sourceFile);
  if (sourceFiles.length === 0) {
    console.error('❌ No parsed tweet fixtures found. Provide --source-file or add files to data/.');
    process.exit(1);
  }

  const summary = {
    timestamp: new Date().toISOString(),
    ...config,
    batchesProcessed: 0,
    totalProcessed: 0,
    totalSkipped: 0,
    totalFailed: 0,
    totalDuplicates: 0,
    filesProcessed: 0,
  };

  for (const filePath of sourceFiles) {
    const tweets = loadTweetFile(filePath);
    if (tweets.length === 0) continue;

    summary.filesProcessed += 1;
    console.log(`\n📁 Source: ${path.relative(process.cwd(), filePath)} (${tweets.length} tweets)`);

    for (const batch of chunk(tweets, config.batchSize)) {
      if (config.maxBatches > 0 && summary.batchesProcessed >= config.maxBatches) {
        console.log('🛑 Max batches reached. Stopping early.');
        break;
      }

      const ordinal = summary.batchesProcessed + 1;
      console.log(`\n🔄 Batch ${ordinal} (${batch.length} tweets)`);
      writeBatchBackup(batch, { ordinal, source: filePath });

      const results = await processBatch(batch, { ...config, source: filePath });
      summary.totalProcessed += results.processed;
      summary.totalSkipped += results.skipped;
      summary.totalFailed += results.failed;
      summary.totalDuplicates += results.duplicates;
      summary.batchesProcessed += 1;

      console.log(`✅ Batch ${ordinal} finished (processed=${results.processed}, duplicates=${results.duplicates}, skipped=${results.skipped}, failed=${results.failed})`);

      if (config.maxBatches > 0 && summary.batchesProcessed >= config.maxBatches) {
        break;
      }
    }
  }

  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2));
  console.log('\n🎉 Bulk ingestion complete.');
  console.log(`📄 Summary written to ${path.relative(process.cwd(), SUMMARY_PATH)}`);
  console.log(`📊 Totals: processed=${summary.totalProcessed}, duplicates=${summary.totalDuplicates}, skipped=${summary.totalSkipped}, failed=${summary.totalFailed}`);
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

function ensureBackupFolder() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function logConfig() {
  console.log('🚀 Bulk Tweet Ingestion');
  console.log(`📊 Batch size: ${config.batchSize}`);
  console.log(`🔢 Max batches: ${config.maxBatches === 0 ? 'unlimited' : config.maxBatches}`);
  console.log(`⚙️  Concurrency: ${config.concurrency}`);
  console.log(`🌐 API base: ${config.apiBase}`);
  console.log(`🧪 Dry run: ${config.dryRun ? 'yes' : 'no'}`);
  console.log(`🩺 Health check: ${config.skipHealthCheck ? 'skipped' : 'enabled'}`);
  console.log(`🛰️  Vector guardrail: ${config.allowVectorFailures ? 'disabled' : 'enabled'}`);
  if (config.sourceFile) {
    console.log(`📦 Source file: ${config.sourceFile}`);
  }
  console.log('');
}

async function assertServicesHealthy(apiBase) {
  const healthUrl = `${apiBase.replace(/\/$/, '')}/api/health`;
  console.log(`🔍 Health check: ${healthUrl}`);
  const response = await fetch(healthUrl);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  const payload = await response.json().catch(() => ({}));
  if (payload.status !== 'ok') {
    throw new Error(`Health check responded with payload: ${JSON.stringify(payload)}`);
  }
  console.log('✅ API health verified.');
}

async function assertVectorSearchHealthy(apiBase) {
  const base = apiBase.replace(/\/$/, '');
  const probe = encodeURIComponent('रायपुर');
  const url = `${base}/api/labs/faiss/search?q=${probe}&limit=1`;

  console.log(`🛰️  Vector health check: ${url}`);
  try {
    const response = await fetch(url);
    const payload = await response.json().catch(() => undefined);

    if (!response.ok) {
      const detail = typeof payload === 'object' && payload ? payload.error : response.statusText;
      throw new Error(detail || `FAISS endpoint returned ${response.status}`);
    }

    if (payload && typeof payload === 'object' && 'error' in payload) {
      throw new Error(String(payload.error));
    }

    console.log('✅ FAISS search endpoint responded successfully.');
  } catch (error) {
    console.error('❌ Vector search dependency failed. Install Python deps via `pip install -r requirements.txt` and run `npm run labs:faiss:build`.');
    throw error;
  }
}

function resolveSourceFiles(explicitPath) {
  if (explicitPath) {
    const absolute = path.resolve(explicitPath);
    if (!fs.existsSync(absolute)) {
      console.error(`❌ Provided source file not found: ${explicitPath}`);
      process.exit(1);
    }
    return [absolute];
  }

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) return [];

  return fs
    .readdirSync(dataDir)
    .filter(name => (name.startsWith('parsed_tweets') || name.startsWith('parsed_events')) && (name.endsWith('.json') || name.endsWith('.jsonl')))
    .sort()
    .map(name => path.join(dataDir, name));
}

function loadTweetFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.jsonl')) {
    return raw
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line));
  }

  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : Array.isArray(data.tweets) ? data.tweets : [];
}

function* chunk(items, size) {
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}

function writeBatchBackup(batch, meta) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `batch-${String(meta.ordinal).padStart(4, '0')}-${timestamp}.json`;
  const payload = {
    meta,
    createdAt: new Date().toISOString(),
    count: batch.length,
    tweets: batch,
  };
  fs.writeFileSync(path.join(BACKUP_DIR, fileName), JSON.stringify(payload, null, 2));
}

async function processBatch(batch, runtimeConfig) {
  const stats = { processed: 0, skipped: 0, failed: 0, duplicates: 0 };
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= batch.length) break;

      const tweet = batch[index];
      const tweetId = tweet.id || tweet.tweet_id || `unknown-${index}`;

      try {
        const result = await ingestTweet(tweet, runtimeConfig);

        switch (result.status) {
          case 'processed':
            stats.processed += 1;
            break;
          case 'duplicate':
            stats.duplicates += 1;
            break;
          case 'skipped':
            stats.skipped += 1;
            break;
          case 'failed':
          default:
            stats.failed += 1;
            logFailedTweet(tweet, result.reason);
            break;
        }
      } catch (error) {
        stats.failed += 1;
        logFailedTweet(tweet, error.message);
        console.error(`❌ Tweet ${tweetId} failed: ${error.message}`);
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(runtimeConfig.concurrency, batch.length) },
    () => worker()
  );
  await Promise.all(workers);

  return stats;
}

async function ingestTweet(tweet, runtimeConfig) {
  const tweetId = tweet.id || tweet.tweet_id;
  if (!tweetId) {
    return { status: 'failed', reason: 'missing_tweet_id' };
  }

  if (runtimeConfig.dryRun) {
    console.log(`  🧪 Dry run accepted tweet ${tweetId}`);
    return { status: 'processed' };
  }

  const duplicateCheck = await checkForDuplicates(tweetId, runtimeConfig.apiBase);
  if (duplicateCheck.isDuplicate) {
    console.log(`  ⏭️  Duplicate ${tweetId} (${duplicateCheck.reason})`);
    return { status: 'duplicate', reason: duplicateCheck.reason };
  }

  const apiResult = await callParsingApi(tweet, runtimeConfig.apiBase);
  if (!apiResult) {
    return { status: 'failed', reason: 'api_error' };
  }

  if (apiResult.duplicate) {
    return { status: 'duplicate', reason: 'api_conflict' };
  }

  return { status: 'processed' };
}

async function checkForDuplicates(tweetId, apiBase) {
  const base = apiBase.replace(/\/$/, '');
  const endpoints = [
    `${base}/api/tweets/check-duplicate?tweet_id=${encodeURIComponent(tweetId)}`,
    `${base}/api/parsed-events/check-duplicate?tweet_id=${encodeURIComponent(tweetId)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;
      const payload = await response.json();
      if (payload.exists) {
        return { isDuplicate: true, reason: endpoint.includes('tweets') ? 'raw_tweets' : 'parsed_events' };
      }
    } catch (error) {
      console.warn(`⚠️  Duplicate check error for ${tweetId}: ${error.message}`);
    }
  }

  return { isDuplicate: false };
}

async function callParsingApi(tweet, apiBase) {
  const endpoint = `${apiBase.replace(/\/$/, '')}/api/parsing/three-layer-consensus`;
  const payload = {
    tweet_id: tweet.id || tweet.tweet_id,
    tweet_text: tweet.content || tweet.text,
    created_at: tweet.timestamp || tweet.created_at,
    author_handle: tweet.author_handle || tweet.user?.screen_name,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    const conflict = await response.json().catch(() => ({}));
    return { duplicate: true, ...conflict };
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logFailedTweet({ ...tweet, payload }, errorData.error || response.statusText);
    queueRetry(tweet, errorData.error || 'api_error');
    return null;
  }

  const result = await response.json();
  if (result.success === false) {
    logFailedTweet({ ...tweet, payload }, result.error || 'parser_error');
    queueRetry(tweet, result.error || 'parser_error');
    return null;
  }

  console.log(`  ✅ Parsed ${payload.tweet_id}: ${(payload.tweet_text || '').slice(0, 50)}…`);
  return result;
}

function logFailedTweet(tweet, reason) {
  const record = {
    ...tweet,
    failure_reason: reason,
    failure_timestamp: new Date().toISOString(),
  };
  fs.appendFileSync(FAILED_TWEETS_LOG, JSON.stringify(record) + '\n');
}

function queueRetry(tweet, reason) {
  const record = {
    ...tweet,
    retry_count: (tweet.retry_count || 0) + 1,
    last_failure: reason,
    queued_at: new Date().toISOString(),
  };
  fs.appendFileSync(RETRY_QUEUE_PATH, JSON.stringify(record) + '\n');
}
