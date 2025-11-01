/**
 * Shared Database Pool Module
 * 
 * Prevents database connection pool leaks by maintaining a single shared pool
 * across all DynamicLearningSystem and AIAssistantTools instances.
 * 
 * Usage:
 *   import { getDBPool, closeDBPool } from '@/lib/db/pool';
 *   const pool = getDBPool();
 */

import { Pool } from 'pg';

let pool: Pool | null = null;

/**
 * Get or create the shared database pool
 * This ensures all instances reuse the same connection pool
 */
export function getDBPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10, // Control concurrency - prevent connection exhaustion
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }

  return pool;
}

/**
 * Close the shared pool (useful for testing or graceful shutdown)
 */
export async function closeDBPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

