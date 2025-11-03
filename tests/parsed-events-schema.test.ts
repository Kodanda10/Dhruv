/**
 * Test: Verify parsed_events table schema
 * 
 * This test ensures that:
 * 1. parsed_events table exists with correct schema
 * 2. All required fields are present
 * 3. Indexes are created for performance
 * 4. Foreign key relationship to raw_tweets exists
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Parsed Events Database Schema', () => {
  const projectRoot = join(__dirname, '..');

  it('should have migration file for parsed_events table', () => {
    const migrationPath = join(projectRoot, 'infra', 'migrations', '002_create_parsed_events.sql');
    expect(existsSync(migrationPath)).toBe(true);
    
    const migration = readFileSync(migrationPath, 'utf-8');
    
    // Should create parsed_events table
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS parsed_events');
    
    // Should have all required fields
    expect(migration).toContain('tweet_id VARCHAR');
    expect(migration).toContain('event_type VARCHAR');
    expect(migration).toContain('event_date DATE');
    expect(migration).toContain('locations JSONB');
    expect(migration).toContain('people_mentioned TEXT[]');
    expect(migration).toContain('organizations TEXT[]');
    expect(migration).toContain('schemes_mentioned TEXT[]');
    expect(migration).toContain('overall_confidence DECIMAL');
    expect(migration).toContain('needs_review BOOLEAN');
    expect(migration).toContain('review_status VARCHAR');
    
    // Should have foreign key to raw_tweets
    expect(migration).toContain('REFERENCES raw_tweets(tweet_id)');
  });

  it('should have indexes for performance', () => {
    const migrationPath = join(projectRoot, 'infra', 'migrations', '002_create_parsed_events.sql');
    const migration = readFileSync(migrationPath, 'utf-8');
    
    // Should have index on tweet_id (foreign key)
    expect(migration).toContain('CREATE INDEX');
    expect(migration).toContain('idx_parsed_events_tweet_id');
    
    // Should have index on event_date for timeline queries
    expect(migration).toContain('idx_parsed_events_date');
    
    // Should have index on review_status for review queue queries
    expect(migration).toContain('idx_parsed_events_review_status');
  });

  it('should have migration runner script', () => {
    const runnerPath = join(projectRoot, 'scripts', 'run_migrations.py');
    expect(existsSync(runnerPath)).toBe(true);
    
    const runner = readFileSync(runnerPath, 'utf-8');
    
    // Should be able to run migrations
    expect(runner).toContain('def run_all_migrations');
    expect(runner).toContain('def apply_migration');
  });

  it('should have schema documentation', () => {
    const docPath = join(projectRoot, 'docs', 'PARSED_EVENTS_SCHEMA.md');
    expect(existsSync(docPath)).toBe(true);
    
    const doc = readFileSync(docPath, 'utf-8');
    
    // Should document the schema
    expect(doc.toLowerCase()).toContain('parsed_events');
    expect(doc.toLowerCase()).toContain('schema');
  });
});

