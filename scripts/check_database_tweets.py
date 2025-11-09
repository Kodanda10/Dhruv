#!/usr/bin/env python3
"""
Script to check database tweets and verify OP Choudhary tweets
"""
import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

def main():
    db_url = os.getenv('DATABASE_URL', 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db')
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check table structure
        print("=" * 80)
        print("DATABASE TWEETS ANALYSIS")
        print("=" * 80)
        
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'raw_tweets'
            ORDER BY ordinal_position
        """)
        columns = cur.fetchall()
        print(f"\n📋 raw_tweets table columns:")
        for col in columns:
            print(f"   - {col['column_name']}: {col['data_type']}")
        
        # Check total tweets
        cur.execute('SELECT COUNT(*) as count FROM raw_tweets')
        total = cur.fetchone()['count']
        print(f"\n📊 Total tweets in database: {total}")
        
        # Check parsed events
        cur.execute('SELECT COUNT(*) as count FROM parsed_events')
        parsed = cur.fetchone()['count']
        print(f"📊 Total parsed events: {parsed}")
        
        # Check for author_username field
        has_author = any(col['column_name'] == 'author_username' for col in columns)
        
        if has_author:
            # Get unique authors
            cur.execute('SELECT DISTINCT author_username FROM raw_tweets WHERE author_username IS NOT NULL ORDER BY author_username')
            authors = cur.fetchall()
            print(f"\n👤 Unique authors: {len(authors)}")
            for author in authors[:10]:
                print(f"   - {author['author_username']}")
            
            # Check for OP Choudhary tweets by author
            cur.execute("""
                SELECT COUNT(*) as count 
                FROM raw_tweets 
                WHERE author_username ILIKE '%op%choudhary%' 
                   OR author_username ILIKE '%opchoudhary%'
            """)
            op_by_author = cur.fetchone()['count']
            print(f"\n🔍 Tweets by OP Choudhary (by author_username): {op_by_author}")
            
            # Get OP Choudhary tweets
            if op_by_author > 0:
                cur.execute("""
                    SELECT tweet_id, text, created_at, author_username 
                    FROM raw_tweets 
                    WHERE author_username ILIKE '%op%choudhary%' 
                       OR author_username ILIKE '%opchoudhary%'
                    ORDER BY created_at DESC 
                    LIMIT 3
                """)
                op_tweets = cur.fetchall()
                print(f"\n📝 Sample OP Choudhary tweets (by author):")
                for i, tweet in enumerate(op_tweets, 1):
                    print(f"\n   {i}. Tweet ID: {tweet['tweet_id']}")
                    print(f"      Author: {tweet.get('author_username', 'N/A')}")
                    print(f"      Created: {tweet.get('created_at', 'N/A')}")
                    print(f"      Text: {tweet.get('text', '')[:150]}...")
        
        # Check for OP Choudhary mentions in text
        cur.execute("""
            SELECT COUNT(*) as count 
            FROM raw_tweets 
            WHERE text ILIKE '%OP Choudhary%'
               OR text ILIKE '%op choudhary%'
               OR text ILIKE '%OPChoudhary%'
        """)
        op_in_text = cur.fetchone()['count']
        print(f"\n🔍 Tweets mentioning OP Choudhary (in text): {op_in_text}")
        
        if op_in_text > 0:
            cur.execute("""
                SELECT tweet_id, text, created_at, author_username 
                FROM raw_tweets 
                WHERE text ILIKE '%OP Choudhary%'
                   OR text ILIKE '%op choudhary%'
                   OR text ILIKE '%OPChoudhary%'
                ORDER BY created_at DESC 
                LIMIT 3
            """)
            op_mentions = cur.fetchall()
            print(f"\n📝 Sample tweets mentioning OP Choudhary:")
            for i, tweet in enumerate(op_mentions, 1):
                print(f"\n   {i}. Tweet ID: {tweet['tweet_id']}")
                print(f"      Author: {tweet.get('author_username', 'N/A')}")
                print(f"      Created: {tweet.get('created_at', 'N/A')}")
                print(f"      Text: {tweet.get('text', '')[:150]}...")
        
        # Get sample of all tweets
        print(f"\n📝 Sample of all tweets (last 5):")
        cur.execute('SELECT tweet_id, text, created_at, author_username FROM raw_tweets ORDER BY created_at DESC LIMIT 5')
        samples = cur.fetchall()
        for i, tweet in enumerate(samples, 1):
            print(f"\n   {i}. Tweet ID: {tweet['tweet_id']}")
            print(f"      Author: {tweet.get('author_username', 'N/A')}")
            print(f"      Created: {tweet.get('created_at', 'N/A')}")
            print(f"      Text: {tweet.get('text', '')[:150]}...")
        
        # Check parsed events with OP Choudhary
        if has_author:
            cur.execute("""
                SELECT COUNT(*) as count
                FROM parsed_events pe
                JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
                WHERE rt.author_username ILIKE '%op%choudhary%' 
                   OR rt.author_username ILIKE '%opchoudhary%'
            """)
            parsed_op = cur.fetchone()['count']
            print(f"\n📊 Parsed events from OP Choudhary tweets: {parsed_op}")
        
        cur.close()
        conn.close()
        
        print("\n" + "=" * 80)
        print("ANALYSIS COMPLETE")
        print("=" * 80)
        
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()


