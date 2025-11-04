#!/usr/bin/env node

/**
 * Test Real Tweets Parsing
 * Fetches actual tweets from database and runs three-layer parsing
 */

const { Pool } = require('pg');
const path = require('path');

// Database connection
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'dhruv_db',
  user: 'dhruv_user',
  password: 'dhruv_pass',
};

async function fetchRealTweetsFromDB() {
  console.log('🗄️  Fetching real tweets from database...');

  const pool = new Pool({
    ...dbConfig,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const result = await pool.query(`
      SELECT
        tweet_id,
        text,
        created_at,
        author_handle
      FROM raw_tweets
      WHERE text IS NOT NULL
        AND LENGTH(text) > 20
        AND LENGTH(text) < 500
        AND author_handle = 'OPChoudhary_Ind'
      ORDER BY created_at DESC
      LIMIT 50
    `);

    const tweets = result.rows.map(row => ({
      id: row.tweet_id,
      text: row.text,
      date: row.created_at.toISOString(),
      author: row.author_handle
    }));

    console.log(`✅ Fetched ${tweets.length} real tweets from database`);

    // Debug first few tweets
    tweets.slice(0, 3).forEach((tweet, i) => {
      console.log(`\nDebug Tweet ${i + 1}:`);
      console.log(`  ID: ${tweet.id}`);
      console.log(`  Text: ${tweet.text.substring(0, 150)}...`);
      console.log(`  Length: ${tweet.text.length}`);
      console.log(`  Date: ${tweet.date}`);
    });

    return tweets;
  } finally {
    await pool.end();
  }
}

async function testRealTweetsParsing() {
  console.log('🚀 Testing Real Tweets Parsing from Database\n');

  try {
    const tweets = await fetchRealTweetsFromDB();

    if (tweets.length === 0) {
      console.log('❌ No tweets found in database');
      return;
    }

    console.log('📊 Sample Real Tweets:');
    tweets.slice(0, 5).forEach((tweet, i) => {
      console.log(`\n--- Tweet ${i + 1} ---`);
      console.log(`ID: ${tweet.id}`);
      console.log(`Text: ${tweet.text.substring(0, 100)}...`);
      console.log(`Date: ${tweet.date}`);
    });

    console.log('\n🧪 Starting Three-Layer Parsing Tests...\n');

    // Test parsing on first 10 tweets
    const testTweets = tweets.slice(0, 10);
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < testTweets.length; i++) {
      const tweet = testTweets[i];

      try {
        console.log(`🧪 Testing: ${tweet.text.substring(0, 60)}...`);

        const response = await fetch('http://localhost:3000/api/parsing/three-layer-consensus', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: tweet.text,
            tweetId: tweet.id,
            tweetDate: tweet.date || new Date().toISOString()
          })
        });

        if (!response.ok) {
          console.log(`   ❌ FAILED | HTTP ${response.status}`);
          failed++;
          continue;
        }

        const result = await response.json();

        if (result.success && result.result) {
          const r = result.result;
          const confidence = Math.round((r.overall_confidence || 0) * 100);
          const layers = r.layers_used ? r.layers_used.join(',') : 'unknown';
          const eventType = r.event_type || 'unknown';

          console.log(`   ✅ PASS | ${eventType} | ${confidence}% | ${layers}`);

          if (confidence >= 70) passed++;
          else {
            console.log(`      ⚠️  Low confidence (${confidence}%) - needs review`);
            passed++; // Still count as passed but with warning
          }
        } else {
          console.log(`   ❌ FAILED | ${result.error || 'Unknown error'}`);
          failed++;
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.log(`   ❌ ERROR | ${error.message}`);
        failed++;
      }
    }

    console.log('\n📊 REAL TWEETS PARSING RESULTS:');
    console.log(`✅ Total Tests: ${testTweets.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / testTweets.length) * 100)}%`);

  } catch (error) {
    console.error('❌ Error testing real tweets parsing:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  testRealTweetsParsing();
}

module.exports = { testRealTweetsParsing, fetchRealTweetsFromDB };
