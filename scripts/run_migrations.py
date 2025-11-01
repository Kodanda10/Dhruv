#!/usr/bin/env python3
"""
Database Migration Runner

Applies SQL migrations to the database in order.

Usage:
    python scripts/run_migrations.py
    python scripts/run_migrations.py --migration 002  # Run specific migration
"""

import os
import sys
import argparse
import logging
from pathlib import Path
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env.local')


def get_db_connection():
    """Get PostgreSQL database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    
    return psycopg2.connect(database_url)


def create_migrations_table(conn):
    """Create migrations tracking table if it doesn't exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT NOW(),
                description TEXT
            );
        """)
        conn.commit()
        logger.info('Migrations tracking table ready')


def get_applied_migrations(conn):
    """Get list of already applied migrations."""
    with conn.cursor() as cur:
        cur.execute("SELECT version FROM schema_migrations ORDER BY version")
        return [row[0] for row in cur.fetchall()]


def apply_migration(conn, migration_file: Path):
    """Apply a single migration file."""
    version = migration_file.stem  # e.g., "002_create_parsed_events"
    description = migration_file.stem.replace('_', ' ').replace(version.split('_')[0] + ' ', '')
    
    logger.info(f'Applying migration: {version}')
    logger.info(f'Description: {description}')
    
    # Read migration SQL
    with open(migration_file, 'r') as f:
        sql = f.read()
    
    # Apply migration
    with conn.cursor() as cur:
        cur.execute(sql)
        conn.commit()
    
    # Record migration
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO schema_migrations (version, description)
            VALUES (%s, %s)
            ON CONFLICT (version) DO NOTHING
        """, (version, description))
        conn.commit()
    
    logger.info(f'✓ Migration {version} applied successfully')


def run_all_migrations():
    """Run all pending migrations."""
    migrations_dir = Path(__file__).parent.parent / 'infra' / 'migrations'
    
    if not migrations_dir.exists():
        logger.error(f'Migrations directory not found: {migrations_dir}')
        return False
    
    # Get all migration files sorted by name
    migration_files = sorted(migrations_dir.glob('*.sql'))
    
    if not migration_files:
        logger.warning('No migration files found')
        return True
    
    logger.info(f'Found {len(migration_files)} migration files')
    
    try:
        # Connect to database
        conn = get_db_connection()
        
        # Create migrations tracking table
        create_migrations_table(conn)
        
        # Get already applied migrations
        applied = get_applied_migrations(conn)
        logger.info(f'Already applied: {len(applied)} migrations')
        
        # Apply pending migrations
        pending = [f for f in migration_files if f.stem not in applied]
        
        if not pending:
            logger.info('✓ All migrations already applied')
            conn.close()
            return True
        
        logger.info(f'Applying {len(pending)} pending migrations...')
        
        for migration_file in pending:
            apply_migration(conn, migration_file)
        
        conn.close()
        
        logger.info('✓ All migrations completed successfully')
        return True
        
    except Exception as e:
        logger.error(f'❌ Migration failed: {e}')
        import traceback
        traceback.print_exc()
        return False


def run_specific_migration(version: str):
    """Run a specific migration by version number."""
    migrations_dir = Path(__file__).parent.parent / 'infra' / 'migrations'
    migration_file = migrations_dir / f'{version}.sql'
    
    if not migration_file.exists():
        logger.error(f'Migration file not found: {migration_file}')
        return False
    
    try:
        conn = get_db_connection()
        create_migrations_table(conn)
        apply_migration(conn, migration_file)
        conn.close()
        
        logger.info(f'✓ Migration {version} applied successfully')
        return True
        
    except Exception as e:
        logger.error(f'❌ Migration failed: {e}')
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Run database migrations')
    parser.add_argument('--migration', help='Run specific migration by version (e.g., 002)')
    
    args = parser.parse_args()
    
    if args.migration:
        success = run_specific_migration(args.migration)
    else:
        success = run_all_migrations()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

