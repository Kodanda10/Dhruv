#!/usr/bin/env python3
"""
SAFE Tweet Fetcher - Fetches older tweets using pagination_token (not until_id)

This script correctly fetches older tweets by:
1. Starting from newest tweets
2. Using pagination_token to go backward in time
3. Continuing until reaching target date or no more tweets

The key: until_id doesn't work for backward pagination - must use pagination_token!
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
                
                # Check if row was inserted (not a duplicate)
                if cur.fetchone():
                    inserted_count += 1
                    
            except Exception as e:
                logger.error(f'Error inserting tweet {tweet.get("id", "unknown")}: {str(e)}')
        
        conn.commit()
    
    logger.info(f'✓ Inserted {inserted_count} new tweets (skipped {len(tweets) - inserted_count} duplicates)')
    return inserted_count


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


def fetch_older_tweets_until_date(
    author_handle: str, 
    target_date: datetime.date,
    max_batches: int = None
):
    """
    Fetch tweets going backward in time until reaching target_date.
    
    Uses pagination_token (NOT until_id) to correctly fetch older tweets.
    """
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token:
        raise ValueError('X_BEARER_TOKEN not found in environment variables')
    
    # Initialize Tweepy client with automatic rate limit handling
    client = tweepy.Client(
        bearer_token=bearer_token,
        wait_on_rate_limit=True,  # CRITICAL: Automatically respects rate limits
    )
    
    # Get user ID
    logger.info(f'Looking up user @{author_handle}...')
    user = client.get_user(username=author_handle)
    if not user.data:
        raise ValueError(f'User @{author_handle} not found')
    
    user_id = user.data.id
    logger.info(f'✓ User found: @{user.data.username} (ID: {user_id})')
    logger.info('')
    
    # Connect to database
    conn = get_db_connection()
    logger.info('✓ Connected to database')
    logger.info('')
    
    # Pagination variables
    pagination_token = None
    total_fetched = 0
    total_inserted = 0
    batch_num = 1
    reached_target_date = False
    
    try:
        logger.info('Starting tweet fetch (going backward in time)...')
        logger.info(f'Target date: {target_date}')
        logger.info('=' * 60)
        logger.info('')
        
        while True:
            # Check if we've hit max batches
            if max_batches and batch_num > max_batches:
                logger.info(f'Reached maximum batch limit ({max_batches})')
                break
            
            logger.info(f'📥 Batch #{batch_num}: Fetching up to 100 tweets...')
            
            try:
                # Build request parameters
                request_params = {
                    'id': user_id,
                    'max_results': 100,  # API maximum
                    'exclude': ['retweets'],  # Exclude retweets only
                    'tweet_fields': ['created_at', 'public_metrics', 'entities', 'author_id'],
                }
                
                # Use pagination token for subsequent batches (going backward)
                if pagination_token:
                    request_params['pagination_token'] = pagination_token
                    logger.info(f'   Using pagination_token (fetching older tweets)')
                
                response = client.get_users_tweets(**request_params)
                
                if not response.data:
                    logger.info('✓ No more tweets available')
                    break
                
                # Convert to list of dicts
                tweets = []
                oldest_tweet_date = None
                for tweet in response.data:
                    tweet_date = tweet.created_at.date() if tweet.created_at else None
                    if tweet_date and (not oldest_tweet_date or tweet_date < oldest_tweet_date):
                        oldest_tweet_date = tweet_date
                    
                    tweets.append({
                        'id': tweet.id,
                        'text': tweet.text,
                        'created_at': tweet.created_at.isoformat() if tweet.created_at else None,
                        'author_id': tweet.author_id,
                        'public_metrics': tweet.public_metrics if tweet.public_metrics else {},
                        'entities': tweet.entities if tweet.entities else {},
                    })
                
                # Check if we've reached target date
                if oldest_tweet_date and oldest_tweet_date <= target_date:
                    logger.info(f'✓ Reached target date! Oldest tweet in batch: {oldest_tweet_date}')
                    reached_target_date = True
                    # Still insert this batch (might have tweets up to target date)
                
                # Insert into database
                inserted = insert_tweets(conn, tweets, author_handle)
                total_fetched += len(tweets)
                total_inserted += inserted
                
                # Show date range for this batch
                if tweets:
                    oldest = tweets[-1]['created_at'][:10] if tweets[-1]['created_at'] else 'unknown'
                    newest = tweets[0]['created_at'][:10] if tweets[0]['created_at'] else 'unknown'
                    logger.info(f'  Date range: {oldest} to {newest}')
                
                # Progress update
                logger.info(f'  Progress: {total_fetched} tweets fetched, {total_inserted} new tweets stored')
                if oldest_tweet_date:
                    days_remaining = (oldest_tweet_date - target_date).days
                    logger.info(f'  Days remaining to target: {days_remaining}')
                logger.info('')
                
                # Check if we've reached target date
                if reached_target_date:
                    logger.info('✅ Target date reached!')
                    break
                
                # Check for pagination token (more tweets available)
                if response.meta and 'next_token' in response.meta:
                    pagination_token = response.meta['next_token']
                    batch_num += 1
                    
                    # Small delay between successful requests (be nice to API)
                    time.sleep(1)
                else:
                    logger.info('✓ Reached end of available tweets (no more pagination)')
                    break
                
            except tweepy.TooManyRequests as e:
                logger.warning('⚠️  Rate limit exceeded (should be handled automatically)')
                logger.warning('   Waiting 15 minutes before retrying...')
                time.sleep(15 * 60)
                continue
                
            except tweepy.Unauthorized as e:
                logger.error('❌ Unauthorized: Invalid Twitter API credentials')
                raise
                
            except tweepy.Forbidden as e:
                logger.error('❌ Forbidden: API access denied')
                raise
                
            except Exception as e:
                logger.error(f'❌ Error fetching batch: {str(e)}')
                import traceback
                traceback.print_exc()
                wait_time = min(2 ** (batch_num % 5), 60)
                logger.info(f'   Waiting {wait_time} seconds before retry...')
                time.sleep(wait_time)
                continue
        
        logger.info('')
        logger.info('=' * 60)
        logger.info('✅ FETCH COMPLETE')
        logger.info('=' * 60)
        logger.info(f'Total tweets fetched: {total_fetched}')
        logger.info(f'New tweets stored: {total_inserted}')
        logger.info(f'Duplicates skipped: {total_fetched - total_inserted}')
        logger.info('')
        
    finally:
        conn.close()
        logger.info('Database connection closed')
    
    return total_inserted


def main():
    """Main entry point."""
    import argparse
    parser = argparse.ArgumentParser(
        description='Safely fetch older tweets until target date using pagination_token'
    )
    parser.add_argument('--handle', default='OPChoudhary_Ind', help='Twitter username (without @)')
    parser.add_argument('--target-date', default='2023-12-01', help='Target date (YYYY-MM-DD)')
    parser.add_argument('--max-batches', type=int, help='Maximum number of batches to fetch')
    
    args = parser.parse_args()
    
    target_date = datetime.strptime(args.target_date, '%Y-%m-%d').date()
    
    logger.info('=' * 60)
    logger.info('SAFE OLDER TWEET FETCHER')
    logger.info('Uses pagination_token (NOT until_id) for backward pagination')
    logger.info('=' * 60)
    logger.info(f'Target: @{args.handle}')
    logger.info(f'Target date: {target_date}')
    if args.max_batches:
        logger.info(f'Max batches: {args.max_batches}')
    logger.info('')
    
    try:
        total = fetch_older_tweets_until_date(
            author_handle=args.handle,
            target_date=target_date,
            max_batches=args.max_batches,
        )
        
        logger.info('✅ SUCCESS!')
        logger.info(f'Stored {total} new tweets in database')
        logger.info('')
        
    except KeyboardInterrupt:
        logger.info('')
        logger.info('⚠️  Fetch interrupted by user')
        logger.info('   Progress has been saved to database')
        sys.exit(0)
        
    except Exception as e:
        logger.error('')
        logger.error('❌ FETCH FAILED')
        logger.error(f'Error: {str(e)}')
        logger.error('')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

