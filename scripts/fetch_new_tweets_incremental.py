#!/usr/bin/env python3
"""
Incremental Tweet Fetcher - For Cron Jobs

Fetches ONLY new tweets (since last fetch) - designed for hourly/2-hourly cron jobs.
- Uses since_id to get tweets newer than the newest tweet in database
- Fetches forward in time (newer tweets only)
- Respects rate limits automatically
- Designed for automated cron execution
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


def get_newest_tweet_id(conn, author_handle: str):
    """Get the newest tweet ID from database (for since_id pagination)."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT tweet_id, created_at
            FROM raw_tweets
            WHERE author_handle = %s
            ORDER BY created_at DESC, tweet_id DESC
            LIMIT 1
        """, (author_handle,))
        result = cur.fetchone()
        if result:
            logger.info(f'Newest tweet in DB: {result[0]} from {result[1]}')
            return result[0]
        return None


def insert_tweets(conn, tweets: list, author_handle: str):
    """Insert tweets into database (skip duplicates)."""
    inserted_count = 0
    
    with conn.cursor() as cur:
        for tweet in tweets:
            try:
                # Extract entities safely
                entities = tweet.get('entities', {})
                hashtags = [tag.get('tag', '') for tag in entities.get('hashtags', [])]
                mentions = [m.get('username', '') for m in entities.get('mentions', [])]
                urls = [url.get('url', '') for url in entities.get('urls', [])]
                
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
                    tweet.get('text', ''),
                    tweet.get('created_at'),
                    hashtags,
                    mentions,
                    urls,
                    tweet.get('public_metrics', {}).get('retweet_count', 0),
                    tweet.get('public_metrics', {}).get('like_count', 0),
                    tweet.get('public_metrics', {}).get('reply_count', 0),
                    tweet.get('public_metrics', {}).get('quote_count', 0),
                ))
                
                # Check if row was inserted (not a duplicate)
                if cur.fetchone():
                    inserted_count += 1
                    
            except Exception as e:
                logger.error(f'Error inserting tweet {tweet.get("id", "unknown")}: {str(e)}')
        
        conn.commit()
    
    return inserted_count


def fetch_new_tweets_incremental(author_handle: str, max_tweets: int = 100):
    """
    Fetch only NEW tweets (newer than newest tweet in database).
    
    Strategy:
    - Use since_id with newest tweet ID to get tweets newer than that
    - Fetches forward in time (newer tweets)
    - Stops when no new tweets found
    - Respects rate limits automatically
    
    Args:
        author_handle: Twitter username (without @)
        max_tweets: Maximum tweets to fetch per run (default: 100)
    
    Returns:
        Number of new tweets inserted
    """
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token:
        raise ValueError('X_BEARER_TOKEN not found in environment variables')
    
    # Initialize Tweepy client with automatic rate limit handling
    client = tweepy.Client(
        bearer_token=bearer_token,
        wait_on_rate_limit=True,
    )
    
    # Connect to database
    conn = get_db_connection()
    
    try:
        # Get newest tweet ID for since_id
        since_id = get_newest_tweet_id(conn, author_handle)
        
        if not since_id:
            logger.warning('⚠️  No tweets in database - will fetch from newest available')
            logger.warning('   This is first run - will fetch recent tweets')
        
        # Get user ID
        logger.info(f'Looking up user @{author_handle}...')
        user = client.get_user(username=author_handle)
        if not user.data:
            raise ValueError(f'User @{author_handle} not found')
        
        user_id = user.data.id
        logger.info(f'✓ User found: @{user.data.username} (ID: {user_id})')
        logger.info('')
        
        # Fetch new tweets
        total_fetched = 0
        total_inserted = 0
        batch_num = 1
        max_batches = (max_tweets // 100) + 1
        
        logger.info('=' * 80)
        logger.info('INCREMENTAL TWEET FETCH - NEW TWEETS ONLY')
        logger.info('=' * 80)
        logger.info(f'Fetching tweets newer than tweet ID: {since_id or "N/A (first run)"}')
        logger.info(f'Max tweets per run: {max_tweets}')
        logger.info('')
        
        while total_inserted < max_tweets:
            if batch_num > max_batches:
                logger.info(f'Reached maximum batch limit ({max_batches})')
                break
            
            logger.info(f'📥 Batch #{batch_num}: Fetching up to 100 new tweets...')
            
            try:
                # Build request parameters
                request_params = {
                    'id': user_id,
                    'max_results': 100,
                    'exclude': ['retweets'],
                    'tweet_fields': ['created_at', 'public_metrics', 'entities', 'author_id'],
                }
                
                # Use since_id to get tweets NEWER than our newest tweet
                if since_id:
                    request_params['since_id'] = since_id
                    logger.info(f'  Using since_id: {since_id} (fetching tweets newer than this)')
                
                response = client.get_users_tweets(**request_params)
                
                if not response.data:
                    logger.info('✓ No new tweets found')
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
                
                # Update since_id to newest tweet ID for next batch
                if tweets:
                    since_id = tweets[0]['id']  # Newest tweet ID
                
                # Check if we've reached our target
                if total_inserted >= max_tweets:
                    logger.info(f'✅ TARGET REACHED: Inserted {total_inserted} new tweets')
                    break
                
                # Check for pagination token (more new tweets available)
                if response.meta and 'next_token' in response.meta:
                    pagination_token = response.meta['next_token']
                    batch_num += 1
                    
                    # Small delay between successful requests
                    time.sleep(1)
                else:
                    logger.info('✓ Reached end of available new tweets (no more pagination)')
                    break
                    
            except tweepy.TooManyRequests as e:
                logger.warning('⚠️  Rate limit exceeded (should be handled automatically)')
                logger.warning('   Waiting for rate limit reset...')
                time.sleep(60)
                continue
                
            except Exception as e:
                logger.error(f'❌ Error fetching batch: {str(e)}')
                import traceback
                traceback.print_exc()
                break
        
        logger.info('')
        logger.info('=' * 80)
        logger.info('✅ FETCH COMPLETE')
        logger.info('=' * 80)
        logger.info(f'Total tweets fetched: {total_fetched:,}')
        logger.info(f'New tweets stored: {total_inserted:,}')
        logger.info(f'Duplicates skipped: {total_fetched - total_inserted:,}')
        logger.info('')
        
    finally:
        conn.close()
        logger.info('Database connection closed')
    
    return total_inserted


def main():
    """Main entry point for cron jobs."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Fetch new tweets incrementally (for cron jobs)')
    parser.add_argument('--handle', default='OPChoudhary_Ind', help='Twitter username (without @)')
    parser.add_argument('--max-tweets', type=int, default=100, help='Maximum tweets to fetch per run (default: 100)')
    parser.add_argument('--parse', action='store_true', help='Also parse fetched tweets (respects Gemini rate limits)')
    parser.add_argument('--parse-delay', type=float, default=6.0, help='Seconds between parsing tweets to respect Gemini rate limits (default: 6s = 10 RPM)')
    
    args = parser.parse_args()
    
    try:
        inserted = fetch_new_tweets_incremental(args.handle, args.max_tweets)
        
        # Parse if requested
        if args.parse and inserted > 0:
            logger.info('')
            logger.info('=' * 80)
            logger.info('PARSING NEW TWEETS (with Gemini rate limit protection)')
            logger.info('=' * 80)
            logger.info(f'⚠️  Gemini Free Tier Limits: 10 RPM (Flash) or 5 RPM (Pro)')
            logger.info(f'   Using delay: {args.parse_delay}s between tweets = {60/args.parse_delay:.1f} RPM')
            logger.info('')
            
            # Import parsing script
            parse_script = Path(__file__).parent / 'parse_tweets_with_three_layer.py'
            if parse_script.exists():
                import subprocess
                logger.info(f'Running parsing script: {parse_script}')
                logger.info(f'   This will parse {inserted} new tweets with rate limiting...')
                logger.info('')
                
                # Run parsing with rate limit protection
                result = subprocess.run(
                    [
                        sys.executable,
                        str(parse_script),
                        '--limit', str(inserted),
                        '--batch-delay', str(args.parse_delay),
                    ],
                    capture_output=True,
                    text=True,
                )
                
                if result.returncode == 0:
                    logger.info('✅ Parsing completed successfully')
                    logger.info(result.stdout[-500:] if len(result.stdout) > 500 else result.stdout)
                else:
                    logger.warning('⚠️  Parsing completed with warnings')
                    logger.warning(result.stderr[-500:] if len(result.stderr) > 500 else result.stderr)
            else:
                logger.warning(f'⚠️  Parsing script not found: {parse_script}')
                logger.warning('   Skipping parsing - tweets will be parsed later')
        
        # Exit with appropriate code for cron monitoring
        if inserted > 0:
            logger.info(f'✅ Successfully fetched {inserted} new tweets')
            sys.exit(0)
        else:
            logger.info('ℹ️  No new tweets found')
            sys.exit(0)  # Still success - just no new tweets
            
    except Exception as e:
        logger.error(f'❌ Fatal error: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

