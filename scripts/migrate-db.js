#!/usr/bin/env node

const { Pool } = require('pg');

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db',
  });

  const client = await pool.connect();

  try {
    console.log('Running database migrations...');

    // Create review_records table
    await client.query(`
      CREATE TABLE IF NOT EXISTS review_records (
        tweet_id TEXT PRIMARY KEY,
        decisions JSONB,
        parser_version TEXT,
        evidence JSONB,
        policy JSONB,
        consensus_meta JSONB,
        status TEXT NOT NULL,
        include_in_analytics BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create review_audit table
    await client.query(`
      CREATE TABLE IF NOT EXISTS review_audit (
        id SERIAL PRIMARY KEY,
        tweet_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload JSONB,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_review_records_status ON review_records(status);
      CREATE INDEX IF NOT EXISTS idx_review_records_include_analytics ON review_records(include_in_analytics);
      CREATE INDEX IF NOT EXISTS idx_review_audit_tweet_id ON review_audit(tweet_id);
      CREATE INDEX IF NOT EXISTS idx_review_audit_created_at ON review_audit(created_at);
    `);

    console.log('✅ Database migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
