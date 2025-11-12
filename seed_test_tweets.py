#!/usr/bin/env python3
"""
Seed database with test tweets for parsing workflow testing
"""
import os
import sys
from pathlib import Path
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from datetime import datetime, timedelta
import random

sys.path.insert(0, str(Path(__file__).parent))

# Load environment variables
load_dotenv(Path(__file__).parent / '.env.local')

def get_db_connection():
    """Get PostgreSQL database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')

    return psycopg2.connect(database_url)

def seed_test_tweets():
    """Insert test tweets into database."""
    test_tweets = [
        {
            'tweet_id': '1890000000000000001',
            'text': 'रायगढ़ में आज विकास कार्यों की समीक्षा बैठक। PM-Kisan और आयुष्मान योजना का लाभ चर्चा।',
            'created_at': datetime.now() - timedelta(hours=2),
            'author_handle': 'OPChoudhary_Ind'
        },
        {
            'tweet_id': '1890000000000000002',
            'text': 'दुर्ग जिले में लोकर्पण कार्यक्रम सम्पन्न। उज्ज्वला और PM-Kisan योजनाओं का लाभ वितरण।',
            'created_at': datetime.now() - timedelta(hours=4),
            'author_handle': 'OPChoudhary_Ind'
        },
        {
            'tweet_id': '1890000000000000003',
            'text': 'रायपुर दौरा: मुख्यमंत्री श्री भूपेश बघेल जी के साथ जनसम्पर्क एवं बैठक।',
            'created_at': datetime.now() - timedelta(hours=6),
            'author_handle': 'OPChoudhary_Ind'
        },
        {
            'tweet_id': '1890000000000000004',
            'text': 'बिलासपुर में ग्रामीण विकास कार्यक्रम का उद्घाटन। पंचायत स्तर पर योजनाओं की समीक्षा।',
            'created_at': datetime.now() - timedelta(hours=8),
            'author_handle': 'OPChoudhary_Ind'
        },
        {
            'tweet_id': '1890000000000000005',
            'text': 'कोरबा जिला मुख्यालय पर किसान सम्मेलन। प्रधानमंत्री फसल बीमा योजना की जानकारी।',
            'created_at': datetime.now() - timedelta(hours=10),
            'author_handle': 'OPChoudhary_Ind'
        }
    ]

    conn = get_db_connection()
    inserted_count = 0

    try:
        with conn.cursor() as cur:
            for tweet in test_tweets:
                try:
                    # Insert tweet
                    cur.execute("""
                        INSERT INTO raw_tweets (
                            tweet_id, text, created_at, author_handle, processing_status
                        ) VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (tweet_id) DO NOTHING
                    """, (
                        tweet['tweet_id'],
                        tweet['text'],
                        tweet['created_at'],
                        tweet['author_handle'],
                        'pending'
                    ))

                    if cur.rowcount > 0:
                        inserted_count += 1
                        print(f"✓ Inserted tweet {tweet['tweet_id']}")

                except Exception as e:
                    print(f"❌ Error inserting tweet {tweet['tweet_id']}: {e}")

        conn.commit()
        print(f"\n✅ Successfully inserted {inserted_count} test tweets")

    except Exception as e:
        print(f"❌ Database error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    print("🌱 Seeding database with test tweets...")
    seed_test_tweets()
    print("✅ Seeding complete!")