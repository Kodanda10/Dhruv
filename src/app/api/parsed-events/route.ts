import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dhruv_db',
  user: process.env.DB_USER || 'dhruv_user',
  password: process.env.DB_PASSWORD || 'dhruv_pass',
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200');
    const needsReview = searchParams.get('needs_review');
    const reviewStatus = searchParams.get('review_status');
    const includeAnalytics = searchParams.get('analytics') === 'true';
    
    // Build query based on parameters
    let query = 'SELECT * FROM parsed_events WHERE 1=1';
    const params = [];
    
    if (needsReview === 'true') {
      query += ' AND needs_review = true';
    } else if (needsReview === 'false' || includeAnalytics) {
      // For analytics, only approved tweets
      query += ' AND needs_review = false AND review_status = $1';
      params.push('approved');
    }
    
    if (reviewStatus && !includeAnalytics) {
      query += ` AND review_status = $${params.length + 1}`;
      params.push(reviewStatus);
    }
    
    query += ' ORDER BY parsed_at DESC';
    
    if (limit && !includeAnalytics) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    
    try {
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
      
      return NextResponse.json({ 
        success: true, 
        data: result.rows,
        total: result.rows.length,
        returned: result.rows.length,
        source: 'database'
      });
    } catch (dbError) {
      console.log('Database query failed, falling back to static file:', dbError);
    }
    
    // Fallback: Try to read from parsed_tweets.json
    const dataPath = path.join(process.cwd(), 'data', 'parsed_tweets.json');
    
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, 'utf8');
      const tweets = JSON.parse(fileContent);
      
      // Filter based on parameters
      let filteredTweets = tweets;
      
      if (needsReview === 'true') {
        filteredTweets = tweets.filter((t: any) => t.needs_review === true);
      } else if (needsReview === 'false' || includeAnalytics) {
        filteredTweets = tweets.filter((t: any) => t.needs_review === false && t.review_status === 'approved');
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
      
      return NextResponse.json({
        success: true,
        data: limitedTweets,
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
    console.error('Error fetching parsed events:', error);
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
    console.error('Error updating parsed event:', error);
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
