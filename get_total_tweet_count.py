#!/usr/bin/env python3
"""Get total tweet count from raw_tweets table"""

import os
import sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env.local')

try:
    # Connect to database
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()
    
    # Get total tweet count
    cur.execute("""
        SELECT 
            COUNT(*) as total_tweets
        FROM raw_tweets
    """)
    
    result = cur.fetchone()
    total_tweets = result[0]
    
    print(f"Total tweets in raw_tweets table: {total_tweets}")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
