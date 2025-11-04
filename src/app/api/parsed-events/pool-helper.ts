import { Pool } from 'pg';
import { logger } from '@/lib/utils/logger';

// Lazy initialization for testability
let poolInstance: Pool | null = null;

export function getPool(): Pool {
  if (!poolInstance) {
    // PRIMARY: Use DATABASE_URL (standard for Vercel, production, etc.)
    // FALLBACK: Use individual DB_* env vars for local development
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      // Parse DATABASE_URL and configure pool
      poolInstance = new Pool({
        connectionString: databaseUrl,
        // SSL is required for most cloud databases (Vercel Postgres, etc.)
        ssl: process.env.NODE_ENV === 'production' || databaseUrl.includes('sslmode=require') 
          ? { rejectUnauthorized: false } 
          : false,
      });
      logger.info('Database pool initialized with DATABASE_URL');
    } else {
      // Fallback to individual env vars for local development
      poolInstance = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'dhruv_db',
        user: process.env.DB_USER || 'dhruv_user',
        password: process.env.DB_PASSWORD || 'dhruv_pass',
        ssl: false, // Local development typically doesn't need SSL
      });
      logger.info('Database pool initialized with individual DB_* env vars');
    }
    
    // Add error handlers
    poolInstance.on('error', (err) => {
      logger.error('Unexpected database pool error:', err);
    });
    
    poolInstance.on('connect', () => {
      logger.debug('New database connection established');
    });
  }
  return poolInstance;
}

// Export for testing
export const resetPool = () => { poolInstance = null; };


