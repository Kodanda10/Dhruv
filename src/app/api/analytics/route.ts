import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/utils/logger';
import { getPool } from '../parsed-events/pool-helper';

export async function GET(request: NextRequest) {
  try {
    // PRIMARY: Try to read from database first
    try {
      const pool = getPool();
      const result = await pool.query(`
        SELECT 
          pe.*,
          rt.text as tweet_text,
          rt.created_at as tweet_created_at,
          rt.author_handle
        FROM parsed_events pe
        LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
        ORDER BY rt.created_at DESC
      `);
      
      if (result.rows && result.rows.length > 0) {
        const tweets = result.rows
          .map((row: any) => ({
            id: row.tweet_id,
            tweet_id: row.tweet_id,
            event_type: row.event_type,
            locations: row.locations || [],
            schemes_mentioned: row.schemes_mentioned || [],
            people_mentioned: row.people_mentioned || [],
            organizations: row.organizations || [],
            event_date: row.event_date,
            timestamp: row.tweet_created_at,
            parsed_at: row.created_at,
            content: row.tweet_text,
            text: row.tweet_text,
            review_status: row.review_status || 'pending',
            parsed: {
              event_type: row.event_type,
              locations: row.locations || [],
              schemes: row.schemes_mentioned || [],
            },
          }))
          // Exclude skipped items from analytics - they should not be part of analysis
          .filter((t: any) => t.review_status !== 'skipped');
        
        logger.info(`Loaded ${tweets.length} tweets from database for analytics (skipped items excluded)`);
        
        // Generate comprehensive analytics from database data
        const analytics = {
          total_tweets: tweets.length,
          event_distribution: aggregateEventTypes(tweets),
          location_distribution: aggregateLocations(tweets),
          scheme_usage: aggregateSchemes(tweets),
          timeline: aggregateByDate(tweets),
          day_of_week: aggregateByDayOfWeek(tweets),
          top_locations: getTopLocations(tweets),
          top_schemes: getTopSchemes(tweets),
          recent_activity: getRecentActivity(tweets)
        };
        
        logger.info('Analytics generated from database:', {
          total_tweets: analytics.total_tweets,
          event_types: Object.keys(analytics.event_distribution).length,
          locations: Object.keys(analytics.location_distribution).length,
          schemes: Object.keys(analytics.scheme_usage).length
        });
        
        return NextResponse.json({ 
          success: true, 
          analytics, 
          raw_data: tweets.slice(0, 10), // Return first 10 for preview
          source: 'database',
          message: `Analytics data loaded successfully from ${tweets.length} tweets in database`
        });
      }
    } catch (dbError) {
      logger.error('Database read failed:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error',
        analytics: null,
        source: 'error'
      }, { status: 500 });
    }
    
    // No static data fallback - return error if database fails
    return NextResponse.json({
      success: false,
      error: 'No data available from database',
      analytics: null,
      source: 'empty'
    }, { status: 404 });
    
  } catch (error) {
    console.error('Error generating analytics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate analytics',
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
    const evt = t.event_type || t.parsed?.event_type || 'Unknown';
    const hindiEventType = translateEventTypeToHindi(evt);
    counts[hindiEventType] = (counts[hindiEventType] || 0) + 1;
  });
  return counts;
}

function translateEventTypeToHindi(eventType: string): string {
  const translations: Record<string, string> = {
    'birthday_wishes': 'जन्मदिन शुभकामनाएं',
    'scheme_announcement': 'योजना घोषणा',
    'other': 'अन्य',
    'condolence': 'शोक संदेश',
    'event': 'घटना',
    'rally': 'रैली',
    'meeting': 'बैठक',
    'inauguration': 'उद्घाटन',
    'ceremony': 'समारोह',
    'कार्यक्रम': 'कार्यक्रम',
    'शिलान्यास': 'शिलान्यास',
    'Unknown': 'अज्ञात'
  };
  
  return translations[eventType] || eventType;
}

function aggregateLocations(tweets: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  tweets.forEach(t => {
    const locations = t.locations || t.parsed?.locations || [];
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
    const schemes = t.schemes_mentioned || t.schemes || t.parsed?.schemes || [];
    if (Array.isArray(schemes)) {
      schemes.forEach((scheme: string) => {
        if (scheme) {
          counts[scheme] = (counts[scheme] || 0) + 1;
        }
      });
    }
  });
  return counts;
}

function aggregateByDate(tweets: any[]): any[] {
  const dateCounts: Record<string, number> = {};
  tweets.forEach(t => {
    const date = t.event_date || t.date || t.parsed_at || t.timestamp;
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
    const date = t.event_date || t.date || t.parsed_at || t.timestamp;
    if (date) {
      const dayOfWeek = dayNames[new Date(date).getDay()];
      counts[dayOfWeek] = (counts[dayOfWeek] || 0) + 1;
    }
  });
  
  return counts;
}

function getTopLocations(tweets: any[]): any[] {
  const locationCounts = aggregateLocations(tweets);
  const total = tweets.length;
  
  return Object.entries(locationCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100 * 10) / 10
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function getTopSchemes(tweets: any[]): any[] {
  const schemeCounts = aggregateSchemes(tweets);
  const total = tweets.length;
  
  return Object.entries(schemeCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100 * 10) / 10
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function getRecentActivity(tweets: any[]): any[] {
  return tweets
    .sort((a, b) => new Date(b.timestamp || b.parsed_at || b.date).getTime() - new Date(a.timestamp || a.parsed_at || a.date).getTime())
    .slice(0, 5)
    .map(tweet => ({
      id: tweet.id || tweet.tweet_id,
      content: tweet.content || tweet.text,
      event_type: tweet.event_type || tweet.parsed?.event_type,
      locations: tweet.locations || tweet.parsed?.locations || [],
      timestamp: tweet.timestamp || tweet.parsed_at || tweet.date
    }));
}

function generateTimelineData(): any[] {
  const data = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    data.push({
      date: dateStr,
      count: Math.floor(Math.random() * 5) + 1
    });
  }
  
  return data;
}

function generateRecentActivity(): any[] {
  return [
    {
      id: '1979074268907606480',
      content: 'छत्तीसगढ़ के विभिन्न निगम, मंडल, आयोग और बोर्ड के अध्यक्ष एवं उपाध्यक्ष को राज्य शासन द्वारा मंत्री एवं राज्यमंत्री का दर्जा प्रदान किया गया है।',
      event_type: 'घोषणा',
      locations: ['छत्तीसगढ़'],
      timestamp: '2024-01-15T10:30:00Z'
    },
    {
      id: '1979049036633010349',
      content: 'राज्य के विकास के लिए नई योजनाएं शुरू की गई हैं। PM Kisan और Ayushman Bharat योजनाओं की घोषणा की गई।',
      event_type: 'कार्यक्रम',
      locations: ['रायपुर'],
      timestamp: '2024-01-14T14:20:00Z'
    },
    {
      id: '1979023456789012345',
      content: 'युवाओं के लिए नए अवसर सृजित करने के लिए काम कर रहे हैं। आज बिलासपुर में युवा उद्यमिता कार्यक्रम का आयोजन किया।',
      event_type: 'कार्यक्रम',
      locations: ['बिलासपुर'],
      timestamp: '2024-01-13T16:45:00Z'
    }
  ];
}
