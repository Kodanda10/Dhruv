#!/usr/bin/env node

/**
 * Database Tweet Count Checker
 * Shows total tweets and parsing status
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

async function checkDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    console.log('🔍 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Get total tweets in raw_tweets table
    const totalTweetsResult = await client.query('SELECT COUNT(*) as count FROM raw_tweets');
    const totalTweets = parseInt(totalTweetsResult.rows[0].count);

    // Get parsed events count
    const parsedEventsResult = await client.query('SELECT COUNT(*) as count FROM parsed_events');
    const parsedEvents = parseInt(parsedEventsResult.rows[0].count);

    // Get tweets that need parsing (raw_tweets not in parsed_events)
    const unparsedTweetsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM raw_tweets rt
      LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
      WHERE pe.tweet_id IS NULL
    `);
    const unparsedTweets = parseInt(unparsedTweetsResult.rows[0].count);

    // Get tweets ready for dashboard (parsed and approved)
    const dashboardReadyResult = await client.query(`
      SELECT COUNT(*) as count
      FROM parsed_events
      WHERE needs_review = false AND review_status = 'approved'
    `);
    const dashboardReady = parseInt(dashboardReadyResult.rows[0].count);

    // Get tweets needing review
    const needsReviewResult = await client.query(`
      SELECT COUNT(*) as count
      FROM parsed_events
      WHERE needs_review = true OR review_status != 'approved'
    `);
    const needsReview = parseInt(needsReviewResult.rows[0].count);

    console.log('📊 DATABASE STATUS REPORT');
    console.log('=' .repeat(50));
    console.log(`📝 Total Raw Tweets: ${totalTweets.toLocaleString()}`);
    console.log(`✅ Parsed Events: ${parsedEvents.toLocaleString()}`);
    console.log(`⏳ Unparsed Tweets: ${unparsedTweets.toLocaleString()}`);
    console.log(`📊 Dashboard Ready: ${dashboardReady.toLocaleString()}`);
    console.log(`🔍 Needs Review: ${needsReview.toLocaleString()}`);
    console.log('=' .repeat(50));

    const parseProgress = totalTweets > 0 ? ((parsedEvents / totalTweets) * 100).toFixed(1) : '0.0';
    const reviewProgress = parsedEvents > 0 ? ((dashboardReady / parsedEvents) * 100).toFixed(1) : '0.0';

    console.log(`\n📈 Progress:`);
    console.log(`   Parsing: ${parseProgress}% (${parsedEvents}/${totalTweets})`);
    console.log(`   Review: ${reviewProgress}% (${dashboardReady}/${parsedEvents})`);

    if (unparsedTweets > 0) {
      console.log(`\n🚨 Action Required:`);
      console.log(`   ${unparsedTweets.toLocaleString()} tweets need parsing`);
    }

    if (needsReview > 0) {
      console.log(`   ${needsReview.toLocaleString()} parsed events need review`);
    }

    if (dashboardReady > 0) {
      console.log(`\n✅ Ready for Dashboard:`);
      console.log(`   ${dashboardReady.toLocaleString()} tweets are ready for dashboard ingestion`);
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkDatabase().catch(console.error);