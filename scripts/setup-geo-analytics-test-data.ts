/**
 * Setup comprehensive test data for geo-analytics endpoints
 * Loads from parsed_tweets.json and creates database records with geo_hierarchy
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function setupTestData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db'
  });

  try {
    // Load parsed_tweets.json
    const tweetsPath = path.join(process.cwd(), 'data', 'parsed_tweets.json');
    const tweets = JSON.parse(fs.readFileSync(tweetsPath, 'utf8'));

    console.log(`Loaded ${tweets.length} tweets from parsed_tweets.json`);

    // Ensure raw_tweets exist first
    for (const tweet of tweets.slice(0, 20)) { // Use first 20 tweets
      await pool.query(`
        INSERT INTO raw_tweets (tweet_id, text, created_at, author_handle, processing_status)
        VALUES ($1, $2, $3::timestamp, $4, 'parsed')
        ON CONFLICT (tweet_id) DO UPDATE SET text = EXCLUDED.text
      `, [
        tweet.id,
        tweet.content,
        tweet.timestamp,
        'test_user'
      ]);
    }

    // Create parsed_events with geo_hierarchy from tweet locations
    for (const tweet of tweets.slice(0, 20)) {
      if (tweet.parsed?.locations && tweet.parsed.locations.length > 0) {
        const location = tweet.parsed.locations[0];
        const locationName = location.name || 'रायपुर';

        // Create geo_hierarchy array based on location
        const geoHierarchy = [{
          village: locationName === 'रायपुर' ? 'पंडरी' : locationName,
          gram_panchayat: locationName === 'बिलासपुर' ? 'बिलासपुर' : null,
          ulb: locationName === 'रायपुर' ? 'रायपुर नगर निगम' : null,
          ward_no: locationName === 'रायपुर' ? 5 : null,
          block: locationName,
          assembly: `${locationName} शहर उत्तर`,
          district: locationName,
          is_urban: locationName === 'रायपुर',
          confidence: location.confidence || 0.9
        }];

        await pool.query(`
          INSERT INTO parsed_events (
            tweet_id, event_type, locations, needs_review, review_status,
            geo_hierarchy, parsed_at, overall_confidence, event_date
          )
          VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, NOW(), $7, $8::date)
          ON CONFLICT DO NOTHING
        `, [
          tweet.id,
          tweet.parsed?.event_type || 'बैठक',
          JSON.stringify(tweet.parsed?.locations || []),
          tweet.needs_review || false,
          tweet.review_status || 'approved',
          JSON.stringify(geoHierarchy),
          tweet.confidence || 0.9,
          tweet.parsed?.event_date || new Date().toISOString().split('T')[0]
        ]);
      }
    }

    console.log('✅ Test data setup complete');
    await pool.end();
  } catch (error) {
    console.error('Error setting up test data:', error);
    await pool.end();
    process.exit(1);
  }
}

setupTestData();

