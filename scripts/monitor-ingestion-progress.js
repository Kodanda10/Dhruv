#!/usr/bin/env node

/**
 * Monitor Large-Scale Tweet Ingestion Progress
 *
 * Provides real-time monitoring and progress tracking for the
 * single-layer ingestion process.
 *
 * Usage:
 *   node scripts/monitor-ingestion-progress.js [--interval <seconds>] [--watch]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const BACKUP_DIR = path.join(__dirname, '..', '.taskmaster', 'backups', 'single-layer');
const SUMMARY_PATH = path.join(BACKUP_DIR, 'ingestion-summary.json');

// Parse CLI arguments
const args = process.argv.slice(2);
const cliOptions = {};
for (let i = 0; i < args.length; i++) {
  const token = args[i];
  if (!token.startsWith('--')) continue;
  const key = token.slice(2);
  const next = args[i + 1];
  if (!next || next.startsWith('--')) {
    cliOptions[key] = true;
  } else {
    cliOptions[key] = next;
    i++;
  }
}

const MONITOR_INTERVAL = parseInt(cliOptions['interval'] ?? '30', 10); // seconds
const WATCH_MODE = cliOptions['watch'] === true;

class IngestionMonitor {
  constructor() {
    this.db = new pg.Client({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    this.startTime = new Date();
    this.lastSnapshot = null;
  }

  async connect() {
    await this.db.connect();
    console.log('🔗 Connected to database');
  }

  async disconnect() {
    await this.db.end();
    console.log('🔌 Disconnected from database');
  }

  async getCurrentStats() {
    // Get tweet processing status
    const statusQuery = await this.db.query(`
      SELECT processing_status, COUNT(*) as count
      FROM raw_tweets
      GROUP BY processing_status
      ORDER BY count DESC
    `);

    // Get parsed events count
    const parsedQuery = await this.db.query('SELECT COUNT(*) as count FROM parsed_events');

    // Get recent processing activity (last 5 minutes)
    // Note: We don't have updated_at_db column, so we'll estimate based on created_at proximity
    const recentQuery = await this.db.query(`
      SELECT COUNT(*) as recent_processed
      FROM parsed_events
      WHERE parsed_at > NOW() - INTERVAL '5 minutes'
    `);

    return {
      timestamp: new Date().toISOString(),
      processing_status: statusQuery.rows.reduce((acc, row) => {
        acc[row.processing_status] = parseInt(row.count, 10);
        return acc;
      }, {}),
      parsed_events: parseInt(parsedQuery.rows[0].count, 10),
      recent_activity: parseInt(recentQuery.rows[0].recent_processed, 10),
    };
  }

  async getBackupStats() {
    const stats = {
      batchBackups: 0,
      tweetBackups: 0,
      failedTweets: 0,
      retryQueue: 0,
    };

    try {
      // Count batch backup files
      if (fs.existsSync(BACKUP_DIR)) {
        const files = fs.readdirSync(BACKUP_DIR);
        stats.batchBackups = files.filter(f => f.startsWith('batch-')).length;
      }

      // Count per-tweet backups
      const tweetBackupDir = path.join(__dirname, '..', '.taskmaster', 'backups', 'tweets');
      if (fs.existsSync(tweetBackupDir)) {
        const dateDirs = fs.readdirSync(tweetBackupDir);
        stats.tweetBackups = dateDirs.length;
      }

      // Count failed tweets
      const failedTweetsPath = path.join(BACKUP_DIR, 'failed_tweets.jsonl');
      if (fs.existsSync(failedTweetsPath)) {
        const content = fs.readFileSync(failedTweetsPath, 'utf8');
        stats.failedTweets = content.trim().split('\n').filter(line => line.trim()).length;
      }

      // Count retry queue
      const retryQueuePath = path.join(BACKUP_DIR, 'retry_queue.jsonl');
      if (fs.existsSync(retryQueuePath)) {
        const content = fs.readFileSync(retryQueuePath, 'utf8');
        stats.retryQueue = content.trim().split('\n').filter(line => line.trim()).length;
      }
    } catch (error) {
      console.warn('Warning: Could not read backup stats:', error.message);
    }

    return stats;
  }

  async loadIngestionSummary() {
    try {
      if (fs.existsSync(SUMMARY_PATH)) {
        const data = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
        return data;
      }
    } catch (error) {
      console.warn('Warning: Could not load ingestion summary:', error.message);
    }
    return null;
  }

  formatProgressBar(current, total, width = 40) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    const filled = Math.round((current / total) * width);
    const empty = width - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${bar} ${percentage}% (${current}/${total})`;
  }

  async displayStatus() {
    console.clear();
    console.log('📊 TWEET INGESTION MONITOR');
    console.log('='.repeat(50));

    const stats = await this.getCurrentStats();
    const backupStats = await this.getBackupStats();
    const summary = await this.loadIngestionSummary();

    const totalTweets = Object.values(stats.processing_status).reduce((a, b) => a + b, 0);
    const processed = stats.processing_status.processed || 0;
    const pending = stats.processing_status.pending || 0;
    const failed = stats.processing_status.failed || 0;
    const retryPending = stats.processing_status.pending_retry || 0;

    console.log(`⏰ Monitor Start: ${this.startTime.toLocaleString()}`);
    console.log(`📅 Current Time: ${new Date().toLocaleString()}`);
    console.log(`🔄 Last Update: ${stats.timestamp}`);
    console.log('');

    // Progress Overview
    console.log('📈 PROGRESS OVERVIEW');
    console.log(`  ${this.formatProgressBar(processed, totalTweets)}`);
    console.log(`  Total Tweets: ${totalTweets}`);
    console.log(`  ✅ Processed: ${processed}`);
    console.log(`  ⏳ Pending: ${pending}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  🔄 Retry Pending: ${retryPending}`);
    console.log(`  📝 Parsed Events: ${stats.parsed_events}`);
    console.log('');

    // Recent Activity
    console.log('⚡ RECENT ACTIVITY (Last 5 min)');
    console.log(`  Processed: ${stats.recent_activity} tweets`);
    const rate = stats.recent_activity > 0 ? Math.round(stats.recent_activity / 5 * 60) : 0;
    console.log(`  Rate: ${rate} tweets/hour`);
    console.log('');

    // Backup Status
    console.log('💾 BACKUP STATUS');
    console.log(`  Batch Backups: ${backupStats.batchBackups}`);
    console.log(`  Tweet Backup Days: ${backupStats.tweetBackups}`);
    console.log(`  Failed Tweets Log: ${backupStats.failedTweets}`);
    console.log(`  Retry Queue: ${backupStats.retryQueue}`);
    console.log('');

    // Ingestion Summary (if available)
    if (summary) {
      console.log('📋 INGESTION SUMMARY');
      console.log(`  Started: ${new Date(summary.timestamp).toLocaleString()}`);
      console.log(`  Batches Processed: ${summary.batchesProcessed}`);
      console.log(`  Total Processed: ${summary.totalProcessed}`);
      console.log(`  Total Failed: ${summary.totalFailed}`);
      console.log(`  Total Duplicates: ${summary.totalDuplicates}`);
      console.log(`  Vector Indexing: FAISS=${summary.vectorization.faiss}, Milvus=${summary.vectorization.milvus}`);
      console.log('');
    }

    // Performance Metrics
    const elapsedMinutes = (Date.now() - this.startTime.getTime()) / (1000 * 60);
    const avgRate = elapsedMinutes > 0 ? Math.round(processed / elapsedMinutes) : 0;

    console.log('⚡ PERFORMANCE METRICS');
    console.log(`  Elapsed Time: ${Math.floor(elapsedMinutes)}m ${Math.floor((elapsedMinutes % 1) * 60)}s`);
    console.log(`  Average Rate: ${avgRate} tweets/minute`);
    console.log(`  Estimated Time Remaining: ${pending > 0 ? Math.ceil(pending / avgRate) : 0} minutes`);
    console.log('');

    // Status indicators
    const isActive = stats.recent_activity > 0;
    const hasErrors = failed > 0 || retryPending > 0;
    const progress = processed / totalTweets;

    console.log('🎯 STATUS INDICATORS');
    console.log(`  Active Processing: ${isActive ? '🟢 YES' : '🔴 NO'}`);
    console.log(`  Errors Detected: ${hasErrors ? '🟡 YES' : '🟢 NO'}`);
    console.log(`  Progress Status: ${progress >= 0.9 ? '🟢 NEAR COMPLETE' : progress >= 0.5 ? '🟡 HALFWAY' : '🔵 STARTING'}`);

    if (!WATCH_MODE) {
      console.log('');
      console.log('💡 TIP: Use --watch flag for continuous monitoring');
    }
  }

  async run() {
    await this.connect();

    if (WATCH_MODE) {
      console.log(`🔄 Starting continuous monitoring (interval: ${MONITOR_INTERVAL}s)`);
      console.log('Press Ctrl+C to stop\n');

      // Initial display
      await this.displayStatus();

      // Set up interval
      const interval = setInterval(async () => {
        await this.displayStatus();
      }, MONITOR_INTERVAL * 1000);

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping monitor...');
        clearInterval(interval);
        await this.disconnect();
        process.exit(0);
      });
    } else {
      // Single snapshot
      await this.displayStatus();
      await this.disconnect();
    }
  }
}

// Main execution
const monitor = new IngestionMonitor();
monitor.run().catch(error => {
  console.error('❌ Monitor error:', error);
  process.exit(1);
});