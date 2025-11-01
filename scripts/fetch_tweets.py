#!/usr/bin/env python3
"""
Tweet Fetcher Script

Fetches tweets from a Twitter user and stores them in a PostgreSQL database.

Usage:
    python scripts/fetch_tweets.py --handle opchoudhary --since 2023-12-01 --until 2025-10-31
    python scripts/fetch_tweets.py --handle opchoudhary --resume  # Continue from last fetch
"""

import os
import sys
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.src.twitter.client import TwitterClient

# Setup logging
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


def create_tweets_table(conn):
    """Create tweets table if it doesn't exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS raw_tweets (
                tweet_id VARCHAR PRIMARY KEY,
                author_handle VARCHAR NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                media_urls TEXT[],
                hashtags TEXT[],
                mentions TEXT[],
                urls TEXT[],
                retweet_count INT DEFAULT 0,
                like_count INT DEFAULT 0,
                reply_count INT DEFAULT 0,
                quote_count INT DEFAULT 0,
                fetched_at TIMESTAMP DEFAULT NOW(),
                processing_status VARCHAR DEFAULT 'pending'
            );
        """)
        conn.commit()
        logger.info('Tweets table ready')


def get_last_fetched_tweet_id(conn, author_handle: str) -> str:
    """Get the most recent tweet ID for a user (for resumable fetching)."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT tweet_id FROM raw_tweets
            WHERE author_handle = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (author_handle,))
        result = cur.fetchone()
        return result[0] if result else None


def insert_tweets(conn, tweets: list, author_handle: str):
    """Insert tweets into database (skip duplicates)."""
    with conn.cursor() as cur:
        for tweet in tweets:
            try:
                # Extract entities
                hashtags = [tag['tag'] for tag in tweet.get('entities', {}).get('hashtags', [])]
                mentions = [mention['username'] for mention in tweet.get('entities', {}).get('mentions', [])]
                urls = [url['url'] for url in tweet.get('entities', {}).get('urls', [])]
                
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
                    tweet['id'],
                    author_handle,
                    tweet['text'],
                    tweet['created_at'],
                    hashtags,
                    mentions,
                    urls,
                    tweet['public_metrics']['retweet_count'],
                    tweet['public_metrics']['like_count'],
                    tweet['public_metrics']['reply_count'],
                    tweet['public_metrics']['quote_count'],
                ))
            except Exception as e:
                logger.error(f'Error inserting tweet {tweet["id"]}: {str(e)}')
        
        conn.commit()
        logger.info(f'Inserted {len(tweets)} tweets')


def fetch_tweets_incremental(
    client: TwitterClient,
    conn,
    author_handle: str,
    start_date: datetime,
    end_date: datetime,
    resume: bool = False,
):
    """
    Fetch tweets incrementally with rate limiting.
    
    Strategy:
    - Fetch 100 tweets at a time (API max per request)
    - Exclude retweets (only original tweets)
    - Use pagination with since_id to resume
    - Respect rate limits (1 request per 15 minutes for free tier)
    - Pause 15 minutes between batches
    """
    total_fetched = 0
    since_id = None
    
    if resume:
        since_id = get_last_fetched_tweet_id(conn, author_handle)
        if since_id:
            logger.info(f'Resuming from tweet ID: {since_id}')
    
    # Fetch in batches of 100 tweets (API max per request)
    batch_size = 100
    current_date = start_date
    batch_num = 1
    
    while current_date < end_date:
        # Calculate batch end date (1 month at a time)
        batch_end = min(current_date + timedelta(days=30), end_date)
        
        logger.info(f'Batch #{batch_num}: Fetching tweets from {current_date.date()} to {batch_end.date()}')
        
        try:
            # Fetch batch (100 tweets max, excluding retweets)
            # Note: If date range returns no results, try without date filter
            tweets = client.fetch_user_tweets(
                username=author_handle,
                max_results=batch_size,
                start_time=current_date,
                end_time=batch_end,
                since_id=since_id,
            )
            
            # If no tweets with date filter, try without date filter for this batch
            if not tweets and batch_num == 1:
                logger.warning('No tweets found with date filter, trying without date filter...')
                tweets = client.fetch_user_tweets(
                    username=author_handle,
                    max_results=batch_size,
                    since_id=since_id,
                )
            
            if not tweets:
                logger.info('No more tweets found')
                break
            
            # Insert into database
            insert_tweets(conn, tweets, author_handle)
            total_fetched += len(tweets)
            
            # Update since_id for next iteration
            since_id = tweets[0]['id']  # Most recent tweet ID
            
            # Progress update
            logger.info(f'✓ Batch #{batch_num} complete: {len(tweets)} tweets fetched')
            logger.info(f'✓ Total progress: {total_fetched} tweets fetched so far')
            
            # If we got fewer than batch_size, we've reached the end
            if len(tweets) < batch_size:
                logger.info('Reached end of available tweets')
                break
            
            # Move to next batch
            current_date = batch_end + timedelta(days=1)
            batch_num += 1
            
            # Pause to respect rate limits (15 minutes for free tier)
            logger.info('⏸️  Rate limit: Pausing for 15 minutes before next batch...')
            logger.info(f'   Next batch will start at: {datetime.now() + timedelta(minutes=15)}')
            time.sleep(15 * 60)  # 15 minutes = 900 seconds
            
        except Exception as e:
            logger.error(f'Error fetching batch: {str(e)}')
            break
    
    return total_fetched


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Fetch tweets from Twitter')
    parser.add_argument('--handle', required=True, help='Twitter username (without @)')
    parser.add_argument('--since', help='Start date (YYYY-MM-DD)')
    parser.add_argument('--until', help='End date (YYYY-MM-DD)')
    parser.add_argument('--resume', action='store_true', help='Resume from last fetch')
    parser.add_argument('--limit', type=int, default=500, help='Max tweets to fetch (default: 500)')
    
    args = parser.parse_args()
    
    # Parse dates
    if args.resume:
        start_date = datetime(2023, 12, 1)  # Default start
        end_date = datetime(2025, 10, 31)   # Default end
    else:
        if not args.since or not args.until:
            logger.error('--since and --until are required unless using --resume')
            sys.exit(1)
        
        start_date = datetime.fromisoformat(args.since)
        end_date = datetime.fromisoformat(args.until)
    
    logger.info(f'Fetching tweets for @{args.handle}')
    logger.info(f'Date range: {start_date.date()} to {end_date.date()}')
    
    try:
        # Initialize Twitter client
        client = TwitterClient()
        
        # Get database connection
        conn = get_db_connection()
        
        # Create table if needed
        create_tweets_table(conn)
        
        # Fetch tweets
        total = fetch_tweets_incremental(
            client=client,
            conn=conn,
            author_handle=args.handle,
            start_date=start_date,
            end_date=end_date,
            resume=args.resume,
        )
        
        logger.info(f'✅ Successfully fetched {total} tweets')
        
        # Close connection
        conn.close()
        
    except Exception as e:
        logger.error(f'❌ Error: {str(e)}')
        sys.exit(1)


if __name__ == '__main__':
    main()

