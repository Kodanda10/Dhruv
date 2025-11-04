/**
 * Three-Layer Consensus Parsing API Endpoint
 * Provides SOTA parsing with Gemini, Ollama, and Regex consensus
 */

import { NextRequest, NextResponse } from 'next/server';
import { ThreeLayerConsensusEngine } from '@/lib/parsing/three-layer-consensus-engine';
import { RateLimiter } from '@/lib/parsing/rate-limiter';
import { logger } from '@/lib/utils/logger';

// Global instances (lazy initialization)
let engine: ThreeLayerConsensusEngine | null = null;
let rateLimiter: RateLimiter | null = null;

function getEngine(): ThreeLayerConsensusEngine {
  if (!engine) {
    if (!rateLimiter) {
      rateLimiter = new RateLimiter({
        geminiRPM: parseInt(process.env.GEMINI_RPM || '10'),
        ollamaRPM: parseInt(process.env.OLLAMA_RPM || '60'),
        maxRetries: 3,
        backoffMultiplier: 2,
        initialBackoffMs: 1000
      });
    }

    engine = new ThreeLayerConsensusEngine({
      rateLimiter,
      consensusThreshold: 2, // 2/3 majority
      enableFallback: true,
      logLevel: 'info',
      geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      ollamaModel: process.env.OLLAMA_MODEL || 'gemma2:2b'
    });
  }
  return engine;
}

export async function POST(request: NextRequest) {
  try {
    const { text, tweetId, tweetDate } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    logger.info(`Starting three-layer parsing for tweet: ${tweetId || 'unknown'}`);

    const engine = getEngine();
    const parsedDate = tweetDate ? new Date(tweetDate) : new Date();

    const result = await engine.parseTweet(text, tweetId || 'api-call', parsedDate);

    logger.info(`Three-layer parsing completed for ${tweetId || 'unknown'}: ${result.event_type} (confidence: ${(result.overall_confidence * 100).toFixed(1)}%)`);

    return NextResponse.json({
      success: true,
      result,
      metadata: {
        layers_used: result.layers_used,
        consensus_score: result.consensus_score,
        needs_review: result.needs_review,
        parsed_at: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Three-layer parsing API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Parsing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!rateLimiter) {
      rateLimiter = new RateLimiter({
        geminiRPM: 10,
        ollamaRPM: 60,
        maxRetries: 3,
        backoffMultiplier: 2,
        initialBackoffMs: 1000
      });
    }

    const status = rateLimiter.getStatus();

    return NextResponse.json({
      success: true,
      status: 'operational',
      rate_limits: status,
      models: {
        gemini: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        ollama: process.env.OLLAMA_MODEL || 'gemma2:2b'
      },
      config: {
        consensus_threshold: 2,
        gemini_available: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
        ollama_available: true // Assume running locally
      }
    });

  } catch (error) {
    logger.error('Status check error:', error);
    return NextResponse.json(
      { success: false, error: 'Status check failed' },
      { status: 500 }
    );
  }
}
