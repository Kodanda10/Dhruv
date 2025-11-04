#!/usr/bin/env python3
"""Test PostgreSQL database connection"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent / '.env.local')

import psycopg2

print("=" * 60)
print("PostgreSQL Connection Test")
print("=" * 60)
print()

# Get database URL
database_url = os.getenv('DATABASE_URL', 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db')
print(f"Connecting to: {database_url.split('@')[1] if '@' in database_url else 'localhost:5432'}")
print()

try:
    # Connect to database
    conn = psycopg2.connect(database_url)
    print("✅ Connected to PostgreSQL!")
    print()
    
    # Get version
    with conn.cursor() as cur:
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print(f"PostgreSQL Version:")
        print(f"  {version}")
        print()
    
    # Check if tables exist
    with conn.cursor() as cur:
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cur.fetchall()
        
        print(f"Existing tables: {len(tables)}")
        if tables:
            for table in tables:
                print(f"  - {table[0]}")
        else:
            print("  (no tables yet)")
        print()
    
    # Close connection
    conn.close()
    
    print("=" * 60)
    print("✅ Database connection successful!")
    print("=" * 60)
    print()
    print("Ready to start tweet fetch!")
    
except psycopg2.OperationalError as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

