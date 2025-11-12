import { NextRequest, NextResponse } from 'next/server';
import { ThreeLayerConsensusEngine } from '@/lib/parsing/three-layer-consensus-engine';
import { RateLimiter } from '@/lib/parsing/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tweet_id, tweet_text, created_at, author_handle } = body;

    if (!tweet_text || !tweet_text.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Tweet text is required'
      }, { status: 400 });
    }

    // Initialize rate limiter and consensus engine
    const rateLimiter = new RateLimiter({
      geminiRPM: 2,    // Very conservative for Gemini free tier
      ollamaRPM: 30,   // Conservative for Ollama
      maxRetries: 10,
      backoffMultiplier: 2,
      initialBackoffMs: 5000
    });

    const engine = new ThreeLayerConsensusEngine({
      rateLimiter,
      consensusThreshold: 2, // At least 2 layers must agree
      enableFallback: false, // Strict mode - no fallbacks
      logLevel: 'info'
    });

    // Parse the tweet with strict requirements
    const tweetDate = created_at ? new Date(created_at) : new Date();

    const result = await engine.parseTweet(tweet_text, tweet_id || 'unknown', tweetDate);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Three-layer consensus parsing failed:', error.message);

    // Extract failure reason from error message
    let failureReason = 'unknown_error';
    if (error.message.includes('PARSING_FAILED:')) {
      const match = error.message.match(/PARSING_FAILED:\s*(.+)/);
      if (match) {
        failureReason = match[1].split(';')[0].trim();
      }
    }

    return NextResponse.json({
      success: false,
      error: error.message,
      failure_reason: failureReason
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Three-layer consensus parsing endpoint is active',
    requirements: 'All 3 layers (Gemini, Ollama, Regex+FAISS) must succeed for tweet acceptance'
  });
}