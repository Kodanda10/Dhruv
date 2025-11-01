#!/usr/bin/env python3
"""
Update parsed_tweets.json with the latest tweets from the database.
This script fetches raw tweets from the database and processes them into the format expected by the dashboard.
"""

import os
import sys
import json
import psycopg2
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent / '.env.local')

def get_db_connection():
    """Establishes and returns a database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    return psycopg2.connect(database_url)

def fetch_latest_tweets(conn, limit=10):
    """Fetch the latest tweets from the database."""
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    tweet_id,
                    text,
                    created_at,
                    author_handle,
                    author_name,
                    lang,
                    retweet_count,
                    reply_count,
                    like_count,
                    quote_count
                FROM raw_tweets 
                WHERE author_handle = 'OPChoudhary_Ind'
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            
            tweets = cur.fetchall()
            return tweets
    except Exception as e:
        print(f"❌ Error fetching tweets: {e}")
        return []

def process_tweet_for_dashboard(tweet_data):
    """Convert raw tweet data to the format expected by the dashboard."""
    tweet_id, text, created_at, author_handle, author_name, lang, retweet_count, reply_count, like_count, quote_count = tweet_data
    
    # Simple parsing logic (you can enhance this with actual parsing)
    parsed_data = {
        "event_type": "अन्य",  # Default to "अन्य" (Other)
        "locations": [],  # Empty for now
        "people": [],  # Empty for now
        "organizations": [],  # Empty for now
        "schemes": []  # Empty for now
    }
    
    # Create the tweet object in the format expected by the dashboard
    tweet_obj = {
        "id": tweet_id,
        "timestamp": created_at.isoformat() if created_at else datetime.now().isoformat(),
        "content": text,
        "parsed": parsed_data,
        "confidence": 0.85,  # Default confidence
        "needs_review": True,
        "review_status": "pending"
    }
    
    return tweet_obj

def update_parsed_tweets_file(new_tweets):
    """Update the parsed_tweets.json file with new tweets."""
    parsed_tweets_path = Path(__file__).parent / 'data' / 'parsed_tweets.json'
    
    # Load existing tweets
    existing_tweets = []
    if parsed_tweets_path.exists():
        try:
            with open(parsed_tweets_path, 'r', encoding='utf-8') as f:
                existing_tweets = json.load(f)
        except Exception as e:
            print(f"⚠️  Error loading existing tweets: {e}")
            existing_tweets = []
    
    # Create a set of existing tweet IDs for deduplication
    existing_ids = {tweet['id'] for tweet in existing_tweets}
    
    # Add new tweets that don't already exist
    added_count = 0
    for tweet in new_tweets:
        if tweet['id'] not in existing_ids:
            existing_tweets.insert(0, tweet)  # Add to beginning (most recent first)
            existing_ids.add(tweet['id'])
            added_count += 1
    
    # Save updated tweets
    try:
        with open(parsed_tweets_path, 'w', encoding='utf-8') as f:
            json.dump(existing_tweets, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Updated parsed_tweets.json")
        print(f"   Total tweets: {len(existing_tweets)}")
        print(f"   New tweets added: {added_count}")
        
        return True
    except Exception as e:
        print(f"❌ Error saving parsed_tweets.json: {e}")
        return False

def main():
    """Main function to update parsed tweets from database."""
    print("🔄 Updating parsed_tweets.json with latest database tweets")
    print("=" * 60)
    
    conn = None
    try:
        # Connect to database
        print("1. Connecting to database...")
        conn = get_db_connection()
        print("   ✅ Database connected")
        
        # Fetch latest tweets
        print("\n2. Fetching latest tweets...")
        raw_tweets = fetch_latest_tweets(conn, limit=10)  # Get 10 latest tweets
        
        if not raw_tweets:
            print("   ❌ No tweets found in database")
            return
        
        print(f"   ✅ Found {len(raw_tweets)} tweets in database")
        
        # Process tweets for dashboard
        print("\n3. Processing tweets for dashboard...")
        processed_tweets = []
        for tweet_data in raw_tweets:
            processed_tweet = process_tweet_for_dashboard(tweet_data)
            processed_tweets.append(processed_tweet)
        
        print(f"   ✅ Processed {len(processed_tweets)} tweets")
        
        # Update parsed_tweets.json
        print("\n4. Updating parsed_tweets.json...")
        success = update_parsed_tweets_file(processed_tweets)
        
        if success:
            print("\n🎉 SUCCESS!")
            print("=" * 60)
            print("✅ Database tweets successfully synced to parsed_tweets.json")
            print("✅ Dashboard will now show the latest tweets")
            print("\nLatest tweets:")
            print("-" * 60)
            for i, tweet in enumerate(processed_tweets[:5], 1):
                print(f"{i}. [{tweet['timestamp'][:10]}] {tweet['content'][:70]}...")
        else:
            print("\n❌ FAILED to update parsed_tweets.json")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    main()
