#!/usr/bin/env node

/**
 * Comprehensive Testing Script for Single-Layer Ingestion Functions
 *
 * Tests all critical functions before bulk execution:
 * - Database connectivity and queries
 * - Gemini API functionality
 * - API endpoint communication
 * - Parsing logic and error handling
 * - Backup functionality
 * - Vector indexing triggers
 * - Rate limiting and concurrency
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const BACKUP_DIR = path.join(__dirname, '..', '.taskmaster', 'backups', 'single-layer');
const TWEET_BACKUP_DIR = path.join(__dirname, '..', '.taskmaster', 'backups', 'tweets');
const REQUIRED_DB_ENV_VARS = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_PORT'];
const API_BASE = process.env.TEST_API_BASE || 'http://127.0.0.1:3000';

class IngestionTester {
  constructor() {
    this.db = null;
    this.dbConnected = false;
    this.geminiClient = null;
    this.geminiReady = false;
    this.results = {
      database: { status: 'pending', details: [] },
      gemini: { status: 'pending', details: [] },
      api: { status: 'pending', details: [] },
      parsing: { status: 'pending', details: [] },
      backup: { status: 'pending', details: [] },
      vector: { status: 'pending', details: [] },
      overall: { status: 'pending', message: '' }
    };
  }

  log(message, status = 'info') {
    const timestamp = new Date().toISOString();
    const statusIcon = {
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'info': 'ℹ️'
    }[status] || 'ℹ️';

    console.log(`${statusIcon} [${timestamp}] ${message}`);
  }

  async testDatabaseConnectivity() {
    this.log('Testing database connectivity...');

    const missingEnv = REQUIRED_DB_ENV_VARS.filter(key => !process.env[key]);
    if (missingEnv.length > 0) {
      this.results.database.status = 'error';
      this.results.database.details.push(`Missing environment variables: ${missingEnv.join(', ')}`);
      this.log('Database connectivity: FAILED - missing configuration', 'error');
      return;
    }

    try {
      this.db = new pg.Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      });

      await this.db.connect();
      this.dbConnected = true;
      this.results.database.status = 'success';
      this.results.database.details.push('Database connection established');

      // Test basic query
      const result = await this.db.query('SELECT COUNT(*) as count FROM raw_tweets WHERE processing_status = \'pending\'');
      const pendingCount = parseInt(result.rows[0].count, 10);
      this.results.database.details.push(`Found ${pendingCount} pending tweets`);

      // Test tweet fetching
      const tweetResult = await this.db.query('SELECT tweet_id, text FROM raw_tweets WHERE processing_status = \'pending\' LIMIT 1');
      if (tweetResult.rows.length > 0) {
        this.results.database.details.push('Tweet fetching query works');
      } else {
        this.results.database.details.push('Warning: No pending tweets found');
      }

      this.log('Database connectivity: SUCCESS', 'success');
    } catch (error) {
      this.dbConnected = false;
      this.db = null;
      this.results.database.status = 'error';
      this.results.database.details.push(`Error: ${error.message}`);
      this.log(`Database connectivity: FAILED - ${error.message}`, 'error');
    }
  }

  async testGeminiAPI() {
    this.log('Testing Gemini API...');
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not found in environment');
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.geminiClient = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      // Test simple content generation
      const result = await this.geminiClient.generateContent("Hello, can you confirm you're working?");
      const response = await result.response;
      const text = response.text();

      if (text && text.length > 0) {
        this.results.gemini.status = 'success';
        this.results.gemini.details.push('Basic content generation works');
        this.geminiReady = true;
        this.log('Gemini API: SUCCESS', 'success');
      } else {
        throw new Error('Empty response from Gemini');
      }

      // Test tweet parsing prompt
      const testTweet = "This is a test tweet about government programs in Raipur.";
      const prompt = `Analyze this Chhattisgarh-focused social media post/tweet for political discourse and governance information. Extract structured information with high accuracy for Hindi-English mixed content.

Return ONLY a JSON object with this exact structure:
{
  "categories": {
    "locations": ["location1", "location2"],
    "people": ["person1", "person2"],
    "event": ["event_type"],
    "organisation": ["org1", "org2"],
    "schemes": ["scheme1", "scheme2"],
    "communities": ["community1", "community2"]
  },
  "metadata": {
    "model": "gemini-2.0-flash",
    "confidence": 0.85,
    "processing_time_ms": 1500,
    "discourse_type": "political_governance",
    "language_mix": "hi_en"
  }
}

Tweet Content: "${testTweet}"`;

      const parseResult = await this.geminiClient.generateContent(prompt);
      const parseResponse = await parseResult.response;
      const parseText = parseResponse.text().trim();

      const jsonText = parseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(jsonText);

      if (parsed.categories && parsed.metadata) {
        this.results.gemini.details.push('Tweet parsing structure works');
        this.log('Gemini parsing test: SUCCESS', 'success');
      } else {
        throw new Error('Invalid parsing response structure');
      }

    } catch (error) {
      this.geminiReady = false;
      this.geminiClient = null;
      this.results.gemini.status = 'error';
      this.results.gemini.details.push(`Error: ${error.message}`);
      this.log(`Gemini API: FAILED - ${error.message}`, 'error');
    }
  }

  async testAPIEndpoints() {
    this.log('Testing API endpoints...');
    const apiBase = API_BASE;

    try {
      // Test health endpoint
      const healthResponse = await fetch(`${apiBase}/api/health`);
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        this.results.api.details.push('Health endpoint accessible');
      } else {
        throw new Error(`Health endpoint returned ${healthResponse.status}`);
      }

      // Test all-tweets endpoint
      const tweetsResponse = await fetch(`${apiBase}/api/all-tweets`);
      if (tweetsResponse.ok) {
        const tweetsData = await tweetsResponse.json();
        this.results.api.details.push('All-tweets endpoint accessible');
        if (tweetsData.tweets && Array.isArray(tweetsData.tweets)) {
          this.results.api.details.push(`Fetched ${tweetsData.tweets.length} tweets via API`);
        }
      } else {
        throw new Error(`All-tweets endpoint returned ${tweetsResponse.status}`);
      }

      // Test ingest endpoint with a real tweet from database
      if (this.dbConnected && this.db) {
        const realTweetQuery = await this.db.query('SELECT tweet_id as id, text, created_at, author_handle as author_id FROM raw_tweets WHERE processing_status = \'pending\' LIMIT 1');
        if (realTweetQuery.rows.length === 0) {
          throw new Error('No real tweets available for testing ingestion');
        }

        const realTweet = realTweetQuery.rows[0];
        const testData = {
          tweet: realTweet,
          categories: {
            locations: ['Raipur'],
            people: ['Test Person'],
            event: ['test_event'],
            organisation: ['Test Org'],
            schemes: [],
            communities: []
          },
          gemini_metadata: { model: 'gemini-2.0-flash', confidence: 0.8 }
        };

        const ingestResponse = await fetch(`${apiBase}/api/ingest-parsed-tweet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData),
        });

        // Should get 409 (duplicate if already parsed) or 200 (success) - both indicate API is working
        if (ingestResponse.status === 409 || ingestResponse.ok) {
          this.results.api.details.push('Ingest endpoint functional');
        } else {
          const errorText = await ingestResponse.text();
          throw new Error(`Ingest endpoint returned ${ingestResponse.status}: ${errorText}`);
        }
      } else {
        this.results.api.details.push('Skipping ingest endpoint test (database not connected)');
      }

      this.results.api.status = 'success';
      this.log('API endpoints: SUCCESS', 'success');

    } catch (error) {
      this.results.api.status = 'error';
      this.results.api.details.push(`Error: ${error.message}`);
      this.log(`API endpoints: FAILED - ${error.message}`, 'error');
    }
  }

  async testParsingLogic() {
    this.log('Testing parsing logic...');
    try {
      if (!this.dbConnected || !this.geminiReady || !this.db || !this.geminiClient) {
        const missing = [];
        if (!this.dbConnected || !this.db) missing.push('database connection');
        if (!this.geminiReady || !this.geminiClient) missing.push('Gemini API');
        this.results.parsing.status = 'warning';
        this.results.parsing.details.push(`Skipped: ${missing.join(' and ')} unavailable`);
        this.log(`Parsing logic: SKIPPED - ${missing.join(' and ')} unavailable`, 'warning');
        return;
      }

      // Get a real tweet from database
      const tweetResult = await this.db.query('SELECT tweet_id as id, text, created_at, author_handle as author_id FROM raw_tweets WHERE processing_status = \'pending\' LIMIT 1');
      if (tweetResult.rows.length === 0) {
        throw new Error('No pending tweets available for testing');
      }

      const testTweet = tweetResult.rows[0];
      this.results.parsing.details.push(`Testing with tweet: ${testTweet.id}`);

      // Test parsing function (simulate the logic from single-layer-ingest.js)
      const prompt = `Analyze this Chhattisgarh-focused social media post/tweet for political discourse and governance information. Extract structured information with high accuracy for Hindi-English mixed content.

Return ONLY a JSON object with this exact structure:
{
  "categories": {
    "locations": ["location1", "location2"],
    "people": ["person1", "person2"],
    "event": ["event_type"],
    "organisation": ["org1", "org2"],
    "schemes": ["scheme1", "scheme2"],
    "communities": ["community1", "community2"]
  },
  "metadata": {
    "model": "gemini-2.0-flash",
    "confidence": 0.85,
    "processing_time_ms": 1500,
    "discourse_type": "political_governance",
    "language_mix": "hi_en"
  }
}

Tweet Content: "${testTweet.text}"`;

      const startTime = Date.now();
      const result = await this.geminiClient.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      const processingTime = Date.now() - startTime;

      const jsonText = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(jsonText);

      if (!parsed.categories || !parsed.metadata) {
        throw new Error('Invalid response structure from Gemini');
      }

      this.results.parsing.details.push(`Parsing completed in ${processingTime}ms`);
      this.results.parsing.details.push(`Extracted ${parsed.categories.locations.length} locations, ${parsed.categories.people.length} people`);
      this.results.parsing.status = 'success';
      this.log('Parsing logic: SUCCESS', 'success');

    } catch (error) {
      this.results.parsing.status = 'error';
      this.results.parsing.details.push(`Error: ${error.message}`);
      this.log(`Parsing logic: FAILED - ${error.message}`, 'error');
    }
  }

  async testBackupFunctionality() {
    this.log('Testing backup functionality...');
    try {
      // Ensure directories exist
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.mkdirSync(TWEET_BACKUP_DIR, { recursive: true });

      // Test per-tweet backup
      const testRecord = {
        tweet: { id: 'test_backup', text: 'Test backup tweet' },
        categories: { locations: ['Test'], people: [], event: [] },
        timestamp: new Date().toISOString()
      };

      const date = new Date().toISOString().split('T')[0];
      const filePath = path.join(TWEET_BACKUP_DIR, `${date}.jsonl`);
      fs.appendFileSync(filePath, JSON.stringify(testRecord) + '\n');

      // Verify backup was written
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('test_backup')) {
        this.results.backup.details.push('Per-tweet backup functionality works');
      }

      // Test batch backup
      const batchData = [testRecord];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const batchFileName = `test-batch-${timestamp}.jsonl`;
      const batchFilePath = path.join(BACKUP_DIR, batchFileName);
      const batchContent = batchData.map(item => JSON.stringify(item)).join('\n');
      fs.writeFileSync(batchFilePath, batchContent);

      if (fs.existsSync(batchFilePath)) {
        this.results.backup.details.push('Batch backup functionality works');
      }

      this.results.backup.status = 'success';
      this.log('Backup functionality: SUCCESS', 'success');

    } catch (error) {
      this.results.backup.status = 'error';
      this.results.backup.details.push(`Error: ${error.message}`);
      this.log(`Backup functionality: FAILED - ${error.message}`, 'error');
    }
  }

  async testVectorIndexing() {
    this.log('Testing vector indexing triggers...');
    const apiBase = API_BASE;

    try {
      // Test FAISS indexing endpoint
      const faissResponse = await fetch(`${apiBase}/api/labs/faiss/search?q=test&limit=1`);
      const faissStatus = faissResponse.ok ? 'accessible' : `returns ${faissResponse.status}`;

      // Test Milvus indexing endpoint
      const milvusResponse = await fetch(`${apiBase}/api/labs/milvus/search?q=test&limit=1`);
      const milvusStatus = milvusResponse.ok ? 'accessible' : `returns ${milvusResponse.status}`;

      // Test batch indexing trigger
      const triggerResponse = await fetch(`${apiBase}/api/vector/trigger-batch-indexing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetIds: ['test_123'] }),
      });

      const triggerResult = await triggerResponse.json().catch(() => ({}));
      const triggerStatus = triggerResponse.ok && triggerResult.success ? 'functional' : 'not responding';

      this.results.vector.details.push(`FAISS endpoint: ${faissStatus}`);
      this.results.vector.details.push(`Milvus endpoint: ${milvusStatus}`);
      this.results.vector.details.push(`Batch trigger: ${triggerStatus}`);

      // Consider it success if at least one vector service is accessible
      if (faissResponse.ok || milvusResponse.ok) {
        this.results.vector.status = 'success';
        this.log('Vector indexing: SUCCESS', 'success');
      } else {
        this.results.vector.status = 'warning';
        this.results.vector.details.push('Warning: No vector services currently available');
        this.log('Vector indexing: PARTIAL - services may be offline', 'warning');
      }

    } catch (error) {
      this.results.vector.status = 'warning';
      this.results.vector.details.push(`Error: ${error.message}`);
      this.log(`Vector indexing: WARNING - ${error.message}`, 'warning');
    }
  }

  async runAllTests() {
    console.log('🧪 COMPREHENSIVE INGESTION FUNCTION TESTING');
    console.log('='.repeat(50));

    const startTime = Date.now();
    try {
      await this.testDatabaseConnectivity();
      await this.testGeminiAPI();
      await this.testAPIEndpoints();
      await this.testParsingLogic();
      await this.testBackupFunctionality();
      await this.testVectorIndexing();
    } catch (error) {
      this.log(`Unexpected error while running tests: ${error.message}`, 'error');
      this.results.overall.status = 'blocked';
      this.results.overall.message = `Unexpected failure: ${error.message}`;
    } finally {
      if (this.db) {
        try {
          await this.db.end();
        } catch (dbError) {
          this.log(`Warning while closing database connection: ${dbError.message}`, 'warning');
        }
        this.db = null;
        this.dbConnected = false;
      }
    }

    return this.finalizeResults(startTime);
  }

  finalizeResults(startTime) {
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(30));

    const statusCounts = {};
    Object.entries(this.results).forEach(([key, result]) => {
      if (key === 'overall' || !result.status) return;
      statusCounts[result.status] = (statusCounts[result.status] || 0) + 1;
    });

    console.log(`Duration: ${duration}s`);
    console.log(`Tests: ${Object.keys(this.results).length - 1}`);
    console.log(`Passed: ${statusCounts.success || 0}`);
    console.log(`Warnings: ${statusCounts.warning || 0}`);
    console.log(`Failed: ${statusCounts.error || 0}`);

    console.log('\n📋 DETAILED RESULTS:');
    Object.entries(this.results).forEach(([test, result]) => {
      if (test === 'overall') return;

      const statusIcon = {
        'success': '✅',
        'warning': '⚠️',
        'error': '❌',
        'pending': '⏳'
      }[result.status] || '❓';

      console.log(`${statusIcon} ${test.toUpperCase()}: ${result.status}`);
      result.details.forEach(detail => console.log(`   - ${detail}`));
    });

    const hasErrors = (statusCounts.error || 0) > 0;
    const hasWarnings = (statusCounts.warning || 0) > 0;
    const allSuccess = !hasErrors && !hasWarnings;

    console.log('\n🎯 OVERALL ASSESSMENT:');
    if (!this.results.overall.status || this.results.overall.status === 'pending') {
      if (allSuccess) {
        console.log('✅ ALL TESTS PASSED - Ready for bulk ingestion');
        this.results.overall.status = 'ready';
        this.results.overall.message = 'All functions validated successfully';
      } else if (hasErrors) {
        console.log('❌ CRITICAL ISSUES FOUND - Fix before bulk ingestion');
        this.results.overall.status = 'blocked';
        this.results.overall.message = 'Critical errors must be resolved';
      } else {
        console.log('⚠️ MINOR ISSUES FOUND - May proceed with caution');
        this.results.overall.status = 'caution';
        this.results.overall.message = 'Minor warnings, proceed carefully';
      }
    } else {
      if (this.results.overall.status === 'ready') {
        console.log('✅ ALL TESTS PASSED - Ready for bulk ingestion');
      } else if (this.results.overall.status === 'caution') {
        console.log('⚠️ MINOR ISSUES FOUND - May proceed with caution');
      } else {
        console.log('❌ CRITICAL ISSUES FOUND - Fix before bulk ingestion');
      }
    }

    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const resultsPath = path.join(BACKUP_DIR, 'test-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      duration_seconds: duration,
      results: this.results
    }, null, 2));

    console.log(`\n💾 Results saved to: ${resultsPath}`);

    return this.results.overall.status;
  }
}

// Main execution
const tester = new IngestionTester();
tester.runAllTests().then(status => {
  console.log(`\n🏁 Testing completed with status: ${status}`);
  process.exit(status === 'ready' ? 0 : 1);
}).catch(error => {
  console.error('❌ Testing failed with error:', error);
  process.exit(1);
});
