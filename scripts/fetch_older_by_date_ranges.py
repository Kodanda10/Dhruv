#!/usr/bin/env python3
"""
Fetch Older Tweets Using Date Ranges - Working Backward from 2025-02-14

This script uses start_time and end_time to fetch tweets directly from specific date ranges,
working backward from our oldest tweet (2025-02-14) to target date (2023-12-01).

Strategy (based on official Twitter API v2 sample code):
- Start from 1 day before our oldest tweet (2025-02-13)
- Work backward in 1-month chunks
- Use start_time and end_time to fetch directly (no pagination needed)
- Test with minimal API calls first

Usage (TEST - 1 month):
    python3 scripts/fetch_older_by_date_ranges.py --handle OPChoudhary_Ind --target-date 2023-12-01 --test --max-ranges 1

Usage (FULL):
    python3 scripts/fetch_older_by_date_ranges.py --handle OPChoudhary_Ind --target-date 2023-12-01
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


def fetch_date_range(
    client: tweepy.Client,
    user_id: str,
    start_time: datetime,
    end_time: datetime,
    max_results: int = 100
):
    """
    Fetch tweets from a specific date range using start_time and end_time.
    
    Based on official Twitter API v2 sample code patterns.
    """
    try:
        response = client.get_users_tweets(
            id=user_id,
            max_results=max_results,
            start_time=start_time,
            end_time=end_time,
            exclude=['retweets'],
            tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
        )
        
        if not response.data:
            return []
        
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
        
        return tweets
        
    except Exception as e:
        logger.error(f'Error fetching date range: {str(e)}')
        raise


def main():
    """Main execution."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Fetch older tweets using date ranges (working backward)'
    )
    parser.add_argument('--handle', default='OPChoudhary_Ind', help='Twitter handle')
    parser.add_argument('--target-date', default='2023-12-01', help='Target date (YYYY-MM-DD)')
    parser.add_argument('--test', action='store_true', help='Test mode: minimal API usage')
    parser.add_argument('--max-ranges', type=int, help='Maximum date ranges to fetch (for testing)')
    parser.add_argument('--chunk-days', type=int, default=30, help='Days per date range chunk (default: 30)')
    
    args = parser.parse_args()
    
    target_date = datetime.strptime(args.target_date, '%Y-%m-%d').date()
    
    # Initialize Twitter client
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token:
        logger.error('❌ X_BEARER_TOKEN not found')
        sys.exit(1)
    
    client = tweepy.Client(
        bearer_token=bearer_token,
        wait_on_rate_limit=True,  # Auto-handle rate limits
    )
    
    # Get user
    user = client.get_user(username=args.handle)
    if not user.data:
        logger.error(f'❌ User @{args.handle} not found')
        sys.exit(1)
    
    user_id = user.data.id
    logger.info(f'✓ User: @{user.data.username} (ID: {user_id})')
    
    # Get starting point from database
    conn = get_db_connection()
    oldest_db_date = get_oldest_tweet_date(conn)
    
    if oldest_db_date:
        # Start from 1 day before our oldest tweet
        from datetime import timezone
        current_end = datetime.combine(oldest_db_date - timedelta(days=1), datetime.max.time()).replace(tzinfo=timezone.utc)
        logger.info(f'✓ Current oldest tweet in DB: {oldest_db_date}')
        logger.info(f'  Starting from: {current_end.date()} (1 day before oldest)')
    else:
        logger.error('❌ No tweets in database - cannot determine starting point')
        conn.close()
        sys.exit(1)
    
    conn.close()
    
    from datetime import timezone
    target_datetime = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    
    logger.info('=' * 60)
    logger.info('FETCHING OLDER TWEETS BY DATE RANGES')
    logger.info('=' * 60)
    logger.info(f'Strategy: Work backward from {current_end.date()} to {target_date}')
    logger.info(f'Chunk size: {args.chunk_days} days per range')
    if args.test:
        logger.info('🧪 TEST MODE: Minimal API usage')
    logger.info('')
    
    total_inserted = 0
    range_num = 1
    max_results = 5 if args.test else 100
    
    try:
        while current_end > target_datetime:
            # Check max ranges limit
            if args.max_ranges and range_num > args.max_ranges:
                logger.info(f'Reached maximum range limit ({args.max_ranges})')
                break
            
            # Calculate date range for this chunk (working backward)
            current_start = current_end - timedelta(days=args.chunk_days)
            
            # Ensure timezone-aware
            if current_start.tzinfo is None:
                from datetime import timezone
                current_start = current_start.replace(tzinfo=timezone.utc)
            
            # Ensure we don't go before target
            if current_start < target_datetime:
                current_start = target_datetime
            
            logger.info(f'📅 Range #{range_num}: {current_start.date()} to {current_end.date()}')
            
            # Fetch this date range
            try:
                tweets = fetch_date_range(
                    client=client,
                    user_id=user_id,
                    start_time=current_start,
                    end_time=current_end,
                    max_results=max_results
                )
                
                if not tweets:
                    logger.info(f'  ⚠️  No tweets found in this date range')
                else:
                    # Insert into database
                    conn = get_db_connection()
                    inserted = insert_tweets(conn, tweets, args.handle)
                    conn.close()
                    
                    total_inserted += inserted
                    
                    # Show date range of fetched tweets
                    if tweets:
                        dates = []
                        for tweet in tweets:
                            if tweet.get('created_at'):
                                try:
                                    date_str = tweet['created_at'][:10]
                                    dates.append(datetime.strptime(date_str, '%Y-%m-%d').date())
                                except:
                                    pass
                        
                        if dates:
                            oldest_fetched = min(dates)
                            newest_fetched = max(dates)
                            logger.info(f'  ✅ Fetched {len(tweets)} tweets, inserted {inserted} new')
                            logger.info(f'     Tweet dates: {oldest_fetched} to {newest_fetched}')
                            
                            # Check if we've reached target
                            if oldest_fetched <= target_date:
                                logger.info(f'  🎯 Reached target date!')
                                break
                    else:
                        logger.info(f'  ✅ Fetched {len(tweets)} tweets (all duplicates)')
                
            except Exception as e:
                logger.error(f'  ❌ Error fetching range: {str(e)}')
                import traceback
                traceback.print_exc()
                break
            
            # Move backward in time for next range
            current_end = current_start - timedelta(days=1)
            range_num += 1
            
            # Small delay between ranges
            if not args.test:
                time.sleep(2)
        
        logger.info('')
        logger.info('=' * 60)
        logger.info('✅ FETCH COMPLETE')
        logger.info('=' * 60)
        logger.info(f'Total date ranges processed: {range_num - 1}')
        logger.info(f'Total new tweets inserted: {total_inserted}')
        logger.info('')
        
    except KeyboardInterrupt:
        logger.info('⚠️  Interrupted - progress saved')
    except Exception as e:
        logger.error(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

