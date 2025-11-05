#!/usr/bin/env node

/**
 * Incremental Tweet Fetcher
 * Fetches only new tweets since the last fetch
 * Runs hourly via GitHub Actions
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function getLastTweetDate() {
  try {
    const result = await pool.query(`
      SELECT MAX(created_at) as last_date
      FROM raw_tweets
    `);
    return result.rows[0].last_date;
  } catch (error) {
    console.error('Error getting last tweet date:', error);
    return null;
  }
}

async function fetchNewTweets(sinceDate) {
  const TwitterApi = require('twitter-api-v2').TwitterApi;

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  });

  try {
    console.log(`Fetching tweets since ${sinceDate}...`);

    // Get user ID for OP Choudhary
    const user = await client.v2.userByUsername('OPChoudhary_Ind');
    const userId = user.data.id;

    // Fetch recent tweets
    const tweets = await client.v2.userTimeline(userId, {
      max_results: 10, // Small batch for hourly runs
      'tweet.fields': ['created_at', 'public_metrics', 'context_annotations'],
      'user.fields': ['username'],
      since_id: sinceDate ? undefined : undefined, // Twitter API uses since_id, but we'll handle date filtering in DB
      start_time: sinceDate ? sinceDate.toISOString() : undefined,
    });

    if (!tweets.data || tweets.data.length === 0) {
      console.log('No new tweets found');
      return [];
    }

    console.log(`Found ${tweets.data.length} new tweets`);
    return tweets.data.map(tweet => ({
      tweet_id: tweet.id,
      text: tweet.text,
      created_at: new Date(tweet.created_at),
      author_handle: 'OPChoudhary_Ind',
      retweet_count: tweet.public_metrics?.retweet_count || 0,
      reply_count: tweet.public_metrics?.reply_count || 0,
      like_count: tweet.public_metrics?.like_count || 0,
      quote_count: tweet.public_metrics?.quote_count || 0,
      hashtags: extractHashtags(tweet.text),
      mentions: extractMentions(tweet.text),
      urls: extractUrls(tweet.text),
      processing_status: 'pending'
    }));

  } catch (error) {
    console.error('Error fetching tweets:', error);
    return [];
  }
}

function extractHashtags(text) {
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  return matches ? matches.map(tag => tag.substring(1)) : [];
}

function extractMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex);
  return matches ? matches.map(mention => mention.substring(1)) : [];
}

function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return text.match(urlRegex) || [];
}

async function saveTweetsToDatabase(tweets) {
  if (tweets.length === 0) return;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const tweet of tweets) {
      // Insert with ON CONFLICT to avoid duplicates
      await client.query(`
        INSERT INTO raw_tweets (
          tweet_id, text, created_at, author_handle,
          retweet_count, reply_count, like_count, quote_count,
          hashtags, mentions, urls, processing_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (tweet_id) DO NOTHING
      `, [
        tweet.tweet_id,
        tweet.text,
        tweet.created_at,
        tweet.author_handle,
        tweet.retweet_count,
        tweet.reply_count,
        tweet.like_count,
        tweet.quote_count,
        JSON.stringify(tweet.hashtags),
        JSON.stringify(tweet.mentions),
        JSON.stringify(tweet.urls),
        tweet.processing_status
      ]);
    }

    await client.query('COMMIT');
    console.log(`Saved ${tweets.length} tweets to database`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving tweets:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🚀 Starting incremental tweet fetch...');

    // Get the date of the last tweet in our database
    const lastTweetDate = await getLastTweetDate();
    console.log('Last tweet date:', lastTweetDate);

    // Fetch new tweets
    const newTweets = await fetchNewTweets(lastTweetDate);

    // Save to database
    if (newTweets.length > 0) {
      await saveTweetsToDatabase(newTweets);
      console.log('✅ Successfully fetched and saved new tweets');
    } else {
      console.log('ℹ️ No new tweets to fetch');
    }

  } catch (error) {
    console.error('❌ Error in tweet fetching:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main, fetchNewTweets, saveTweetsToDatabase };
