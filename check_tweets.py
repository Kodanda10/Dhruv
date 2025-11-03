#!/usr/bin/env python3
"""Check tweet fetch status"""

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
    
    # Get tweet count and date range
    cur.execute("""
        SELECT 
            COUNT(*) as total_tweets,
            MIN(created_at) as oldest,
            MAX(created_at) as newest
        FROM raw_tweets
        WHERE author_handle = 'OPChoudhary_Ind'
    """)
    
    result = cur.fetchone()
    total, oldest, newest = result
    
    print("=" * 60)
    print("TWEET FETCH STATUS")
    print("=" * 60)
    print(f"Total Tweets Fetched: {total}")
    if total > 0:
        print(f"Date Range: {oldest} to {newest}")
        print()
        
        # Get sample tweets
        cur.execute("""
            SELECT tweet_id, text, created_at
            FROM raw_tweets
            WHERE author_handle = 'OPChoudhary_Ind'
            ORDER BY created_at DESC
            LIMIT 3
        """)
        
        print("Most Recent Tweets:")
        print("-" * 60)
        for tweet_id, text, created_at in cur.fetchall():
            print(f"\n{created_at}")
            print(f"ID: {tweet_id}")
            print(f"{text[:100]}...")
    else:
        print("\n❌ NO TWEETS FETCHED YET")
    
    print()
    print("=" * 60)
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

