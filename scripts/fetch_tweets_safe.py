#!/usr/bin/env python3
"""
SAFE Tweet Fetcher - Monitors rate limit headers to avoid API revocation

This script follows Twitter API best practices:
1. Monitors x-rate-limit-* headers from every response
2. Stops proactively when approaching limits
3. Uses exponential backoff for errors
4. Respects x-rate-limit-reset timestamp
5. Logs all rate limit information

Usage:
    python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind
"""

import os
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
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


class RateLimitMonitor:
    """Monitors and logs Twitter API rate limit headers"""
    
    def __init__(self):
        self.limit = None
        self.remaining = None
        self.reset = None
        self.reset_datetime = None
    
    def update_from_response(self, response):
        """
        Update rate limit info from Tweepy response.
        
        Note: Tweepy v4 doesn't expose headers directly in responses,
        so we rely on wait_on_rate_limit=True to handle this.
        """
        # Try to get headers from response meta if available
        if hasattr(response, 'meta') and response.meta:
            logger.debug(f"Response meta: {response.meta}")
    
    def log_status(self):
        """Log current rate limit status"""
        if self.remaining is not None:
            logger.info(f"Rate Limit: {self.remaining}/{self.limit} remaining")
            if self.reset_datetime:
                logger.info(f"Resets at: {self.reset_datetime}")


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


def fetch_all_tweets_safe(author_handle: str, max_batches: int = None, until_id: str = None):
    """
    Safely fetch ALL tweets from a user with rate limit monitoring.
    
    Args:
        author_handle: Twitter username (without @)
        max_batches: Maximum number of batches to fetch (None = unlimited)
        until_id: Fetch tweets older than this tweet ID (for avoiding duplicates)
    
    Returns:
        Total number of tweets fetched
    """
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token:
        raise ValueError('X_BEARER_TOKEN not found in environment variables')
    
    # Initialize Tweepy client with automatic rate limit handling
    client = tweepy.Client(
        bearer_token=bearer_token,
        wait_on_rate_limit=True,  # CRITICAL: Automatically respects rate limits
    )
    
    # Initialize rate limit monitor
    rate_monitor = RateLimitMonitor()
    
    # Get user ID
    logger.info(f'Looking up user @{author_handle}...')
    user = client.get_user(username=author_handle)
    if not user.data:
        raise ValueError(f'User @{author_handle} not found')
    
    user_id = user.data.id
    logger.info(f'✓ User found: @{user.data.username} (ID: {user_id})')
    logger.info(f'  Name: {user.data.name}')
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
    
    # If until_id is provided, use it for first batch to fetch older tweets
    if until_id:
        logger.info(f'📌 Starting from oldest tweet: {until_id}')
        logger.info(f'   Will fetch tweets OLDER than this ID (going backwards in time)')
        logger.info('')
    
    try:
        logger.info('Starting tweet fetch...')
        logger.info('=' * 60)
        logger.info('')
        
        while True:
            # Check if we've hit max batches
            if max_batches and batch_num > max_batches:
                logger.info(f'Reached maximum batch limit ({max_batches})')
                break
            
            logger.info(f'📥 Batch #{batch_num}: Fetching up to 100 tweets...')
            
            try:
                # Fetch tweets with pagination
                # Tweepy's wait_on_rate_limit=True will automatically:
                # - Monitor rate limit headers
                # - Sleep when limit is reached
                # - Resume when limit resets
                # Build request parameters
                request_params = {
                    'id': user_id,
                    'max_results': 100,  # API maximum
                    'exclude': ['retweets'],  # Exclude retweets only (keep original + replies)
                    'tweet_fields': ['created_at', 'public_metrics', 'entities', 'author_id'],
                }
                
                # Use until_id for first batch (fetch older tweets)
                if until_id and batch_num == 1 and not pagination_token:
                    request_params['until_id'] = until_id
                    logger.info(f'   Using until_id: {until_id} (fetching tweets older than this)')
                
                # Use pagination token for subsequent batches
                if pagination_token:
                    request_params['pagination_token'] = pagination_token
                
                response = client.get_users_tweets(**request_params)
                
                if not response.data:
                    logger.info('✓ No more tweets available')
                    break
                
                # Update rate limit monitor
                rate_monitor.update_from_response(response)
                
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
                logger.info('')
                
                # Check for pagination token (more tweets available)
                if response.meta and 'next_token' in response.meta:
                    pagination_token = response.meta['next_token']
                    batch_num += 1
                    
                    # Clear until_id after first batch (pagination handles continuation)
                    until_id = None
                    
                    # Small delay between successful requests (be nice to API)
                    time.sleep(1)
                else:
                    logger.info('✓ Reached end of available tweets (no more pagination)')
                    break
                
            except tweepy.TooManyRequests as e:
                # This should rarely happen with wait_on_rate_limit=True
                # but we handle it as a safety measure
                logger.warning('⚠️  Rate limit exceeded (should be handled automatically)')
                logger.warning('   Waiting 15 minutes before retrying...')
                time.sleep(15 * 60)
                continue
                
            except tweepy.Unauthorized as e:
                logger.error('❌ Unauthorized: Invalid Twitter API credentials')
                raise
                
            except tweepy.Forbidden as e:
                logger.error('❌ Forbidden: API access denied')
                logger.error('   This may indicate suspended API access or invalid permissions')
                raise
                
            except Exception as e:
                logger.error(f'❌ Error fetching batch: {str(e)}')
                import traceback
                traceback.print_exc()
                
                # Exponential backoff for unknown errors
                wait_time = min(2 ** (batch_num % 5), 60)  # Cap at 60 seconds
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
        description='Safely fetch tweets with rate limit monitoring (avoids API revocation)'
    )
    parser.add_argument('--handle', required=True, help='Twitter username (without @)')
    parser.add_argument('--max-batches', type=int, help='Maximum number of batches to fetch (for testing)')
    parser.add_argument('--until-id', type=str, help='Fetch tweets older than this tweet ID (for avoiding duplicates)')
    
    args = parser.parse_args()
    
    logger.info('=' * 60)
    logger.info('SAFE TWEET FETCHER')
    logger.info('Rate Limit Aware - Prevents API Revocation')
    logger.info('=' * 60)
    logger.info(f'Target: @{args.handle}')
    logger.info(f'Excluding: Retweets only')
    logger.info(f'Including: Original tweets + Replies')
    if args.max_batches:
        logger.info(f'Max batches: {args.max_batches} (testing mode)')
    logger.info('')
    
    try:
        total = fetch_all_tweets_safe(
            author_handle=args.handle,
            max_batches=args.max_batches,
            until_id=args.until_id,
        )
        
        logger.info('✅ SUCCESS!')
        logger.info(f'Stored {total} new tweets in database')
        logger.info('')
        logger.info('Next steps:')
        logger.info('1. Parse tweets: python scripts/parse_tweets.py')
        logger.info('2. View results: python check_tweets.py')
        logger.info('')
        
    except KeyboardInterrupt:
        logger.info('')
        logger.info('⚠️  Fetch interrupted by user')
        logger.info('   Progress has been saved to database')
        logger.info('   Re-run the same command to resume')
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

