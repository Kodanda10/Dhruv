import { Pool } from 'pg';

// Lazy initialization for testability
let poolInstance: Pool | null = null;

export function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'dhruv_db',
      user: process.env.DB_USER || 'dhruv_user',
      password: process.env.DB_PASSWORD || 'dhruv_pass',
    });
  }
  return poolInstance;
}

// Export for testing
export const resetPool = () => { poolInstance = null; };

