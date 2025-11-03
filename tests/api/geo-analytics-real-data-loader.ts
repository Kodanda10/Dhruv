/**
 * Utility to load real data from parsed_tweets.json into database
 * for geo-analytics testing
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface ParsedTweet {
  id: string;
  timestamp: string;
  content: string;
  parsed: {
    event_type: string;
    locations: Array<{ name: string; confidence: number }>;
    event_date?: string;
  };
  confidence: number;
  needs_review: boolean;
  review_status: string;
}

/**
 * Generate geo_hierarchy from location name
 * This simulates how the parsing engine creates geo_hierarchy from locations
 */
function generateGeoHierarchy(locationName: string): any[] {
  // Common district names in Chhattisgarh
  const districts = ['रायपुर', 'बिलासपुर', 'दुर्ग', 'राजनांदगाँव', 'दंतेवाड़ा', 'बस्तर', 'जगदलपुर', 'कोरबा', 'रायगढ़', 'अंबिकापुर'];
  
  const district = districts.find(d => locationName.includes(d) || locationName === d) || 'रायपुर';
  
  // Urban districts get ULB, rural get gram_panchayat
  const isUrban = ['रायपुर', 'बिलासपुर', 'दुर्ग', 'राजनांदगाँव'].includes(district);
  
  const geoHierarchy = [{
    village: locationName === district ? (district === 'रायपुर' ? 'पंडरी' : 'तखतपुर') : locationName,
    gram_panchayat: isUrban ? null : (district === 'बिलासपुर' ? 'बिलासपुर' : null),
    ulb: isUrban ? `${district} नगर निगम` : null,
    ward_no: isUrban ? String(Math.floor(Math.random() * 50) + 1) : null,
    block: district,
    assembly: `${district} ${isUrban ? 'शहर' : ''} उत्तर`,
    district: district,
    is_urban: String(isUrban),
    confidence: 0.9
  }];
  
  return geoHierarchy;
}

/**
 * Load real parsed tweets from JSON file
 */
export function loadParsedTweets(): ParsedTweet[] {
  const tweetsPath = path.join(process.cwd(), 'data', 'parsed_tweets.json');
  
  if (!fs.existsSync(tweetsPath)) {
    console.warn('parsed_tweets.json not found at:', tweetsPath);
    return [];
  }
  
  try {
    const content = fs.readFileSync(tweetsPath, 'utf8');
    return JSON.parse(content) as ParsedTweet[];
  } catch (error) {
    console.error('Error loading parsed_tweets.json:', error);
    return [];
  }
}

/**
 * Setup real test data in database from parsed_tweets.json
 */
export async function setupRealTestData(pool: Pool, limit: number = 100): Promise<number> {
  const tweets = loadParsedTweets();
  
  if (tweets.length === 0) {
    console.warn('No tweets found in parsed_tweets.json');
    return 0;
  }
  
  // Filter approved tweets that have locations
  const validTweets = tweets
    .filter(tweet => 
      tweet.review_status === 'approved' && 
      !tweet.needs_review &&
      tweet.parsed?.locations && 
      tweet.parsed.locations.length > 0
    )
    .slice(0, limit);
  
  let inserted = 0;
  
  for (const tweet of validTweets) {
    try {
      const location = tweet.parsed.locations[0];
      const geoHierarchy = generateGeoHierarchy(location.name);
      
      // Insert raw_tweet first
      await pool.query(`
        INSERT INTO raw_tweets (tweet_id, text, created_at, author_handle, processing_status)
        VALUES ($1, $2, $3::timestamp, 'real_data', 'parsed')
        ON CONFLICT (tweet_id) DO UPDATE SET text = EXCLUDED.text
      `, [tweet.id, tweet.content, tweet.timestamp]);
      
      // Insert parsed_event with geo_hierarchy
      await pool.query(`
        INSERT INTO parsed_events (
          tweet_id, 
          event_type, 
          locations, 
          needs_review, 
          review_status,
          geo_hierarchy, 
          parsed_at, 
          overall_confidence,
          event_date
        )
        VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7::timestamp, $8, $9::date)
        ON CONFLICT (tweet_id) 
        DO UPDATE SET 
          geo_hierarchy = EXCLUDED.geo_hierarchy,
          review_status = EXCLUDED.review_status,
          needs_review = EXCLUDED.needs_review
      `, [
        tweet.id,
        tweet.parsed.event_type || 'other',
        JSON.stringify(tweet.parsed.locations || []),
        tweet.needs_review || false,
        tweet.review_status || 'approved',
        JSON.stringify(geoHierarchy),
        tweet.timestamp,
        tweet.confidence || 0.8,
        tweet.parsed.event_date || tweet.timestamp.split('T')[0]
      ]);
      
      inserted++;
    } catch (error) {
      console.warn(`Error inserting tweet ${tweet.id}:`, error);
    }
  }
  
  console.log(`✅ Inserted ${inserted} real tweets from parsed_tweets.json`);
  return inserted;
}

/**
 * Get test data summary from database
 */
export async function getTestDataSummary(pool: Pool) {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN geo_hierarchy IS NOT NULL THEN 1 END) as with_geo,
        COUNT(DISTINCT geo->>'district') as districts,
        COUNT(DISTINCT geo->>'assembly') as assemblies
      FROM parsed_events pe
      LEFT JOIN jsonb_array_elements(COALESCE(pe.geo_hierarchy, '[]'::jsonb)) AS geo ON true
      WHERE pe.review_status = 'approved' 
        AND pe.needs_review = false
    `);
    
    return {
      total: parseInt(result.rows[0].total) || 0,
      with_geo: parseInt(result.rows[0].with_geo) || 0,
      districts: parseInt(result.rows[0].districts) || 0,
      assemblies: parseInt(result.rows[0].assemblies) || 0
    };
  } catch (error) {
    console.warn('Error getting test data summary:', error);
    return { total: 0, with_geo: 0, districts: 0, assemblies: 0 };
  }
}



