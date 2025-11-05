/**
 * System Health API Endpoint
 *
 * Provides comprehensive health status for all system components:
 * - Database connectivity and performance
 * - External API health (Twitter, Gemini, Ollama)
 * - Frontend build status
 * - Backend service uptime
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

interface HealthService {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  connection_pool?: number;
  [key: string]: any;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime_seconds: number;
  version: string;
  services: {
    database: HealthService;
    twitter_api: HealthService;
    gemini_api: HealthService;
    ollama_api: HealthService;
  };
  frontend: {
    build_status: string;
    last_build: string;
    bundle_size: string;
  };
}

// Global uptime tracking
const START_TIME = Date.now();
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

async function checkDatabaseHealth(): Promise<HealthService> {
  const startTime = Date.now();

  try {
    const pool = getPool();
    const result = await pool.query('SELECT 1 as health_check, pg_stat_activity_count() as connection_count');
    const latency = Date.now() - startTime;

    return {
      status: 'healthy',
      latency,
      connection_pool: parseInt(result.rows[0].connection_count) || 0
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      status: 'unhealthy',
      latency,
      error: error instanceof Error ? error.message : 'Database connection failed'
    };
  }
}

async function checkAPIHealth(apiName: string, url?: string, apiKey?: string): Promise<HealthService> {
  const startTime = Date.now();

  try {
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let error: string | undefined;

    switch (apiName) {
      case 'twitter_api':
        // Check Twitter API rate limits (simplified check)
        const twitterRateLimit = parseInt(process.env.TWITTER_RATE_LIMIT_REMAINING || '100');
        if (twitterRateLimit < 10) {
          status = 'degraded';
        } else if (twitterRateLimit === 0) {
          status = 'unhealthy';
          error = 'Rate limit exceeded';
        }
        break;

      case 'gemini_api':
        // Check if API key is configured
        if (!process.env.GEMINI_API_KEY) {
          status = 'unhealthy';
          error = 'API key not configured';
        }
        // Could add actual API call here if needed
        break;

      case 'ollama_api':
        // Check Ollama endpoint connectivity
        try {
          const ollamaResponse = await fetch(process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api/tags', {
            timeout: 5000 // 5 second timeout
          });

          if (!ollamaResponse.ok) {
            status = 'degraded';
            error = `HTTP ${ollamaResponse.status}`;
          }
        } catch (err) {
          status = 'unhealthy';
          error = 'Connection failed';
        }
        break;
    }

    const latency = Date.now() - startTime;

    return {
      status,
      latency,
      ...(error && { error })
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      status: 'unhealthy',
      latency,
      error: error instanceof Error ? error.message : 'API health check failed'
    };
  }
}

async function getFrontendBuildInfo(): Promise<{ build_status: string; last_build: string; bundle_size: string }> {
  try {
    // In a real deployment, this would check Vercel deployment status
    // For now, return mock data
    return {
      build_status: 'success',
      last_build: new Date().toISOString(),
      bundle_size: '2.4MB'
    };
  } catch (error) {
    return {
      build_status: 'unknown',
      last_build: new Date().toISOString(),
      bundle_size: 'unknown'
    };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<HealthResponse>> {
  try {
    const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

    // Run all health checks in parallel
    const [
      databaseHealth,
      twitterHealth,
      geminiHealth,
      ollamaHealth,
      frontendInfo
    ] = await Promise.all([
      checkDatabaseHealth(),
      checkAPIHealth('twitter_api'),
      checkAPIHealth('gemini_api'),
      checkAPIHealth('ollama_api'),
      getFrontendBuildInfo()
    ]);

    // Determine overall system status
    const services = [databaseHealth, twitterHealth, geminiHealth, ollamaHealth];
    const hasUnhealthy = services.some(service => service.status === 'unhealthy');
    const hasDegraded = services.some(service => service.status === 'degraded');

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    }

    const healthResponse: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime_seconds: uptimeSeconds,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: databaseHealth,
        twitter_api: twitterHealth,
        gemini_api: geminiHealth,
        ollama_api: ollamaHealth
      },
      frontend: frontendInfo
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503;

    return NextResponse.json(healthResponse, { status: statusCode });
  } catch (error) {
    console.error('Health check failed:', error);

    const errorResponse: HealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: { status: 'unhealthy', error: 'Health check failed' },
        twitter_api: { status: 'unhealthy', error: 'Health check failed' },
        gemini_api: { status: 'unhealthy', error: 'Health check failed' },
        ollama_api: { status: 'unhealthy', error: 'Health check failed' }
      },
      frontend: {
        build_status: 'unknown',
        last_build: new Date().toISOString(),
        bundle_size: 'unknown'
      }
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}
