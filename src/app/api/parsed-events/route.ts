import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getPool } from './pool-helper';
import { logger } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200');
    const needsReview = searchParams.get('needs_review');
    const reviewStatus = searchParams.get('review_status');
    const includeAnalytics = searchParams.get('analytics') === 'true';
    
    // Build query with proper parameter binding (PRIMARY: Database)
    let query = `
      SELECT 
        pe.*,
        rt.text as tweet_text,
        rt.created_at as tweet_created_at,
        rt.author_handle,
        rt.retweet_count,
        rt.reply_count,
        rt.like_count,
        rt.quote_count,
        rt.hashtags,
        rt.mentions,
        rt.urls
      FROM parsed_events pe
      LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (needsReview === 'true') {
      query += ' AND pe.needs_review = true';
    } else if (needsReview === 'false' || includeAnalytics) {
      // For analytics, only approved tweets
      query += ` AND pe.needs_review = false AND pe.review_status = $${paramIndex}`;
      params.push('approved');
      paramIndex++;
    }
    
    if (reviewStatus && !includeAnalytics) {
      query += ` AND pe.review_status = $${paramIndex}`;
      params.push(reviewStatus);
      paramIndex++;
    }
    
    query += ' ORDER BY pe.parsed_at DESC';
    
    if (limit && !includeAnalytics) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
    }
    
    try {
      const pool = getPool();
      const result = await pool.query(query, params);
      
      if (includeAnalytics) {
        // Return aggregated analytics data
        const analytics = {
          total_tweets: result.rows.length,
          event_distribution: aggregateEventTypes(result.rows),
          location_distribution: aggregateLocations(result.rows),
          scheme_usage: aggregateSchemes(result.rows),
          timeline: aggregateByDate(result.rows),
          day_of_week: aggregateByDayOfWeek(result.rows)
        };
        
        return NextResponse.json({ 
          success: true, 
          analytics, 
          raw_data: result.rows,
          source: 'database'
        });
      }
      
      // Map database results to dashboard format
      const mappedTweets = result.rows.map((row: any) => ({
        id: row.tweet_id,
        tweet_id: row.tweet_id,
        parsedEventId: row.id,
        content: row.tweet_text || '',
        text: row.tweet_text || '',
        timestamp: row.tweet_created_at || row.parsed_at,
        created_at: row.tweet_created_at || row.parsed_at,
        event_type: row.event_type || 'other',
        event_type_confidence: parseFloat(row.event_type_confidence || '0'),
        event_date: row.event_date,
        date_confidence: parseFloat(row.date_confidence || '0'),
        locations: Array.isArray(row.locations) ? row.locations : (typeof row.locations === 'object' && row.locations !== null ? [row.locations] : []),
        people_mentioned: row.people_mentioned || [],
        organizations: row.organizations || [],
        schemes_mentioned: row.schemes_mentioned || [],
        overall_confidence: parseFloat(row.overall_confidence || '0'),
        needs_review: row.needs_review || false,
        review_status: row.review_status || 'pending',
        parsed_at: row.parsed_at,
        parsed_by: row.parsed_by || 'system',
        // Additional tweet metadata
        author_handle: row.author_handle,
        retweet_count: row.retweet_count || 0,
        reply_count: row.reply_count || 0,
        like_count: row.like_count || 0,
        quote_count: row.quote_count || 0,
        hashtags: row.hashtags || [],
        mentions: row.mentions || [],
        urls: row.urls || []
      }));
      
      return NextResponse.json({
        success: true,
        data: mappedTweets,
        events: mappedTweets, // For backward compatibility
        total: result.rows.length,
        returned: mappedTweets.length,
        source: 'database'
      });
      
    } catch (dbError) {
      logger.error('Database query failed, falling back to static file:', dbError);
      // Continue to fallback below
    }
    
    // Fallback: Try to read from parsed_tweets.json
    const dataPath = path.join(process.cwd(), 'data', 'parsed_tweets.json');
    
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, 'utf8');
      const tweets = JSON.parse(fileContent);
      
      logger.info(`Loaded ${tweets.length} tweets from parsed_tweets.json`);
      
      // Filter based on parameters
      let filteredTweets = tweets;
      
      if (needsReview === 'true') {
        filteredTweets = tweets.filter((t: any) => t.needs_review === true);
      } else if (needsReview === 'false' || includeAnalytics) {
        // For analytics, use all tweets; for regular requests, use all tweets too
        filteredTweets = tweets;
      }
      
      if (reviewStatus && !includeAnalytics) {
        filteredTweets = filteredTweets.filter((t: any) => t.review_status === reviewStatus);
      }
      
      // Limit the results
      const limitedTweets = filteredTweets.slice(0, limit);
      
      if (includeAnalytics) {
        const analytics = {
          total_tweets: limitedTweets.length,
          event_distribution: aggregateEventTypes(limitedTweets),
          location_distribution: aggregateLocations(limitedTweets),
          scheme_usage: aggregateSchemes(limitedTweets),
          timeline: aggregateByDate(limitedTweets),
          day_of_week: aggregateByDayOfWeek(limitedTweets)
        };
        
        return NextResponse.json({
          success: true,
          analytics,
          raw_data: limitedTweets,
          source: 'static_file'
        });
      }
      
      // Map tweets to the format expected by the dashboard
      const mappedTweets = limitedTweets.map((tweet: any) => ({
        id: tweet.id,
        tweet_id: tweet.id,
        content: tweet.content,
        text: tweet.content,
        timestamp: tweet.timestamp,
        created_at: tweet.timestamp,
        event_type: tweet.parsed?.event_type || tweet.event_type,
        locations: tweet.parsed?.locations || tweet.locations || [],
        people_mentioned: tweet.parsed?.people || tweet.people_mentioned || [],
        organizations: tweet.parsed?.organizations || tweet.organizations || [],
        schemes_mentioned: tweet.parsed?.schemes || tweet.schemes_mentioned || [],
        confidence: tweet.parsed?.confidence || tweet.confidence,
        needs_review: tweet.needs_review || false,
        review_status: tweet.review_status || 'approved',
        parsed_at: tweet.timestamp,
        parsed_by: 'system'
      }));
      
      return NextResponse.json({
        success: true,
        data: mappedTweets,
        total: filteredTweets.length,
        returned: limitedTweets.length,
        source: 'static_file'
      });
    } else {
      // Return empty array if file doesn't exist
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        returned: 0,
        source: 'empty'
      });
    }
  } catch (error) {
    logger.error('Error fetching parsed events:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch parsed events',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions for analytics aggregation
function aggregateEventTypes(tweets: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  tweets.forEach(t => {
    const evt = t.event_type || 'Unknown';
    counts[evt] = (counts[evt] || 0) + 1;
  });
  return counts;
}

function aggregateLocations(tweets: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  tweets.forEach(t => {
    const locations = t.locations || [];
    if (Array.isArray(locations)) {
      locations.forEach((loc: any) => {
        const locationName = typeof loc === 'string' ? loc : loc.name || loc;
        if (locationName) {
          counts[locationName] = (counts[locationName] || 0) + 1;
        }
      });
    }
  });
  return counts;
}

function aggregateSchemes(tweets: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  tweets.forEach(t => {
    const schemes = t.schemes_mentioned || t.schemes || [];
    if (Array.isArray(schemes)) {
      schemes.forEach((scheme: string) => {
        counts[scheme] = (counts[scheme] || 0) + 1;
      });
    }
  });
  return counts;
}

function aggregateByDate(tweets: any[]): any[] {
  const dateCounts: Record<string, number> = {};
  tweets.forEach(t => {
    const date = t.event_date || t.date || t.parsed_at;
    if (date) {
      const dateStr = new Date(date).toISOString().split('T')[0];
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    }
  });
  
  return Object.entries(dateCounts).map(([date, count]) => ({
    date,
    count
  })).sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateByDayOfWeek(tweets: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  tweets.forEach(t => {
    const date = t.event_date || t.date || t.parsed_at;
    if (date) {
      const dayOfWeek = dayNames[new Date(date).getDay()];
      counts[dayOfWeek] = (counts[dayOfWeek] || 0) + 1;
    }
  });
  
  return counts;
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;
    
    if (!id || !updates) {
      return NextResponse.json(
        { success: false, error: 'Missing id or updates' },
        { status: 400 }
      );
    }
    
    // Read current data
    const dataPath = path.join(process.cwd(), 'data', 'parsed_tweets.json');
    
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, 'utf8');
      const tweets = JSON.parse(fileContent);
      
      // Find and update the tweet
      const tweetIndex = tweets.findIndex((tweet: any) => tweet.id === id);
      
      if (tweetIndex !== -1) {
        tweets[tweetIndex] = { ...tweets[tweetIndex], ...updates };
        
        // Write back to file
        fs.writeFileSync(dataPath, JSON.stringify(tweets, null, 2));
        
        return NextResponse.json({
          success: true,
          data: tweets[tweetIndex]
        });
      } else {
        return NextResponse.json(
          { success: false, error: 'Tweet not found' },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Data file not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    logger.error('Error updating parsed event:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update parsed event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
