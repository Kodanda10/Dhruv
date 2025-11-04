#!/usr/bin/env python3
"""
Automated Tweet Fetching Script - Fetch until December 2023

Fetches tweets in batches of 500 until reaching December 31, 2023.
Automatically handles rate limits and updates the readable file after each batch.

Usage:
    python scripts/fetch_until_dec_2023.py
"""

import os
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import psycopg2

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env.local')

TARGET_DATE = datetime(2023, 12, 31).date()
BATCH_SIZE = 500  # tweets per batch
MAX_BATCHES_PER_RUN = 5  # to avoid hitting rate limits too hard


def get_oldest_tweet_info(conn):
    """Get the oldest tweet ID and date from database."""
    with conn.cursor() as cur:
        cur.execute('''
            SELECT tweet_id, created_at 
            FROM raw_tweets 
            WHERE created_at = (SELECT MIN(created_at) FROM raw_tweets)
            LIMIT 1
        ''')
        result = cur.fetchone()
        if result:
            return result[0], result[1].date()
        return None, None


def get_tweet_count(conn):
    """Get total tweet count."""
    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM raw_tweets')
        return cur.fetchone()[0]


def update_readable_file():
    """Update the readable tweets file."""
    print("\n📝 Updating readable file...")
    try:
        subprocess.run(
            ['python3', 'scripts/export_tweets_to_readable.py'],
            cwd=Path(__file__).parent.parent,
            check=True,
            capture_output=True
        )
        print("✅ Readable file updated")
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Warning: Failed to update readable file: {e}")


def fetch_batch(until_id):
    """Fetch one batch of tweets."""
    script_path = Path(__file__).parent / 'fetch_tweets_safe.py'
    cmd = [
        'python3', str(script_path),
        '--handle', 'OPChoudhary_Ind',
        '--max-batches', str(MAX_BATCHES_PER_RUN),
        '--until-id', str(until_id)
    ]
    
    print(f"\n🔄 Fetching batch (until_id: {until_id})...")
    result = subprocess.run(
        cmd,
        cwd=Path(__file__).parent.parent,
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        # Extract number of tweets fetched from output
        output = result.stdout + result.stderr
        print(output[-500:])  # Show last 500 chars of output
        return True
    else:
        print(f"❌ Fetch failed: {result.stderr}")
        return False


def main():
    """Main execution loop."""
    print("=" * 60)
    print("🚀 AUTOMATED TWEET FETCHING - UNTIL DECEMBER 2023")
    print("=" * 60)
    
    # Connect to database
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        sys.exit(1)
    
    conn = psycopg2.connect(database_url)
    
    try:
        batch_num = 1
        total_batches = 0
        
        while True:
            # Get current status
            oldest_id, oldest_date = get_oldest_tweet_info(conn)
            total_tweets = get_tweet_count(conn)
            
            if not oldest_id or not oldest_date:
                print("❌ No tweets found in database")
                break
            
            # Check if we've reached the target
            if oldest_date <= TARGET_DATE:
                print("\n" + "=" * 60)
                print("✅ SUCCESS: Reached December 2023!")
                print(f"   Oldest tweet: {oldest_date}")
                print(f"   Total tweets: {total_tweets}")
                print("=" * 60)
                break
            
            # Show progress
            days_remaining = (oldest_date - TARGET_DATE).days
            print(f"\n📊 Batch #{batch_num} Status:")
            print(f"   Current oldest tweet: {oldest_date}")
            print(f"   Days remaining: {days_remaining} days")
            print(f"   Total tweets: {total_tweets}")
            print(f"   Target: {TARGET_DATE}")
            
            # Fetch batch
            success = fetch_batch(oldest_id)
            
            if not success:
                print("❌ Fetch failed. Stopping.")
                break
            
            # Wait a bit for rate limits
            time.sleep(2)
            
            # Update readable file
            update_readable_file()
            
            # Check new oldest date
            new_oldest_id, new_oldest_date = get_oldest_tweet_info(conn)
            new_total = get_tweet_count(conn)
            
            tweets_fetched = new_total - total_tweets
            print(f"\n✅ Batch #{batch_num} complete:")
            print(f"   Tweets fetched: {tweets_fetched}")
            print(f"   New oldest tweet: {new_oldest_date}")
            print(f"   New total: {new_total}")
            
            # If we didn't get any new tweets, we might be stuck
            if tweets_fetched == 0:
                print("⚠️  No new tweets fetched. Possible rate limit or end of tweets.")
                print("   Consider waiting and retrying later.")
                break
            
            batch_num += 1
            total_batches += 1
            
            # Check again if we've reached target
            if new_oldest_date and new_oldest_date <= TARGET_DATE:
                print("\n" + "=" * 60)
                print("✅ SUCCESS: Reached December 2023!")
                print(f"   Oldest tweet: {new_oldest_date}")
                print(f"   Total tweets: {new_total}")
                print(f"   Total batches: {total_batches}")
                print("=" * 60)
                break
            
            # Show progress towards target
            new_days_remaining = (new_oldest_date - TARGET_DATE).days if new_oldest_date else 0
            progress = ((454 - new_days_remaining) / 454 * 100) if new_days_remaining > 0 else 100
            print(f"   Progress: {progress:.1f}% towards December 2023")
            
            print("\n" + "-" * 60)
            print(f"⏸️  Pausing before next batch (to respect rate limits)...")
            print("   You can stop here and resume later by running this script again.")
            print("-" * 60)
            
            # Ask if user wants to continue (or we can auto-continue)
            # For now, stop after each batch to allow manual control
            break
        
        print(f"\n📊 Final Summary:")
        print(f"   Total batches completed: {total_batches}")
        print(f"   Total tweets: {get_tweet_count(conn)}")
        oldest_id, oldest_date = get_oldest_tweet_info(conn)
        if oldest_date:
            print(f"   Oldest tweet: {oldest_date}")
            days_remaining = (oldest_date - TARGET_DATE).days
            if days_remaining > 0:
                print(f"   Days remaining to target: {days_remaining}")
                print(f"\n💡 To continue, run this script again.")
            else:
                print(f"   ✅ Target reached!")
        
    finally:
        conn.close()


if __name__ == '__main__':
    main()


