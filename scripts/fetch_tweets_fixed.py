#!/usr/bin/env python3
"""
Fixed Tweet Fetcher - Uses correct pagination with pagination_token

This script properly fetches ALL tweets using the Twitter API v2 pagination system.

Usage:
    python scripts/fetch_tweets_fixed.py --handle OPChoudhary_Ind
"""

import os
import sys
import time
from pathlib import Path
import psycopg2
from dotenv import load_dotenv
import tweepy

sys.path.insert(0, str(Path(__file__).parent.parent))

# Setup logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
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
    with conn.cursor() as cur:
        for tweet in tweets:
            try:
                # Extract entities
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
            except Exception as e:
                logger.error(f'Error inserting tweet {tweet.get("id", "unknown")}: {str(e)}')
        
        conn.commit()
        logger.info(f'Inserted {len(tweets)} tweets')


def fetch_all_tweets(author_handle: str):
    """
    Fetch ALL tweets from a user using proper pagination.
    
    Strategy:
    - Use pagination_token for backward pagination (older tweets)
    - Fetch 100 tweets at a time (API max)
    - Respect rate limits (wait_on_rate_limit=True)
    - Continue until no more pagination_token
    """
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token:
        raise ValueError('X_BEARER_TOKEN not found in environment variables')
    
    # Initialize Tweepy client
    client = tweepy.Client(
        bearer_token=bearer_token,
        wait_on_rate_limit=True,
    )
    
    # Get user ID
    user = client.get_user(username=author_handle)
    if not user.data:
        raise ValueError(f'User @{author_handle} not found')
    
    user_id = user.data.id
    logger.info(f'User found: @{author_handle} (ID: {user_id})')
    
    # Connect to database
    conn = get_db_connection()
    logger.info('Connected to database')
    
    # Pagination variables
    pagination_token = None
    total_fetched = 0
    batch_num = 1
    
    try:
        while True:
            logger.info(f'Batch #{batch_num}: Fetching tweets...')
            
            try:
                # Fetch tweets with pagination
                response = client.get_users_tweets(
                    id=user_id,
                    max_results=100,
                    pagination_token=pagination_token,
                    exclude=['retweets'],  # Exclude retweets only
                    tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
                )
                
                if not response.data:
                    logger.info('No more tweets found')
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
                
                # Insert into database
                insert_tweets(conn, tweets, author_handle)
                total_fetched += len(tweets)
                
                # Progress update
                logger.info(f'✓ Batch #{batch_num} complete: {len(tweets)} tweets fetched')
                logger.info(f'✓ Total progress: {total_fetched} tweets fetched so far')
                
                # Check if there are more tweets (pagination_token in meta)
                if response.meta and 'next_token' in response.meta:
                    pagination_token = response.meta['next_token']
                    logger.info(f'  Pagination token: {pagination_token[:20]}...')
                    
                    # Move to next batch
                    batch_num += 1
                    
                    # Rate limiting is handled automatically by wait_on_rate_limit=True
                    # But we add a small delay between batches
                    logger.info('  Waiting 2 seconds before next batch...')
                    time.sleep(2)
                else:
                    logger.info('✓ Reached end of available tweets (no more pagination token)')
                    break
                
            except tweepy.TooManyRequests as e:
                logger.warning('Rate limit exceeded, waiting...')
                # wait_on_rate_limit should handle this automatically
                raise
            except Exception as e:
                logger.error(f'Error fetching batch: {str(e)}')
                import traceback
                traceback.print_exc()
                break
        
        logger.info('')
        logger.info('=' * 60)
        logger.info(f'✅ FETCH COMPLETE: {total_fetched} tweets fetched')
        logger.info('=' * 60)
        
    finally:
        conn.close()
    
    return total_fetched


def main():
    """Main entry point."""
    import argparse
    parser = argparse.ArgumentParser(description='Fetch ALL tweets from a Twitter user (FIXED VERSION)')
    parser.add_argument('--handle', required=True, help='Twitter username (without @)')
    
    args = parser.parse_args()
    
    logger.info('=' * 60)
    logger.info('TWEET FETCHER (FIXED - Using pagination_token)')
    logger.info('=' * 60)
    logger.info(f'Fetching tweets for @{args.handle}')
    logger.info('Excluding retweets (original tweets + replies only)')
    logger.info('')
    
    try:
        total = fetch_all_tweets(author_handle=args.handle)
        
        logger.info('')
        logger.info('✅ SUCCESS!')
        logger.info(f'Total tweets fetched: {total}')
        logger.info('')
        logger.info('Next steps:')
        logger.info('1. Run: python scripts/parse_tweets.py')
        logger.info('2. View parsed events in dashboard')
        
    except Exception as e:
        logger.error(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

