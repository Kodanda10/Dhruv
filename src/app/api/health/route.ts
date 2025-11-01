/**
 * Health Check Endpoint
 * 
 * Returns system health metrics including:
 * - Database connection pool status
 * - Recent Ollama call count
 * - Validation queue size
 */

import { NextResponse } from 'next/server';
import { getDBPool } from '@/lib/db/pool';

// Track Ollama calls (in production, use Redis or shared state)
let ollamaCallCount = 0;
let lastOllamaCall = Date.now();

// Track validation queue size
let validationQueueSize = 0;

/**
 * Increment Ollama call counter (called from langgraph-assistant)
 */
export function recordOllamaCall(): void {
  ollamaCallCount++;
  lastOllamaCall = Date.now();
}

/**
 * Update validation queue size (called from langgraph-assistant)
 */
export function updateValidationQueue(size: number): void {
  validationQueueSize = size;
}

export async function GET() {
  try {
    const pool = getDBPool();
    
    // Get active database connections
    const dbStats = await pool.query(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid != pg_backend_pid()
    `).catch(() => ({
      rows: [{
        total_connections: 'unknown',
        active_connections: 'unknown',
        idle_connections: 'unknown'
      }]
    }));

    const stats = dbStats.rows[0];

    // Reset Ollama count if it's been more than 1 minute since last call
    if (Date.now() - lastOllamaCall > 60000) {
      ollamaCallCount = 0;
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      dbConnections: {
        total: parseInt(stats.total_connections) || 0,
        active: parseInt(stats.active_connections) || 0,
        idle: parseInt(stats.idle_connections) || 0,
        poolMax: pool.totalCount || 10,
        poolActive: pool.totalCount || 0,
        poolIdle: pool.idleCount || 0
      },
      ollamaCalls: {
        recent: ollamaCallCount,
        lastCall: lastOllamaCall > 0 ? new Date(lastOllamaCall).toISOString() : null
      },
      validationQueue: validationQueueSize,
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
