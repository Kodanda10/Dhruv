import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200');
    
    // Try to read from parsed_tweets.json
    const dataPath = path.join(process.cwd(), 'data', 'parsed_tweets.json');
    
    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, 'utf8');
      const tweets = JSON.parse(fileContent);
      
      // Limit the results
      const limitedTweets = tweets.slice(0, limit);
      
      return NextResponse.json({
        success: true,
        data: limitedTweets,
        total: tweets.length,
        returned: limitedTweets.length
      });
    } else {
      // Return empty array if file doesn't exist
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        returned: 0
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
