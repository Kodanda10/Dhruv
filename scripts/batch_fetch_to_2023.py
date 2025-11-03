#!/usr/bin/env python3
"""
Automated Batch Fetch Script: Fetch tweets in batches of 500 until December 2023

This script:
1. Fetches 500 tweets (using until_id from oldest current tweet)
2. Parses the batch
3. Verifies on dashboard/review/analytics pages
4. Repeats until oldest tweet date < December 2023

Usage:
    python3 scripts/batch_fetch_to_2023.py --handle OPChoudhary_Ind --target-date 2023-12-01
"""

import os
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import psycopg2

sys.path.insert(0, str(Path(__file__).parent.parent))

load_dotenv(Path(__file__).parent.parent / '.env.local')

def get_oldest_tweet_id(conn):
    """Get the oldest tweet ID from database."""
    with conn.cursor() as cur:
        cur.execute('''
            SELECT tweet_id, created_at
            FROM raw_tweets 
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
        cur.execute('SELECT COUNT(*) FROM raw_tweets')
        total = cur.fetchone()[0]
        
        cur.execute('SELECT COUNT(*) FROM parsed_events')
        parsed = cur.fetchone()[0]
        
        cur.execute('SELECT COUNT(*) FROM raw_tweets WHERE processing_status = %s', ('pending',))
        pending = cur.fetchone()[0]
        
        cur.execute('SELECT MIN(created_at), MAX(created_at) FROM raw_tweets')
        date_range = cur.fetchone()
        
        return {
            'total': total,
            'parsed': parsed,
            'pending': pending,
            'oldest': date_range[0] if date_range[0] else None,
            'newest': date_range[1] if date_range[1] else None,
        }

def fetch_batch(handle, until_id, max_batches=5):
    """Fetch one batch of tweets."""
    print(f'  📥 Fetching batch (until_id: {until_id})...')
    
    cmd = [
        'python3', 'scripts/fetch_tweets_safe.py',
        '--handle', handle,
        '--max-batches', str(max_batches),
        '--until-id', str(until_id),
    ]
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,
    )
    
    if result.returncode != 0:
        print(f'  ❌ Fetch failed: {result.stderr}')
        return False
    
    # Extract number of new tweets from output
    output_lines = result.stdout.split('\n')
    for line in output_lines:
        if 'New tweets stored' in line:
            try:
                count = int(line.split('stored')[0].split()[-1])
                print(f'  ✅ Fetched {count} new tweets')
                return True
            except:
                pass
    
    return True  # Assume success if we can't parse output

def parse_batch(fallback=True):
    """Parse current pending tweets."""
    print(f'  🔄 Parsing batch...')
    
    cmd = ['python3', 'scripts/parse_tweets_with_three_layer.py']
    if fallback:
        cmd.append('--fallback')
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent.parent,
    )
    
    if result.returncode != 0:
        print(f'  ❌ Parse failed: {result.stderr}')
        return False
    
    print(f'  ✅ Parse complete')
    return True

def verify_pages():
    """Verify tweets appear on dashboard/review/analytics."""
    print(f'  🔍 Verifying pages...')
    
    # Check API endpoints
    import requests
    
    try:
        # Check parsed events API
        response = requests.get('http://localhost:3000/api/parsed-events?limit=10', timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('data'):
                print(f'    ✅ Dashboard API: {len(data["data"])} events returned')
            else:
                print(f'    ⚠️  Dashboard API: No events returned')
        
        # Check review API
        response = requests.get('http://localhost:3000/api/parsed-events?needs_review=true&limit=10', timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('data'):
                print(f'    ✅ Review API: {len(data["data"])} events need review')
            else:
                print(f'    ℹ️  Review API: No events need review')
        
        # Check analytics API
        response = requests.get('http://localhost:3000/api/analytics', timeout=5)
        if response.status_code == 200:
            print(f'    ✅ Analytics API: Working')
        
    except Exception as e:
        print(f'    ⚠️  Could not verify pages: {e}')
        print(f'    (This is OK if Next.js server is not running)')

def main():
    """Main execution loop."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Batch fetch tweets until target date'
    )
    parser.add_argument('--handle', default='OPChoudhary_Ind', help='Twitter handle')
    parser.add_argument('--target-date', default='2023-12-01', help='Target date (YYYY-MM-DD)')
    parser.add_argument('--max-batches-per-fetch', type=int, default=5, help='Batches per fetch (default: 5)')
    parser.add_argument('--verify-pages', action='store_true', help='Verify dashboard/review/analytics after each batch')
    
    args = parser.parse_args()
    
    target_date = datetime.strptime(args.target_date, '%Y-%m-%d')
    
    print('=' * 80)
    print('BATCH FETCH TO DECEMBER 2023')
    print('=' * 80)
    print()
    print(f'Target: Fetch tweets until {target_date.strftime("%Y-%m-%d")}')
    print(f'Strategy: Fetch 500 → Parse → Verify → Repeat')
    print()
    
    # Connect to database
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print('❌ DATABASE_URL not found')
        sys.exit(1)
    
    conn = psycopg2.connect(database_url)
    
    batch_num = 1
    total_fetched = 0
    
    try:
        while True:
            # Get current status
            stats = get_stats(conn)
            oldest_id, oldest_date = get_oldest_tweet_id(conn)
            
            if not oldest_id:
                print('❌ No tweets found in database')
                break
            
            print(f'Batch #{batch_num}')
            print('-' * 80)
            print(f'Current status:')
            print(f'  Total tweets: {stats["total"]}')
            print(f'  Parsed: {stats["parsed"]}')
            print(f'  Oldest tweet: {oldest_date.strftime("%Y-%m-%d") if oldest_date else "N/A"}')
            print()
            
            # Check if we've reached target date
            if oldest_date and oldest_date < target_date:
                print(f'✅ Target date reached!')
                print(f'   Oldest tweet ({oldest_date.strftime("%Y-%m-%d")}) is before target ({target_date.strftime("%Y-%m-%d")})')
                break
            
            # Fetch batch
            success = fetch_batch(args.handle, oldest_id, args.max_batches_per_fetch)
            if not success:
                print('❌ Fetch failed, stopping')
                break
            
            # Wait a bit for database to update
            time.sleep(2)
            
            # Get new stats
            new_stats = get_stats(conn)
            fetched_this_batch = new_stats['total'] - stats['total']
            total_fetched += fetched_this_batch
            
            print(f'  📊 Fetched {fetched_this_batch} tweets this batch')
            print(f'  📊 Total fetched: {total_fetched} tweets')
            print()
            
            # Parse batch
            success = parse_batch(fallback=True)
            if not success:
                print('⚠️  Parse had errors, but continuing...')
            
            # Wait for parsing to complete
            time.sleep(2)
            
            # Verify pages (optional)
            if args.verify_pages:
                verify_pages()
            
            # Get final stats
            final_stats = get_stats(conn)
            new_oldest_id, new_oldest_date = get_oldest_tweet_id(conn)
            
            print()
            print(f'Batch #{batch_num} Complete:')
            print(f'  Total tweets: {final_stats["total"]}')
            print(f'  Parsed: {final_stats["parsed"]}')
            print(f'  New oldest: {new_oldest_date.strftime("%Y-%m-%d") if new_oldest_date else "N/A"}')
            print()
            
            # Check if we got no new tweets (reached end)
            if fetched_this_batch == 0:
                print('⚠️  No new tweets fetched - may have reached end of timeline')
                print('   Continuing to next batch anyway...')
            
            batch_num += 1
            
            # Small delay between batches
            print('Waiting 5 seconds before next batch...')
            print()
            time.sleep(5)
        
        # Final summary
        final_stats = get_stats(conn)
        final_oldest_id, final_oldest_date = get_oldest_tweet_id(conn)
        
        print('=' * 80)
        print('✅ ALL BATCHES COMPLETE')
        print('=' * 80)
        print()
        print(f'Final Statistics:')
        print(f'  Total tweets: {final_stats["total"]}')
        print(f'  Parsed events: {final_stats["parsed"]}')
        print(f'  Date range: {final_oldest_date.strftime("%Y-%m-%d") if final_oldest_date else "N/A"} to {final_stats["newest"].strftime("%Y-%m-%d") if final_stats["newest"] else "N/A"}')
        print(f'  Total batches: {batch_num - 1}')
        print(f'  Total fetched: {total_fetched} tweets')
        print()
        
    except KeyboardInterrupt:
        print()
        print('⚠️  Interrupted by user')
        print('   Progress saved - can resume by running script again')
        
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        
    finally:
        conn.close()

if __name__ == '__main__':
    main()


