#!/usr/bin/env python3
"""
SMART Older Tweet Fetcher - Skips already-ingested tweets by date checking

This script:
1. Checks dates BEFORE inserting to database
2. Skips batches that are entirely too new (already have them)
3. Only inserts tweets older than our current oldest date
4. Tests with minimal API calls first

Usage (TEST with 1 batch):
    python3 scripts/smart_fetch_older_tweets.py --handle OPChoudhary_Ind --max-batches 1

Usage (FULL):
    python3 scripts/smart_fetch_older_tweets.py --handle OPChoudhary_Ind --target-date 2023-12-01
"""

import os
import sys
import time
from pathlib import Path
from datetime import datetime
import psycopg2
from dotenv import load_dotenv
import tweepy

sys.path.insert(0, str(Path(__file__).parent.parent))

# Setup logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env.local')


def get_db_connection():
    """Get PostgreSQL database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    return psycopg2.connect(database_url)


def get_oldest_tweet_date(conn):
    """Get the oldest tweet date from database."""
    with conn.cursor() as cur:
        cur.execute('''
            SELECT MIN(created_at) FROM raw_tweets 
            WHERE author_handle = 'OPChoudhary_Ind'
        ''')
        result = cur.fetchone()
        if result and result[0]:
            return result[0].date()
    return None


def should_insert_batch(tweets, oldest_db_date):
    """
    Check if batch contains tweets older than our oldest date.
    Returns (should_insert, oldest_in_batch_date, newest_in_batch_date)
    """
    if not tweets:
        return False, None, None
    
    dates = []
    for tweet in tweets:
        if tweet.get('created_at'):
            try:
                # Parse ISO format date
                date_str = tweet['created_at'][:10]  # YYYY-MM-DD
                tweet_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                dates.append(tweet_date)
            except:
                pass
    
    if not dates:
        return True, None, None  # If we can't parse dates, insert anyway
    
    oldest_in_batch = min(dates)
    newest_in_batch = max(dates)
    
    # Only insert if batch contains tweets older than our oldest
    if oldest_db_date and oldest_in_batch >= oldest_db_date:
        return False, oldest_in_batch, newest_in_batch
    
    return True, oldest_in_batch, newest_in_batch


def insert_tweets(conn, tweets: list, author_handle: str):
    """Insert tweets into database (skip duplicates)."""
    inserted_count = 0
    
    with conn.cursor() as cur:
        for tweet in tweets:
            try:
                # Extract entities safely
                hashtags = [tag['tag'] for tag in tweet.get('entities', {}).get('hashtags', [])]
                mentions = [mention['username'] for mention in tweet.get('entities', {}).get('mentions', [])]
                urls = [url.get('url', '') for url in tweet.get('entities', {}).get('urls', [])]
                
                # Insert tweet (ON CONFLICT DO NOTHING to skip duplicates)
                cur.execute("""
                    INSERT INTO raw_tweets (
                        tweet_id, author_handle, text, created_at,
                        hashtags, mentions, urls,
                        retweet_count, like_count, reply_count, quote_count,
                        processing_status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                    ON CONFLICT (tweet_id) DO NOTHING
                    RETURNING tweet_id
                """, (
                    str(tweet['id']),
                    author_handle,
                    tweet['text'],
                    tweet['created_at'],
                    hashtags,
                    mentions,
                    urls,
                    tweet['public_metrics'].get('retweet_count', 0),
                    tweet['public_metrics'].get('like_count', 0),
                    tweet['public_metrics'].get('reply_count', 0),
                    tweet['public_metrics'].get('quote_count', 0),
                ))
                
                if cur.fetchone():
                    inserted_count += 1
                    
            except Exception as e:
                logger.error(f'Error inserting tweet {tweet.get("id", "unknown")}: {str(e)}')
        
        conn.commit()
    
    return inserted_count


def fetch_older_tweets_smart(
    author_handle: str,
    target_date: datetime.date,
    max_batches: int = None,
    test_mode: bool = False
):
    """
    Smart fetch that skips batches already in database.
    
    Args:
        test_mode: If True, use max_results=2 for minimal API usage
    """
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token:
        raise ValueError('X_BEARER_TOKEN not found')
    
    client = tweepy.Client(
        bearer_token=bearer_token,
        wait_on_rate_limit=True,
    )
    
    # Get user
    user = client.get_user(username=author_handle)
    if not user.data:
        raise ValueError(f'User @{author_handle} not found')
    
    user_id = user.data.id
    logger.info(f'✓ User: @{user.data.username} (ID: {user_id})')
    
    # Connect to database
    conn = get_db_connection()
    oldest_db_date = get_oldest_tweet_date(conn)
    
    if oldest_db_date:
        logger.info(f'✓ Current oldest tweet in DB: {oldest_db_date}')
        logger.info(f'  Will skip batches newer than this date')
    else:
        logger.info('⚠️  No tweets in database - will fetch from newest')
    
    logger.info('')
    
    # Pagination variables
    pagination_token = None
    total_fetched = 0
    total_inserted = 0
    total_skipped = 0
    batch_num = 1
    reached_target = False
    
    # Test mode: use minimal API calls (API requires min 5)
    max_results = 5 if test_mode else 100
    if test_mode:
        logger.info('🧪 TEST MODE: Using max_results=5 (minimal API usage)')
        logger.info('')
    
    try:
        logger.info('Starting smart fetch (skipping already-ingested tweets)...')
        logger.info('=' * 60)
        logger.info('')
        
        while True:
            if max_batches and batch_num > max_batches:
                logger.info(f'Reached maximum batch limit ({max_batches})')
                break
            
            logger.info(f'📥 Batch #{batch_num}: Fetching up to {max_results} tweets...')
            
            try:
                request_params = {
                    'id': user_id,
                    'max_results': max_results,
                    'exclude': ['retweets'],
                    'tweet_fields': ['created_at', 'public_metrics', 'entities', 'author_id'],
                }
                
                if pagination_token:
                    request_params['pagination_token'] = pagination_token
                    logger.info(f'   Using pagination_token (going backward)')
                
                response = client.get_users_tweets(**request_params)
                
                if not response.data:
                    logger.info('✓ No more tweets available')
                    break
                
                # Convert to list of dicts
                tweets = []
                for tweet in response.data:
                    tweets.append({
                        'id': tweet.id,
                        'text': tweet.text,
                        'created_at': tweet.created_at.isoformat() if tweet.created_at else None,
                        'author_id': tweet.author_id,
                        'public_metrics': tweet.public_metrics if tweet.public_metrics else {},
                        'entities': tweet.entities if tweet.entities else {},
                    })
                
                total_fetched += len(tweets)
                
                # SMART CHECK: Should we insert this batch?
                should_insert, oldest_in_batch, newest_in_batch = should_insert_batch(
                    tweets, oldest_db_date
                )
                
                if tweets:
                    date_info = f'{oldest_in_batch} to {newest_in_batch}' if oldest_in_batch else 'unknown dates'
                    logger.info(f'  Date range: {date_info}')
                
                if not should_insert and oldest_db_date:
                    logger.info(f'  ⏭️  SKIPPING: All tweets in batch are newer than {oldest_db_date}')
                    logger.info(f'     (Already in database - saving API quota)')
                    total_skipped += len(tweets)
                else:
                    # Insert into database
                    inserted = insert_tweets(conn, tweets, author_handle)
                    total_inserted += inserted
                    logger.info(f'  ✓ Inserted {inserted} new tweets (skipped {len(tweets) - inserted} duplicates)')
                    
                    # Check if we've reached target date
                    if oldest_in_batch and oldest_in_batch <= target_date:
                        logger.info(f'  ✅ Reached target date! Oldest in batch: {oldest_in_batch}')
                        reached_target = True
                
                # Progress update
                logger.info(f'  Progress: {total_fetched} fetched, {total_inserted} inserted, {total_skipped} skipped')
                if oldest_in_batch:
                    days_remaining = (oldest_in_batch - target_date).days if oldest_in_batch > target_date else 0
                    logger.info(f'  Days remaining: {days_remaining}')
                logger.info('')
                
                if reached_target:
                    break
                
                # Get pagination token
                if response.meta and 'next_token' in response.meta:
                    pagination_token = response.meta['next_token']
                    batch_num += 1
                    time.sleep(1)  # Small delay
                else:
                    logger.info('✓ No more pagination tokens')
                    break
                
            except Exception as e:
                logger.error(f'❌ Error: {str(e)}')
                import traceback
                traceback.print_exc()
                break
        
        logger.info('')
        logger.info('=' * 60)
        logger.info('✅ FETCH COMPLETE')
        logger.info('=' * 60)
        logger.info(f'Total fetched: {total_fetched}')
        logger.info(f'New tweets inserted: {total_inserted}')
        logger.info(f'Batches skipped (already in DB): {total_skipped}')
        logger.info('')
        
    finally:
        conn.close()
    
    return total_inserted


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='Smart fetch older tweets - skips already-ingested by date checking'
    )
    parser.add_argument('--handle', default='OPChoudhary_Ind', help='Twitter handle')
    parser.add_argument('--target-date', default='2023-12-01', help='Target date (YYYY-MM-DD)')
    parser.add_argument('--max-batches', type=int, help='Max batches to fetch')
    parser.add_argument('--test', action='store_true', help='Test mode: use max_results=2')
    
    args = parser.parse_args()
    target_date = datetime.strptime(args.target_date, '%Y-%m-%d').date()
    
    logger.info('=' * 60)
    logger.info('SMART OLDER TWEET FETCHER')
    logger.info('Skips already-ingested tweets by date checking')
    logger.info('=' * 60)
    logger.info(f'Target: @{args.handle}')
    logger.info(f'Target date: {target_date}')
    if args.test:
        logger.info('🧪 TEST MODE: Minimal API usage')
    logger.info('')
    
    try:
        total = fetch_older_tweets_smart(
            author_handle=args.handle,
            target_date=target_date,
            max_batches=args.max_batches,
            test_mode=args.test,
        )
        logger.info(f'✅ SUCCESS! Inserted {total} new tweets')
    except KeyboardInterrupt:
        logger.info('⚠️  Interrupted - progress saved')
        sys.exit(0)
    except Exception as e:
        logger.error(f'❌ Error: {str(e)}')
        sys.exit(1)


if __name__ == '__main__':
    main()

