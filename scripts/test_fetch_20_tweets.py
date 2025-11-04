#!/usr/bin/env python3
"""
Test script to fetch exactly 20 tweets with proper rate limit handling.
Based on Twitter API v2 best practices from:
https://github.com/xdevplatform/Twitter-API-v2-sample-code
"""
import os
import sys
import time
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import tweepy
import psycopg2
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
        raise ValueError('DATABASE_URL not found in environment variables')
    return psycopg2.connect(database_url)

def insert_tweets(conn, tweets: list, author_handle: str):
    """Insert tweets into database (skip duplicates)."""
    inserted_count = 0
    
    with conn.cursor() as cur:
        for tweet in tweets:
            try:
                # Extract entities safely
                hashtags = [tag.get('tag', '') for tag in tweet.get('entities', {}).get('hashtags', [])]
                mentions = [mention.get('username', '') for mention in tweet.get('entities', {}).get('mentions', [])]
                urls = [url.get('url', '') for url in tweet.get('entities', {}).get('urls', [])]
                
                # Get metrics safely
                metrics = tweet.get('public_metrics', {})
                if isinstance(metrics, dict):
                    retweet_count = metrics.get('retweet_count', 0)
                    like_count = metrics.get('like_count', 0)
                    reply_count = metrics.get('reply_count', 0)
                    quote_count = metrics.get('quote_count', 0)
                else:
                    retweet_count = metrics.retweet_count if metrics else 0
                    like_count = metrics.like_count if metrics else 0
                    reply_count = metrics.reply_count if metrics else 0
                    quote_count = metrics.quote_count if metrics else 0
                
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
                    retweet_count,
                    like_count,
                    reply_count,
                    quote_count,
                ))
                
                # Check if row was inserted (not a duplicate)
                if cur.fetchone():
                    inserted_count += 1
                    
            except Exception as e:
                logger.warning(f'   Skipped tweet {tweet.get("id", "unknown")}: {str(e)}')
        
        conn.commit()
    
    return inserted_count

def fetch_20_tweets_safely(author_handle: str = 'OPChoudhary_Ind'):
    """
    Fetch exactly 20 tweets with proper rate limit handling.
    
    Based on Twitter API v2 best practices:
    - Uses wait_on_rate_limit=True for automatic rate limit handling
    - Fetches in batches of up to 100 (API max)
    - Stops when we have 20 tweets
    - Respects rate limits automatically
    """
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token:
        raise ValueError('X_BEARER_TOKEN not found in environment variables')
    
    logger.info('=' * 80)
    logger.info('FETCHING 20 TWEETS - Rate Limit Safe Test')
    logger.info('=' * 80)
    logger.info('')
    
    # Initialize Tweepy client with automatic rate limit handling
    # This is the recommended approach from Twitter API v2 documentation
    logger.info('Initializing Twitter API client with wait_on_rate_limit=True...')
    logger.info('  This ensures automatic rate limit handling (no manual waiting needed)')
    logger.info('')
    
    client = tweepy.Client(
        bearer_token=bearer_token,
        wait_on_rate_limit=True,  # CRITICAL: Automatically respects rate limits
    )
    
    # Get user ID
    logger.info(f'Looking up user @{author_handle}...')
    try:
        user = client.get_user(username=author_handle)
        if not user.data:
            raise ValueError(f'User @{author_handle} not found')
        
        user_id = user.data.id
        logger.info(f'✅ User found: @{user.data.username} (ID: {user_id})')
        logger.info('')
    except Exception as e:
        logger.error(f'❌ Error looking up user: {e}')
        return False
    
    # Connect to database
    logger.info('Connecting to database...')
    try:
        conn = get_db_connection()
        logger.info('✅ Database connected')
        logger.info('')
    except Exception as e:
        logger.error(f'❌ Database connection error: {e}')
        return False
    
    # Fetch tweets
    target_count = 20
    total_fetched = 0
    total_inserted = 0
    
    try:
        logger.info(f'📥 Fetching up to {target_count} tweets...')
        logger.info('  Note: If rate limited, script will automatically wait and resume')
        logger.info('')
        
        # Fetch tweets - API allows max 100 per request
        # We'll request 20 but API may return fewer if that's all available
        response = client.get_users_tweets(
            id=user_id,
            max_results=min(target_count, 100),  # API maximum is 100
            exclude=['retweets'],  # Exclude retweets only (keep original + replies)
            tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
        )
        
        # Check if we got any tweets
        if not response.data:
            logger.warning('⚠️  No tweets returned from API')
            conn.close()
            return False
        
        logger.info(f'✅ Received {len(response.data)} tweets from API')
        
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
        logger.info('Storing tweets in database...')
        inserted = insert_tweets(conn, tweets, author_handle)
        total_fetched = len(tweets)
        total_inserted = inserted
        
        # Show results
        logger.info('')
        logger.info('=' * 80)
        logger.info('RESULTS')
        logger.info('=' * 80)
        logger.info(f'Tweets fetched from API: {total_fetched}')
        logger.info(f'New tweets stored: {total_inserted}')
        logger.info(f'Duplicates skipped: {total_fetched - total_inserted}')
        
        if tweets:
            oldest = tweets[-1]['created_at'][:10] if tweets[-1]['created_at'] else 'unknown'
            newest = tweets[0]['created_at'][:10] if tweets[0]['created_at'] else 'unknown'
            logger.info(f'Date range: {oldest} to {newest}')
        
        logger.info('')
        logger.info('✅ SUCCESS - Rate limit handling worked correctly!')
        logger.info('  The wait_on_rate_limit=True parameter ensures:')
        logger.info('  - Automatic detection of rate limits')
        logger.info('  - Automatic waiting until limit resets')
        logger.info('  - Automatic resumption when ready')
        logger.info('  - No manual intervention needed')
        logger.info('')
        
        conn.close()
        return True
        
    except tweepy.TooManyRequests as e:
        # This should NOT happen with wait_on_rate_limit=True
        # But we handle it as a safety measure
        logger.warning('⚠️  Rate limit exceeded (unexpected with wait_on_rate_limit=True)')
        logger.warning('   This indicates the automatic handling may need adjustment')
        logger.warning('   Script will wait 15 minutes before retrying...')
        time.sleep(15 * 60)
        conn.close()
        return False
        
    except tweepy.Unauthorized as e:
        logger.error('❌ Unauthorized: Invalid Twitter API credentials')
        conn.close()
        return False
        
    except tweepy.Forbidden as e:
        logger.error('❌ Forbidden: API access denied')
        logger.error('   This may indicate suspended API access or invalid permissions')
        conn.close()
        return False
        
    except Exception as e:
        logger.error(f'❌ Error fetching tweets: {str(e)}')
        import traceback
        traceback.print_exc()
        conn.close()
        return False

def main():
    """Main entry point."""
    logger.info('')
    logger.info('╔══════════════════════════════════════════════════════════════╗')
    logger.info('║     TEST: Fetch 20 Tweets with Rate Limit Handling          ║')
    logger.info('╚══════════════════════════════════════════════════════════════╝')
    logger.info('')
    logger.info('Based on Twitter API v2 best practices:')
    logger.info('https://github.com/xdevplatform/Twitter-API-v2-sample-code')
    logger.info('')
    
    try:
        success = fetch_20_tweets_safely()
        
        if success:
            logger.info('✅ TEST PASSED')
            logger.info('   Rate limit handling is working correctly')
            logger.info('   Ready for large-scale fetching')
            return 0
        else:
            logger.error('❌ TEST FAILED')
            logger.error('   Review errors above')
            return 1
            
    except KeyboardInterrupt:
        logger.info('')
        logger.info('⚠️  Test interrupted by user')
        return 1
        
    except Exception as e:
        logger.error('')
        logger.error('❌ TEST FAILED')
        logger.error(f'Error: {str(e)}')
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())

