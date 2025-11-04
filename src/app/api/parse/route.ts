import { NextRequest, NextResponse } from 'next/server';
import { parseTweetWithGemini, saveParsedTweetToDatabase } from '@/lib/gemini-parser';

export async function POST(request: NextRequest) {
  try {
    const { tweet_id, text } = await request.json();

    if (!tweet_id || !text) {
      return NextResponse.json(
        { success: false, error: 'tweet_id and text are required' },
        { status: 400 }
      );
    }

    // Parse tweet with Gemini
    const parsedData = await parseTweetWithGemini(text, tweet_id);

    // Check if parsing failed
    if (parsedData.error) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Gemini parsing failed: ${parsedData.error}`,
          parsed_tweet: null
        },
        { status: 500 }
      );
    }

    // Save to database
    const savedTweet = await saveParsedTweetToDatabase(tweet_id, parsedData);

    return NextResponse.json({
      success: true,
      parsed_tweet: savedTweet,
      raw_parsed_data: parsedData
    });

  } catch (error) {
    console.error('Parse API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        parsed_tweet: null
      },
      { status: 500 }
    );
  }
}
