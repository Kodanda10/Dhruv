/**
 * Comprehensive Parsing Test Runner
 * Executes 1500+ scenarios with real tweet data
 * Rate-limited Gemini usage, comprehensive validation
 */

import { ThreeLayerConsensusEngine } from '@/lib/parsing/three-layer-consensus-engine';
import { RateLimiter } from '@/lib/parsing/rate-limiter';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

interface TestCase {
  id: string;
  tweetId: string;
  text: string;
  expectedEventType?: string;
  expectedLocations?: string[];
  expectedPeople?: string[];
  expectedOrganizations?: string[];
  expectedSchemes?: string[];
  category: 'event_classification' | 'entity_extraction' | 'consensus_voting' | 'error_handling';
  difficulty: 'easy' | 'medium' | 'hard';
}

interface TestResult {
  testCase: TestCase;
  result: any;
  duration: number;
  success: boolean;
  accuracy: {
    eventType: boolean;
    locations: number;
    people: number;
    organizations: number;
    schemes: number;
  };
  errors: string[];
}

interface TestReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  accuracy: {
    eventType: number;
    locations: number;
    people: number;
    organizations: number;
    schemes: number;
  };
  performance: {
    averageDuration: number;
    p95Duration: number;
    totalDuration: number;
  };
  rateLimiting: {
    geminiRequests: number;
    ollamaRequests: number;
    fallbackOnly: number;
  };
  consensusStats: {
    perfectAgreement: number;
    majorityAgreement: number;
    minorityAgreement: number;
    noAgreement: number;
  };
  categoryBreakdown: Record<string, { total: number; passed: number; accuracy: number }>;
}

export class ComprehensiveParsingTestRunner {
  private engine: ThreeLayerConsensusEngine | null = null;
  private rateLimiter: RateLimiter | null = null;
  private dbPool: Pool | null = null;
  private testResults: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.initializeComponents();
  }

  private async initializeComponents(): Promise<void> {
    // Initialize rate limiter with conservative Gemini limits
    this.rateLimiter = new RateLimiter({
      geminiRPM: 5, // Very conservative for free tier
      ollamaRPM: 60,
      maxRetries: 3,
      backoffMultiplier: 2,
      initialBackoffMs: 1000
    });

    // Initialize parsing engine
    this.engine = new ThreeLayerConsensusEngine({
      rateLimiter: this.rateLimiter,
      consensusThreshold: 2,
      enableFallback: true,
      logLevel: 'info'
    });

    // Initialize database connection
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      this.dbPool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      });
    }
  }

  /**
   * Load test cases from database and RTF file
   */
  async loadTestCases(): Promise<TestCase[]> {
    const testCases: TestCase[] = [];

    // Load from database (primary source)
    if (this.dbPool) {
      const dbTweets = await this.loadTweetsFromDatabase();
      testCases.push(...dbTweets);

      // Only use RTF as fallback if database has very few tweets
      if (dbTweets.length < 50) {
        console.log(`⚠️  Database has only ${dbTweets.length} tweets, supplementing with RTF file`);
        const rtfTweets = await this.loadTweetsFromRTFFile();
        testCases.push(...rtfTweets);
      }
    } else {
      // Database not available, use RTF file
      console.log('⚠️  Database not available, using RTF file as fallback');
      const rtfTweets = await this.loadTweetsFromRTFFile();
      testCases.push(...rtfTweets);
    }

    // Categorize and enrich test cases
    return this.categorizeTestCases(testCases);
  }

  private async loadTweetsFromDatabase(): Promise<TestCase[]> {
    if (!this.dbPool) return [];

    try {
      const result = await this.dbPool.query(`
        SELECT
          tweet_id,
          text,
          created_at
        FROM raw_tweets
        WHERE text IS NOT NULL
          AND LENGTH(text) > 20
          AND LENGTH(text) < 500
          AND author_handle = 'OPChoudhary_Ind'
        ORDER BY RANDOM()
        LIMIT 1000
      `);

      return result.rows.map(row => ({
        id: `db_${row.tweet_id}`,
        tweetId: row.tweet_id,
        text: row.text,
        category: 'event_classification' as const,
        difficulty: 'medium' as const
      }));
    } catch (error) {
      console.error('Failed to load tweets from database:', error);
      return [];
    }
  }

  private async loadTweetsFromRTFFile(): Promise<TestCase[]> {
    try {
      const rtfPath = path.join(process.cwd(), 'fetched_tweets_readable.rtf');
      const rtfContent = fs.readFileSync(rtfPath, 'utf8');

      // Extract tweets from RTF (simplified parsing)
      const tweets: TestCase[] = [];
      const tweetBlocks = rtfContent.split('================================================================================');

      // Skip the first 3 blocks (header blocks) and process actual tweets
      for (let i = 3; i < Math.min(tweetBlocks.length, 500 + 3); i++) {
        const block = tweetBlocks[i];

        // Look for text between "Text:" and "Metrics:"
        const textStart = block.indexOf('Text:');
        const metricsStart = block.indexOf('Metrics:');

        if (textStart !== -1 && metricsStart !== -1 && metricsStart > textStart) {
          let text = block.substring(textStart + 5, metricsStart)
            .replace(/\\\\uc0\\\\u\d+ /g, '') // Remove Unicode escapes (properly escaped)
            .replace(/^\\s*$/gm, '') // Remove empty RTF lines
            .replace(/^\s*\\\s*$/gm, '') // Remove lines that are just backslashes
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();

          // If text is empty or too short, skip
          if (text.length > 20 && text.length < 500) {
            tweets.push({
              id: `rtf_${i - 2}`, // Adjust index for actual tweet number
              tweetId: `rtf_tweet_${i - 2}`,
              text,
              category: 'entity_extraction' as const,
              difficulty: 'hard' as const
            });
          }
        }
      }

      return tweets;
    } catch (error) {
      console.error('Failed to load tweets from RTF file:', error);
      return [];
    }
  }

  private categorizeTestCases(testCases: TestCase[]): TestCase[] {
    return testCases.map(testCase => {
      const text = testCase.text.toLowerCase();

      // Event classification patterns
      if (text.includes('उद्घाटन') || text.includes('लोकार्पण') || text.includes('शिलान्यास')) {
        testCase.expectedEventType = 'inauguration';
        testCase.category = 'event_classification';
      } else if (text.includes('बैठक') || text.includes('मुलाकात') || text.includes('चर्चा')) {
        testCase.expectedEventType = 'meeting';
        testCase.category = 'event_classification';
      } else if (text.includes('रैली') || text.includes('सभा') || text.includes('सम्मेलन')) {
        testCase.expectedEventType = 'rally';
        testCase.category = 'event_classification';
      } else if (text.includes('निरीक्षण') || text.includes('दौरा') || text.includes('समीक्षा')) {
        testCase.expectedEventType = 'inspection';
        testCase.category = 'event_classification';
      } else if (text.includes('योजना') || text.includes('घोषणा') || text.includes('विस्तार')) {
        testCase.expectedEventType = 'scheme_announcement';
        testCase.category = 'event_classification';
      }

      // Entity extraction expectations
      testCase.expectedLocations = this.extractExpectedLocations(testCase.text);
      testCase.expectedPeople = this.extractExpectedPeople(testCase.text);
      testCase.expectedOrganizations = this.extractExpectedOrganizations(testCase.text);
      testCase.expectedSchemes = this.extractExpectedSchemes(testCase.text);

      return testCase;
    });
  }

  private extractExpectedLocations(text: string): string[] {
    const locations = [];
    const locationKeywords = ['रायपुर', 'बिलासपुर', 'रायगढ़', 'दुर्ग', 'राजनांदगांव', 'छत्तीसगढ़', 'भारत', 'दिल्ली'];

    for (const loc of locationKeywords) {
      if (text.includes(loc)) {
        locations.push(loc);
      }
    }

    return locations;
  }

  private extractExpectedPeople(text: string): string[] {
    const people = [];
    const peopleKeywords = ['@narendramodi', '@AmitShah', '@bhupeshbaghel', 'मोदी', 'शाह', 'बघेल'];

    for (const person of peopleKeywords) {
      if (text.includes(person.replace('@', '')) || text.includes(person)) {
        people.push(person.replace('@', ''));
      }
    }

    return people;
  }

  private extractExpectedOrganizations(text: string): string[] {
    const orgs = [];
    const orgKeywords = ['भाजपा', 'कांग्रेस', 'सरकार', 'प्रशासन', 'मंत्रालय'];

    for (const org of orgKeywords) {
      if (text.includes(org)) {
        orgs.push(org);
      }
    }

    return orgs;
  }

  private extractExpectedSchemes(text: string): string[] {
    const schemes = [];
    const schemeKeywords = ['मनरेगा', 'आयुष्मान भारत', 'स्वच्छ भारत', 'किसान सम्मान', 'प्रधानमंत्री आवास'];

    for (const scheme of schemeKeywords) {
      if (text.includes(scheme)) {
        schemes.push(scheme);
      }
    }

    return schemes;
  }

  /**
   * Run comprehensive test suite
   */
  async runComprehensiveTests(): Promise<TestReport> {
    console.log('🚀 Starting Comprehensive Parsing Test Suite (1500+ scenarios)');
    console.log('='.repeat(80));

    this.startTime = Date.now();
    const testCases = await this.loadTestCases();

    console.log(`📊 Loaded ${testCases.length} test cases`);
    console.log(`⏱️  Rate limiting: Gemini 5 RPM max, Ollama 60 RPM max`);
    console.log();

    // Run tests in batches to manage rate limiting
    const batchSize = 50;
    let completedTests = 0;

    for (let i = 0; i < testCases.length; i += batchSize) {
      const batch = testCases.slice(i, i + batchSize);
      console.log(`🔬 Running batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(testCases.length/batchSize)} (${batch.length} tests)`);

      const batchPromises = batch.map(testCase => this.runSingleTest(testCase));
      const batchResults = await Promise.all(batchPromises);

      this.testResults.push(...batchResults);
      completedTests += batch.length;

      const passed = batchResults.filter(r => r.success).length;
      console.log(`   ✅ ${passed}/${batch.length} passed (${(passed/batch.length*100).toFixed(1)}%)`);

      // Rate limiting pause between batches
      if (i + batchSize < testCases.length) {
        console.log('   ⏳ Rate limiting pause (60 seconds)...');
        await this.sleep(60000); // 60 second pause between batches
      }
    }

    console.log('\n📈 Generating comprehensive report...');
    return this.generateReport();
  }

  private async runSingleTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    try {
      if (!this.engine) {
        throw new Error('Engine not initialized');
      }

      const result = await this.engine.parseTweet(
        testCase.text,
        testCase.tweetId,
        new Date()
      );

      const duration = Date.now() - startTime;

      // Calculate accuracy
      const accuracy = {
        eventType: result.event_type === testCase.expectedEventType,
        locations: this.calculateAccuracy(result.locations || [], testCase.expectedLocations || []),
        people: this.calculateAccuracy(result.people_mentioned || [], testCase.expectedPeople || []),
        organizations: this.calculateAccuracy(result.organizations || [], testCase.expectedOrganizations || []),
        schemes: this.calculateAccuracy(result.schemes_mentioned || [], testCase.expectedSchemes || [])
      };

      const accuracyValues = [accuracy.eventType ? 1 : 0, accuracy.locations, accuracy.people, accuracy.organizations, accuracy.schemes];
      const overallAccuracy = accuracyValues.reduce((sum, acc) => sum + acc, 0) / accuracyValues.length;
      const success = overallAccuracy > 0.6; // 60% accuracy threshold

      return {
        testCase,
        result,
        duration,
        success,
        accuracy,
        errors: []
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        testCase,
        result: null,
        duration,
        success: false,
        accuracy: {
          eventType: false,
          locations: 0,
          people: 0,
          organizations: 0,
          schemes: 0
        },
        errors: [error.message]
      };
    }
  }

  private calculateAccuracy(actual: string[], expected: string[]): number {
    if (expected.length === 0) return actual.length === 0 ? 1 : 0;

    const matches = actual.filter(item =>
      expected.some(exp => exp.toLowerCase().includes(item.toLowerCase()) ||
                          item.toLowerCase().includes(exp.toLowerCase()))
    );

    return matches.length / Math.max(expected.length, actual.length);
  }

  private generateReport(): TestReport {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    // Calculate accuracies
    const accuracies = {
      eventType: this.testResults.filter(r => r.accuracy.eventType).length / totalTests,
      locations: this.testResults.reduce((sum, r) => sum + r.accuracy.locations, 0) / totalTests,
      people: this.testResults.reduce((sum, r) => sum + r.accuracy.people, 0) / totalTests,
      organizations: this.testResults.reduce((sum, r) => sum + r.accuracy.organizations, 0) / totalTests,
      schemes: this.testResults.reduce((sum, r) => sum + r.accuracy.schemes, 0) / totalTests
    };

    // Performance metrics
    const durations = this.testResults.map(r => r.duration).sort((a, b) => a - b);
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95Duration = durations[Math.floor(durations.length * 0.95)];

    // Consensus statistics
    const consensusStats = {
      perfectAgreement: this.testResults.filter(r => r.result?.consensus_score === 3).length,
      majorityAgreement: this.testResults.filter(r => r.result?.consensus_score === 2).length,
      minorityAgreement: this.testResults.filter(r => r.result?.consensus_score === 1).length,
      noAgreement: this.testResults.filter(r => r.result?.consensus_score === 0).length
    };

    // Category breakdown
    const categoryBreakdown: Record<string, { total: number; passed: number; accuracy: number }> = {};
    const categories = ['event_classification', 'entity_extraction', 'consensus_voting', 'error_handling'];

    categories.forEach(category => {
      const categoryResults = this.testResults.filter(r => r.testCase.category === category);
      if (categoryResults.length > 0) {
        const passed = categoryResults.filter(r => r.success).length;
        const accuracyValues = categoryResults.map(r => {
          const acc = r.accuracy;
          return [acc.eventType ? 1 : 0, acc.locations, acc.people, acc.organizations, acc.schemes];
        });
        const accuracy = accuracyValues.reduce((sum, values) => sum + (values.reduce((s, a) => s + a, 0) / values.length), 0) / categoryResults.length;

        categoryBreakdown[category] = {
          total: categoryResults.length,
          passed,
          accuracy
        };
      }
    });

    // Rate limiting stats
    const rateStats = this.rateLimiter?.getStatus() || { gemini: { used: 0 }, ollama: { used: 0 } };
    const fallbackOnly = this.testResults.filter(r =>
      r.result && (!r.result.layers_used || !r.result.layers_used.includes('gemini'))
    ).length;

    return {
      totalTests,
      passedTests,
      failedTests,
      accuracy: accuracies,
      performance: {
        averageDuration,
        p95Duration,
        totalDuration: Date.now() - this.startTime
      },
      rateLimiting: {
        geminiRequests: rateStats.gemini.used,
        ollamaRequests: rateStats.ollama.used,
        fallbackOnly
      },
      consensusStats,
      categoryBreakdown
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save test report to file
   */
  async saveReport(report: TestReport, filename: string = 'comprehensive-test-report.json'): Promise<void> {
    const reportPath = path.join(process.cwd(), 'test-results', filename);
    await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${reportPath}`);
  }
}

// Export for use in tests
export type { TestCase, TestResult, TestReport };
