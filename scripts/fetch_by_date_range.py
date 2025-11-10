#!/usr/bin/env python3
"""
Fetch Older Tweets Using Date Range - Based on Official Twitter API v2 Sample Code

This script uses start_time and end_time to fetch tweets directly from specific date ranges,
avoiding the need to paginate through newer tweets.

Strategy:
- Work backward in time from 2025-02-14 to 2023-12-01
- Use 1-month date ranges
- Fetch in small batches (5-10 tweets per range) to minimize API usage
- Test with minimal calls first

Usage (TEST - 1 month range):
    python3 scripts/fetch_by_date_range.py --handle OPChoudhary_Ind --start-date 2025-01-01 --end-date 2025-02-13 --max-results 5

Usage (FULL):
    python3 scripts/fetch_by_date_range.py --handle OPChoudhary_Ind --target-date 2023-12-01
"""

import os
import sys
import time
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2
import tweepy

sys.path.insert(0, str(Path(__file__).parent.parent))

# Setup logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).parent.parent / '.env.local')


def get_db_connection():
    """Get PostgreSQL database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found')
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


def insert_tweets(conn, tweets: list, author_handle: str):
    """Insert tweets into database (skip duplicates)."""
    inserted_count = 0
    
    with conn.cursor() as cur:
        for tweet in tweets:
            try:
                hashtags = [tag['tag'] for tag in tweet.get('entities', {}).get('hashtags', [])]
                mentions = [mention['username'] for mention in tweet.get('entities', {}).get('mentions', [])]
                urls = [url.get('url', '') for url in tweet.get('entities', {}).get('urls', [])]
                
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


def fetch_tweets_by_date_range(
    author_handle: str,
    start_time: datetime,
    end_time: datetime,
    max_results: int = 100,
    test_mode: bool = False
):
    """
    Fetch tweets using start_time and end_time date range.
    
    Based on Twitter API v2 sample code patterns.
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
    
    # Test mode: use minimal results
    if test_mode:
        max_results = min(max_results, 10)
    
    logger.info(f'Fetching tweets from {start_time.date()} to {end_time.date()}')
    logger.info(f'Using max_results={max_results}')
    
    try:
        # Fetch tweets with date range - Based on official API v2 sample code
        response = client.get_users_tweets(
            id=user_id,
            max_results=max_results,
            start_time=start_time,
            end_time=end_time,
            exclude=['retweets'],
            tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
        )
        
        if not response.data:
            logger.info(f'No tweets found in date range {start_time.date()} to {end_time.date()}')
            return 0
        
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
        
        # Insert into database
        conn = get_db_connection()
        inserted = insert_tweets(conn, tweets, author_handle)
        conn.close()
        
        logger.info(f'✅ Fetched {len(tweets)} tweets, inserted {inserted} new')
        return inserted
        
    except tweepy.TooManyRequests:
        logger.warning('Rate limit exceeded - will wait automatically')
        raise
    except Exception as e:
        logger.error(f'Error: {str(e)}')
        raise


def fetch_older_tweets_incremental(
    author_handle: str,
    target_date: datetime.date,
    start_from_date: datetime.date = None,
    month_chunks: bool = True,
    test_mode: bool = False
):
    """
    Fetch older tweets working backward in time using date ranges.
    
    Args:
        start_from_date: Start from this date (default: oldest tweet in DB - 1 day)
        month_chunks: If True, fetch in 1-month chunks, else use smaller ranges
        test_mode: If True, use minimal API calls (max_results=5)
    """
    conn = get_db_connection()
    
    # Get starting point
    if start_from_date:
        current_end = datetime.combine(start_from_date, datetime.min.time())
    else:
        oldest_db_date = get_oldest_tweet_date(conn)
        if oldest_db_date:
            # Start from 1 day before our oldest tweet
            current_end = datetime.combine(oldest_db_date - timedelta(days=1), datetime.max.time())
            logger.info(f'Starting from 1 day before oldest tweet: {oldest_db_date}')
        else:
            # No tweets in DB - start from today
            current_end = datetime.now()
            logger.info('No tweets in DB - starting from today')
    
    conn.close()
    
    target_datetime = datetime.combine(target_date, datetime.min.time())
    
    total_inserted = 0
    range_num = 1
    
    # Calculate chunk size
    chunk_days = 30 if month_chunks else 7
    
    logger.info('=' * 60)
    logger.info('FETCHING OLDER TWEETS BY DATE RANGE')
    logger.info('=' * 60)
    logger.info(f'Target date: {target_date}')
    logger.info(f'Chunk size: {chunk_days} days')
    if test_mode:
        logger.info('🧪 TEST MODE: Minimal API usage')
    logger.info('')
    
    try:
        while current_end > target_datetime:
            # Calculate date range for this chunk
            current_start = current_end - timedelta(days=chunk_days)
            
            # Ensure we don't go before target
            if current_start < target_datetime:
                current_start = target_datetime
            
            logger.info(f'📅 Range #{range_num}: {current_start.date()} to {current_end.date()}')
            
            # Fetch this date range
            max_results = 5 if test_mode else 100
            inserted = fetch_tweets_by_date_range(
                author_handle=author_handle,
                start_time=current_start,
                end_time=current_end,
                max_results=max_results,
                test_mode=test_mode
            )
            
            total_inserted += inserted
            
            # Move backward in time
            current_end = current_start - timedelta(days=1)
            range_num += 1
            
            # Small delay between ranges
            if not test_mode:
                time.sleep(2)
            
            # Safety: limit ranges in test mode
            if test_mode and range_num > 3:
                logger.info('🧪 Test mode: Limiting to 3 ranges')
                break
        
        logger.info('')
        logger.info('=' * 60)
        logger.info('✅ FETCH COMPLETE')
        logger.info('=' * 60)
        logger.info(f'Total new tweets inserted: {total_inserted}')
        
    except KeyboardInterrupt:
        logger.info('⚠️  Interrupted - progress saved')
    except Exception as e:
        logger.error(f'❌ Error: {str(e)}')
        raise
    
    return total_inserted


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Fetch older tweets using date range filtering (Twitter API v2)'
    )
    parser.add_argument('--handle', default='OPChoudhary_Ind', help='Twitter handle')
    parser.add_argument('--target-date', default='2023-12-01', help='Target date (YYYY-MM-DD)')
    parser.add_argument('--start-date', help='Start from this date (YYYY-MM-DD) - optional')
    parser.add_argument('--end-date', help='End at this date (YYYY-MM-DD) - optional')
    parser.add_argument('--max-results', type=int, default=100, help='Max results per request (5-100)')
    parser.add_argument('--test', action='store_true', help='Test mode: minimal API usage')
    parser.add_argument('--single-range', action='store_true', help='Fetch single date range only (use with --start-date and --end-date)')
    
    args = parser.parse_args()
    
    if args.single_range:
        # Single date range test
        if not args.start_date or not args.end_date:
            logger.error('--start-date and --end-date required for --single-range')
            sys.exit(1)
        
        start_time = datetime.strptime(args.start_date, '%Y-%m-%d')
        end_time = datetime.strptime(args.end_date, '%Y-%m-%d')
        
        logger.info('=' * 60)
        logger.info('SINGLE DATE RANGE TEST')
        logger.info('=' * 60)
        logger.info(f'Date range: {start_time.date()} to {end_time.date()}')
        logger.info('')
        
        try:
            inserted = fetch_tweets_by_date_range(
                author_handle=args.handle,
                start_time=start_time,
                end_time=end_time,
                max_results=args.max_results,
                test_mode=args.test
            )
            logger.info(f'✅ Inserted {inserted} new tweets')
        except Exception as e:
            logger.error(f'❌ Error: {str(e)}')
            sys.exit(1)
    else:
        # Incremental fetch backward in time
        target_date = datetime.strptime(args.target_date, '%Y-%m-%d').date()
        start_from = None
        if args.start_date:
            start_from = datetime.strptime(args.start_date, '%Y-%m-%d').date()
        
        try:
            total = fetch_older_tweets_incremental(
                author_handle=args.handle,
                target_date=target_date,
                start_from_date=start_from,
                test_mode=args.test
            )
            logger.info(f'✅ Total: {total} new tweets inserted')
        except Exception as e:
            logger.error(f'❌ Error: {str(e)}')
            sys.exit(1)


if __name__ == '__main__':
    main()

