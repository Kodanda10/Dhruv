import { NextRequest, NextResponse } from 'next/server';
import { ThreeLayerConsensusEngine, TweetData } from '@/lib/parsing/three-layer-consensus-engine';

let consensusEngine: ThreeLayerConsensusEngine | null = null;

async function getConsensusEngine(): Promise<ThreeLayerConsensusEngine> {
  if (!consensusEngine) {
    consensusEngine = new ThreeLayerConsensusEngine();
    await consensusEngine.initialize();
  }
  return consensusEngine;
}

interface ParsingRequest {
  tweet_id: string;
  tweet_text: string;
  created_at: string;
  author_handle: string;
}

interface ParsingResponse {
  success: boolean;
  result?: any;
  error?: string;
  processing_time_ms: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: ParsingRequest = await request.json();
    const { tweet_id, tweet_text, created_at, author_handle } = body;

    if (!tweet_text) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'tweet_text is required',
          processing_time_ms: Date.now() - startTime
        },
        { status: 400 }
      );
    }

    const tweetData: TweetData = {
      tweet_id,
      tweet_text,
      created_at,
      author_handle,
    };

    const engine = await getConsensusEngine();
    const result = await engine.parseTweet(tweetData);

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      result: {
        tweet_id,
        parsed_data: result.final_result,
        consensus_analysis: {
          consensus_score: result.consensus_score,
          agreement_level: result.agreement_level,
          conflicts: result.conflicts,
          geo_hierarchy_resolved: result.geo_hierarchy_resolved,
        },
        layer_results: result.layer_results,
        processing_time_ms: processingTime,
      },
      processing_time_ms: processingTime,
    });

  } catch (error) {
    console.error('Three-layer consensus parsing error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tweetText = searchParams.get('tweet_text');
  
  if (!tweetText) {
    return NextResponse.json(
      { error: 'tweet_text parameter is required' },
      { status: 400 }
    );
  }

  try {
    const tweetData: TweetData = {
      tweet_id: 'test_' + Date.now(),
      tweet_text: tweetText,
      created_at: new Date().toISOString(),
      author_handle: 'test_user',
    };

    const engine = await getConsensusEngine();
    const result = await engine.parseTweet(tweetData);
    
    return NextResponse.json({
      tweet_text: tweetText,
      result: result.final_result,
      consensus_score: result.consensus_score,
      agreement_level: result.agreement_level,
      conflicts: result.conflicts,
    });

  } catch (error) {
    console.error('Three-layer consensus GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error during parsing' },
      { status: 500 }
    );
  }
}
