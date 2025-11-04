#!/usr/bin/env python3
"""
Fetch ALL tweets from a user (no date restrictions)

This script fetches all available tweets from a user by paginating through
all tweets using the since_id parameter.

Usage:
    python scripts/fetch_all_tweets.py --handle OPChoudhary_Ind
"""

import os
import sys
import time
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.src.twitter.client import TwitterClient

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


def get_last_fetched_tweet_id(conn, author_handle: str):
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


def fetch_all_tweets(client: TwitterClient, conn, author_handle: str, resume: bool = False):
    """
    Fetch ALL tweets from a user by paginating through all tweets.
    
    Strategy:
    - Fetch 100 tweets at a time
    - Use since_id for pagination (get tweets older than last fetched)
    - Respect rate limits (1 request per 15 minutes for free tier)
    - Continue until no more tweets
    """
    total_fetched = 0
    since_id = None
    batch_num = 1
    
    if resume:
        since_id = get_last_fetched_tweet_id(conn, author_handle)
        if since_id:
            logger.info(f'Resuming from tweet ID: {since_id}')
    
    while True:
        logger.info(f'Batch #{batch_num}: Fetching tweets...')
        
        try:
            # Fetch batch (100 tweets max, excluding retweets)
            tweets = client.fetch_user_tweets(
                username=author_handle,
                max_results=100,
                since_id=since_id,
            )
            
            if not tweets:
                logger.info('No more tweets found')
                break
            
            # Insert into database
            insert_tweets(conn, tweets, author_handle)
            total_fetched += len(tweets)
            
            # Update since_id for next iteration (oldest tweet ID)
            since_id = tweets[-1]['id']  # Last tweet in batch (oldest)
            
            # Progress update
            logger.info(f'✓ Batch #{batch_num} complete: {len(tweets)} tweets fetched')
            logger.info(f'✓ Total progress: {total_fetched} tweets fetched so far')
            
            # If we got fewer than 100, we've reached the end
            if len(tweets) < 100:
                logger.info('Reached end of available tweets')
                break
            
            # Move to next batch
            batch_num += 1
            
            # Pause to respect rate limits (15 minutes for free tier)
            logger.info('⏸️  Rate limit: Pausing for 15 minutes before next batch...')
            logger.info(f'   Next batch will start at: {time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() + 15*60))}')
            time.sleep(15 * 60)  # 15 minutes = 900 seconds
            
        except Exception as e:
            logger.error(f'Error fetching batch: {str(e)}')
            break
    
    return total_fetched


def main():
    """Main entry point."""
    import argparse
    parser = argparse.ArgumentParser(description='Fetch ALL tweets from a Twitter user')
    parser.add_argument('--handle', required=True, help='Twitter username (without @)')
    parser.add_argument('--resume', action='store_true', help='Resume from last fetch')
    
    args = parser.parse_args()
    
    logger.info(f'Fetching ALL tweets for @{args.handle}')
    logger.info(f'Excluding retweets (original tweets only)')
    
    try:
        # Initialize Twitter client
        client = TwitterClient()
        
        # Get database connection
        conn = get_db_connection()
        
        # Fetch tweets
        total = fetch_all_tweets(
            client=client,
            conn=conn,
            author_handle=args.handle,
            resume=args.resume,
        )
        
        logger.info(f'✅ Successfully fetched {total} tweets total!')
        
        # Close connection
        conn.close()
        
    except Exception as e:
        logger.error(f'❌ Error: {str(e)}')
        sys.exit(1)


if __name__ == '__main__':
    main()

