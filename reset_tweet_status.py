#!/usr/bin/env python3
"""Reset tweet processing status to 'pending'"""

import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env.local')

def reset():
    database_url = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(database_url)
    
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE raw_tweets
            SET processing_status = 'pending'
            WHERE processing_status = 'error'
        """)
        conn.commit()
        print(f"Reset {cur.rowcount} tweets to 'pending' status")
    
    conn.close()

if __name__ == '__main__':
    reset()

