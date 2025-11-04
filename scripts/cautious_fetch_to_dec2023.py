#!/usr/bin/env python3
"""
CAUTIOUS Batch Fetch Script: Fetch tweets in batches of 500 until December 1, 2023

This script is designed to be EXTREMELY CAUTIOUS with rate limits:
1. Fetches 500 tweets per batch (5 API calls × 100 tweets)
2. Uses wait_on_rate_limit=True for automatic rate limit handling
3. Adds conservative delays between batches
4. Monitors progress carefully
5. Stops at December 1, 2023

Usage:
    python3 scripts/cautious_fetch_to_dec2023.py --handle OPChoudhary_Ind
"""

import os
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2

sys.path.insert(0, str(Path(__file__).parent.parent))

load_dotenv(Path(__file__).parent.parent / '.env.local')

# Configuration - CAUTIOUS SETTINGS
TARGET_DATE = datetime(2023, 12, 1).date()
BATCHES_PER_FETCH = 5  # 5 batches × 100 tweets = 500 tweets
SAFETY_DELAY_BETWEEN_BATCHES = 30  # 30 seconds between batch cycles
SAFETY_DELAY_AFTER_FETCH = 10  # 10 seconds after fetch completes
MAX_BATCHES_PER_SESSION = None  # None = unlimited (be careful!)

def get_oldest_tweet_id(conn):
    """Get the oldest tweet ID and date from database."""
    with conn.cursor() as cur:
        cur.execute('''
            SELECT tweet_id, created_at
            FROM raw_tweets 
            WHERE author_handle = 'OPChoudhary_Ind'
            ORDER BY created_at ASC 
            LIMIT 1
        ''')
        result = cur.fetchone()
        if result:
            return result[0], result[1]
    return None, None

def get_stats(conn):
    """Get current statistics."""
    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM raw_tweets WHERE author_handle = %s', ('OPChoudhary_Ind',))
        total = cur.fetchone()[0]
        
        cur.execute('SELECT COUNT(*) FROM parsed_events')
        parsed = cur.fetchone()[0]
        
        cur.execute('SELECT COUNT(*) FROM raw_tweets WHERE processing_status = %s AND author_handle = %s', ('pending', 'OPChoudhary_Ind'))
        pending = cur.fetchone()[0]
        
        cur.execute('SELECT MIN(created_at), MAX(created_at) FROM raw_tweets WHERE author_handle = %s', ('OPChoudhary_Ind',))
        date_range = cur.fetchone()
        
        return {
            'total': total,
            'parsed': parsed,
            'pending': pending,
            'oldest': date_range[0] if date_range[0] else None,
            'newest': date_range[1] if date_range[1] else None,
        }

def fetch_batch_safely(handle, max_batches=5):
    """
    Fetch one batch of tweets with safety checks.
    Uses pagination_token (NOT until_id) to fetch older tweets correctly.
    Returns (success, tweets_fetched_count)
    """
    print(f'  📥 Fetching batch...')
    print(f'     This will fetch up to {max_batches * 100} tweets (going backward in time)')
    print(f'     Using pagination_token for backward pagination (until_id does not work)')
    
    cmd = [
        'python3', 'scripts/fetch_older_tweets_safe.py',
        '--handle', handle,
        '--target-date', '2023-12-01',
        '--max-batches', str(max_batches),
    ]
    
    print(f'     Command: {" ".join(cmd)}')
    print(f'     ⏳ Starting fetch (this may take several minutes with rate limits)...')
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,
    )
    
    # Print output for debugging
    if result.stdout:
        print(f'     📄 Output:')
        # Show last 20 lines of output
        output_lines = result.stdout.strip().split('\n')
        for line in output_lines[-20:]:
            print(f'        {line}')
    
    if result.stderr:
        print(f'     ⚠️  Warnings/Errors:')
        stderr_lines = result.stderr.strip().split('\n')
        for line in stderr_lines[-10:]:
            print(f'        {line}')
    
    if result.returncode != 0:
        print(f'  ❌ Fetch failed with return code {result.returncode}')
        print(f'     Error: {result.stderr[-500:] if result.stderr else "Unknown error"}')
        return False, 0
    
    # Extract number of new tweets from output
    tweets_fetched = 0
    output_lines = result.stdout.split('\n')
    for line in output_lines:
        if 'New tweets stored' in line:
            try:
                # Extract number from "New tweets stored: X"
                parts = line.split('stored')
                if len(parts) > 0:
                    count_str = parts[0].split()[-1]
                    tweets_fetched = int(count_str)
                    print(f'  ✅ Fetched {tweets_fetched} new tweets')
                    return True, tweets_fetched
            except (ValueError, IndexError) as e:
                print(f'     ⚠️  Could not parse tweet count: {e}')
    
    # If we can't parse, assume success but unknown count
    print(f'  ✅ Fetch completed (could not parse exact count)')
    return True, tweets_fetched

def calculate_progress(oldest_date, target_date):
    """Calculate progress percentage towards target date."""
    if not oldest_date or not target_date:
        return None
    
    if isinstance(oldest_date, str):
        oldest_date = datetime.fromisoformat(oldest_date.replace('Z', '+00:00')).date()
    if isinstance(target_date, str):
        target_date = datetime.fromisoformat(target_date.replace('Z', '+00:00')).date()
    
    # Calculate total days
    start_date = datetime(2025, 11, 3).date()  # Newest tweet we have
    total_days = (start_date - target_date).days
    
    # Calculate days remaining
    days_remaining = (oldest_date - target_date).days
    
    # Calculate progress
    if total_days > 0:
        progress = ((total_days - days_remaining) / total_days) * 100
        return progress, days_remaining, total_days
    
    return None

def main():
    """Main execution loop with CAUTIOUS settings."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Cautiously fetch tweets in batches until December 1, 2023'
    )
    parser.add_argument('--handle', default='OPChoudhary_Ind', help='Twitter handle')
    parser.add_argument('--target-date', default='2023-12-01', help='Target date (YYYY-MM-DD)')
    parser.add_argument('--max-batches-per-session', type=int, default=None, 
                       help='Maximum batches to fetch in this session (safety limit)')
    parser.add_argument('--skip-parse', action='store_true', 
                       help='Skip parsing step (faster, but tweets won\'t be parsed)')
    
    args = parser.parse_args()
    
    target_date = datetime.strptime(args.target_date, '%Y-%m-%d').date()
    max_batches_this_session = args.max_batches_per_session or MAX_BATCHES_PER_SESSION
    
    print('=' * 80)
    print('🚨 CAUTIOUS BATCH FETCH TO DECEMBER 2023')
    print('=' * 80)
    print()
    print('⚠️  SAFETY SETTINGS:')
    print(f'   - Batches per fetch: {BATCHES_PER_FETCH} (500 tweets per cycle)')
    print(f'   - Delay between batches: {SAFETY_DELAY_BETWEEN_BATCHES} seconds')
    print(f'   - Delay after fetch: {SAFETY_DELAY_AFTER_FETCH} seconds')
    print(f'   - Target date: {target_date.strftime("%Y-%m-%d")}')
    print(f'   - Max batches this session: {max_batches_this_session or "Unlimited (CAUTION!)"}')
    print()
    print('✅ Rate limit protection: ENABLED (wait_on_rate_limit=True)')
    print('✅ Automatic retry: ENABLED (with exponential backoff)')
    print()
    
    # Connect to database
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print('❌ DATABASE_URL not found')
        sys.exit(1)
    
    conn = psycopg2.connect(database_url)
    
    batch_num = 1
    total_fetched_this_session = 0
    session_start_time = datetime.now()
    
    try:
        while True:
            # Safety check: Max batches per session
            if max_batches_this_session and batch_num > max_batches_this_session:
                print(f'⚠️  Reached maximum batch limit for this session ({max_batches_this_session})')
                print('   Stopping for safety. Run again to continue.')
                break
            
            # Get current status
            stats = get_stats(conn)
            oldest_id, oldest_date = get_oldest_tweet_id(conn)
            
            if not oldest_id:
                print('❌ No tweets found in database')
                break
            
            # Format oldest date for display
            oldest_date_display = oldest_date.strftime('%Y-%m-%d') if oldest_date else 'N/A'
            oldest_date_obj = oldest_date.date() if oldest_date else None
            
            print(f'\n{"=" * 80}')
            print(f'📦 BATCH #{batch_num}')
            print(f'{"=" * 80}')
            print(f'Current Status:')
            print(f'  Total tweets in DB: {stats["total"]:,}')
            print(f'  Oldest tweet date:  {oldest_date_display}')
            print(f'  Newest tweet date:  {stats["newest"].strftime("%Y-%m-%d") if stats["newest"] else "N/A"}')
            
            # Check if we've reached target date
            if oldest_date_obj and oldest_date_obj <= target_date:
                print()
                print('✅ TARGET DATE REACHED!')
                print(f'   Oldest tweet ({oldest_date_display}) is at or before target ({target_date.strftime("%Y-%m-%d")})')
                print()
                break
            
            # Calculate progress
            progress_info = calculate_progress(oldest_date_obj, target_date)
            if progress_info:
                progress_pct, days_remaining, total_days = progress_info
                print(f'  Progress: {progress_pct:.1f}% complete ({days_remaining:,} days remaining)')
                print(f'  Days to cover: {total_days:,} total days')
            
            print()
            
            # Fetch batch
            print(f'⏳ Starting fetch cycle #{batch_num}...')
            success, tweets_fetched = fetch_batch_safely(
                args.handle, 
                BATCHES_PER_FETCH
            )
            
            if not success:
                print()
                print('❌ Fetch failed!')
                print('   This could be due to:')
                print('   - Rate limit exceeded (wait and retry)')
                print('   - API credentials issue')
                print('   - Network error')
                print()
                print('   Stopping for safety. Check logs and retry later.')
                break
            
            # Wait for database to update
            print(f'   ⏸️  Waiting {SAFETY_DELAY_AFTER_FETCH} seconds for database to update...')
            time.sleep(SAFETY_DELAY_AFTER_FETCH)
            
            # Get new stats
            new_stats = get_stats(conn)
            new_oldest_id, new_oldest_date = get_oldest_tweet_id(conn)
            
            # Calculate actual tweets fetched
            actual_fetched = new_stats['total'] - stats['total']
            total_fetched_this_session += actual_fetched
            
            print()
            print(f'📊 Batch #{batch_num} Results:')
            print(f'  Tweets fetched this batch: {actual_fetched:,}')
            print(f'  Total fetched this session: {total_fetched_this_session:,}')
            
            if new_oldest_date:
                new_oldest_display = new_oldest_date.strftime('%Y-%m-%d')
                print(f'  New oldest tweet date: {new_oldest_display}')
                
                # Check if we made progress
                if oldest_date_obj and new_oldest_date.date() < oldest_date_obj:
                    days_progress = (oldest_date_obj - new_oldest_date.date()).days
                    print(f'  ✅ Progress: Went back {days_progress} days')
                else:
                    print(f'  ⚠️  No date progress (might have reached end of available tweets)')
            
            print()
            
            # Check if we got no new tweets
            if actual_fetched == 0:
                print('⚠️  WARNING: No new tweets fetched this batch!')
                print('   This could mean:')
                print('   - Rate limit was hit (wait and retry)')
                print('   - Reached end of available tweets')
                print('   - All tweets in this range already exist in DB')
                print()
                print('   Continuing anyway...')
            
            # Check if we've reached target date after this batch
            if new_oldest_date and new_oldest_date.date() <= target_date:
                print()
                print('✅ TARGET DATE REACHED AFTER THIS BATCH!')
                print(f'   New oldest tweet ({new_oldest_date.strftime("%Y-%m-%d")}) is at or before target ({target_date.strftime("%Y-%m-%d")})')
                break
            
            batch_num += 1
            
            # Safety delay before next batch
            print(f'⏸️  Waiting {SAFETY_DELAY_BETWEEN_BATCHES} seconds before next batch (rate limit safety)...')
            print(f'   You can stop here with Ctrl+C - progress is saved')
            print()
            time.sleep(SAFETY_DELAY_BETWEEN_BATCHES)
        
        # Final summary
        final_stats = get_stats(conn)
        final_oldest_id, final_oldest_date = get_oldest_tweet_id(conn)
        session_duration = datetime.now() - session_start_time
        
        print()
        print('=' * 80)
        print('✅ BATCH FETCH SESSION COMPLETE')
        print('=' * 80)
        print()
        print(f'Session Summary:')
        print(f'  Total batches completed: {batch_num - 1}')
        print(f'  Total tweets fetched: {total_fetched_this_session:,}')
        print(f'  Session duration: {session_duration}')
        print()
        print(f'Database Status:')
        print(f'  Total tweets: {final_stats["total"]:,}')
        print(f'  Parsed events: {final_stats["parsed"]:,}')
        print(f'  Date range: {final_oldest_date.strftime("%Y-%m-%d") if final_oldest_date else "N/A"} to {final_stats["newest"].strftime("%Y-%m-%d") if final_stats["newest"] else "N/A"}')
        
        if final_oldest_date:
            final_oldest_obj = final_oldest_date.date()
            if final_oldest_obj <= target_date:
                print()
                print('🎉 SUCCESS: Reached target date of December 1, 2023!')
            else:
                days_remaining = (final_oldest_obj - target_date).days
                print()
                print(f'⏳ Still need: {days_remaining:,} more days to reach target')
                print(f'   Run this script again to continue fetching')
        
        print()
        print('=' * 80)
        
    except KeyboardInterrupt:
        print()
        print()
        print('⚠️  INTERRUPTED BY USER')
        print('=' * 80)
        print()
        print('✅ Progress has been saved to database')
        print(f'   Completed {batch_num - 1} batches')
        print(f'   Fetched {total_fetched_this_session:,} tweets this session')
        print()
        print('   To resume, simply run this script again:')
        print(f'   python3 scripts/cautious_fetch_to_dec2023.py --handle {args.handle}')
        print()
        
    except Exception as e:
        print()
        print('❌ ERROR OCCURRED')
        print('=' * 80)
        print(f'Error: {e}')
        import traceback
        traceback.print_exc()
        print()
        print('Progress has been saved. You can resume by running the script again.')
        
    finally:
        conn.close()
        print('Database connection closed')

if __name__ == '__main__':
    main()

