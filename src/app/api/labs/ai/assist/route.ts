import { NextRequest, NextResponse } from 'next/server';
import { getAIAssistant } from '@/lib/ai-assistant/langgraph-assistant';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { tweet_id, text, entities } = body;

    if (!text || !tweet_id) {
      return NextResponse.json(
        { success: false, error: 'tweet_id and text are required' },
        { status: 400 }
      );
    }

    // Get AI assistant instance
    const assistant = getAIAssistant();

    // Convert to TweetData format
    const tweetData = {
      tweet_id: String(tweet_id),
      text: String(text),
      event_type: entities?.event_type || '',
      locations: entities?.locations || [],
      people_mentioned: entities?.people_mentioned || [],
      organizations: entities?.organizations || [],
      schemes_mentioned: entities?.schemes_mentioned || [],
    };

    // Generate suggestions
    const aiSuggestion = await assistant.generateSuggestions(tweetData);

    const latency = Date.now() - startTime;

    if (!aiSuggestion || typeof aiSuggestion !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid AI response',
          latency_ms: latency,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      suggestions: aiSuggestion,
      latency_ms: latency,
      token_usage: {
        // Note: Token usage tracking would need to be added to LangGraphAIAssistant
        estimated: 'N/A',
      },
    });
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'AI assistant request failed',
        latency_ms: latency,
      },
      { status: 500 }
    );
  }
}

