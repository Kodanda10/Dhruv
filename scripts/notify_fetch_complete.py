#!/usr/bin/env python3
"""
Monitor tweet fetch progress and notify when complete

This script monitors the database and displays progress updates.
When fetching is complete, it shows a summary.

Usage:
    python scripts/notify_fetch_complete.py
"""

import os
import sys
import time
from pathlib import Path
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / '.env.local')


def get_tweet_stats(conn):
    """Get current tweet count and stats."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                MIN(created_at) as oldest,
                MAX(created_at) as newest,
                MAX(fetched_at) as last_fetch
            FROM raw_tweets
            WHERE author_handle = 'OPChoudhary_Ind'
        """)
        return cur.fetchone()


def monitor_progress(interval=60):
    """
    Monitor fetch progress and notify when complete.
    
    Args:
        interval: Check interval in seconds (default: 60)
    """
    print("=" * 60)
    print("TWEET FETCH MONITOR")
    print("=" * 60)
    print()
    print("Monitoring database for tweet fetch progress...")
    print(f"Checking every {interval} seconds")
    print()
    print("Press Ctrl+C to stop monitoring")
    print()
    print("-" * 60)
    
    try:
        conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        
        last_count = 0
        no_change_count = 0
        start_time = datetime.now()
        
        while True:
            current_time = datetime.now()
            elapsed = current_time - start_time
            
            total, oldest, newest, last_fetch = get_tweet_stats(conn)
            
            # Clear line and print status
            status = f"[{current_time.strftime('%H:%M:%S')}] "
            status += f"Tweets: {total:,} | "
            
            if total > 0:
                status += f"Range: {oldest.date()} to {newest.date()} | "
                status += f"Last fetch: {last_fetch.strftime('%H:%M:%S') if last_fetch else 'N/A'}"
            else:
                status += "No tweets yet | Waiting for fetch to start..."
            
            print(f"\r{status}", end='', flush=True)
            
            # Check if fetch is complete (no new tweets for 3 checks)
            if total > 0 and total == last_count:
                no_change_count += 1
                if no_change_count >= 3:
                    print("\n")
                    print()
                    print("=" * 60)
                    print("🎉 TWEET FETCH COMPLETE!")
                    print("=" * 60)
                    print()
                    print(f"✅ Total tweets fetched: {total:,}")
                    print(f"📅 Date range: {oldest.date()} to {newest.date()}")
                    print(f"⏱️  Total time: {elapsed}")
                    print()
                    
                    # Get sample tweets
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT text, created_at
                            FROM raw_tweets
                            WHERE author_handle = 'OPChoudhary_Ind'
                            ORDER BY created_at DESC
                            LIMIT 3
                        """)
                        
                        print("Most recent tweets:")
                        print("-" * 60)
                        for text, created_at in cur.fetchall():
                            print(f"\n{created_at.strftime('%Y-%m-%d %H:%M')}")
                            print(f"{text[:100]}...")
                    
                    print()
                    print("=" * 60)
                    print()
                    print("🚀 NEXT STEPS:")
                    print("1. Run parsing pipeline:")
                    print("   python scripts/parse_tweets.py")
                    print()
                    print("2. View parsed events:")
                    print("   python scripts/view_parsed_events.py")
                    print()
                    print("3. Start human review:")
                    print("   Open dashboard and review low-confidence parses")
                    print()
                    
                    break
            else:
                no_change_count = 0
            
            last_count = total
            time.sleep(interval)
        
        conn.close()
        
    except KeyboardInterrupt:
        print("\n")
        print()
        print("Monitoring stopped by user")
        
    except Exception as e:
        print()
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Monitor tweet fetch progress')
    parser.add_argument('--interval', type=int, default=60, 
                       help='Check interval in seconds (default: 60)')
    
    args = parser.parse_args()
    monitor_progress(interval=args.interval)

