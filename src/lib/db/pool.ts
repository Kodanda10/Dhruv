import { Pool } from 'pg';

const baseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production' &&
    !process.env.DATABASE_URL?.includes('localhost')
      ? { rejectUnauthorized: false }
      : undefined,
};

let sharedPool: Pool | null = null;

export function getDbPool(): Pool {
  if (process.env.NODE_ENV === 'test') {
    return new Pool(baseConfig);
  }
  if (!sharedPool) {
    sharedPool = new Pool(baseConfig);
  }
  return sharedPool;
}
