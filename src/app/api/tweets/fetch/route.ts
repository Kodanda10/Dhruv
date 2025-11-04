import { NextRequest, NextResponse } from 'next/server';
import { TwitterClient } from '@/lib/twitter-client';

/**
 * API endpoint to fetch latest tweets from Twitter/X API
 * 
 * GET /api/tweets/fetch?username=OPChoudhary_Ind&count=5
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || 'OPChoudhary_Ind';
    const count = parseInt(searchParams.get('count') || '5');

    // Validate count
    if (count < 1 || count > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Count must be between 1 and 100',
        },
        { status: 400 }
      );
    }

    // Initialize Twitter client
    const client = new TwitterClient();

    // Fetch latest tweets
    const tweets = await client.fetchLatestTweets(username, count);

    return NextResponse.json({
      success: true,
      data: tweets,
      total: tweets.length,
      username,
      source: 'twitter_api',
    });
  } catch (error) {
    console.error('Error fetching tweets from Twitter API:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('Rate limit') ? 429 :
                      errorMessage.includes('credentials') ? 401 :
                      errorMessage.includes('not found') ? 404 : 500;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tweets from Twitter API',
        details: errorMessage,
      },
      { status: statusCode }
    );
  }
}

