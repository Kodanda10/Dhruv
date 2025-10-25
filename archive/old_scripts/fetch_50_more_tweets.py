#!/usr/bin/env python3
"""
Fetch exactly 50 MORE tweets (after the 9 we already have).
This script will fetch tweets OLDER than our oldest existing tweet.
"""
import os
import logging
from dotenv import load_dotenv
from pathlib import Path
import psycopg2
from api.src.twitter.client import TwitterClient

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(Path(__file__).parent / '.env.local')

def get_db_connection():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    return psycopg2.connect(database_url)

def get_oldest_tweet_id(conn):
    """Get the oldest tweet ID we already have."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT tweet_id, created_at 
            FROM raw_tweets 
            WHERE author_handle = 'OPChoudhary_Ind'
            ORDER BY created_at ASC 
            LIMIT 1
        """)
        result = cur.fetchone()
        if result:
            logger.info(f"Oldest existing tweet: {result[0]} from {result[1]}")
            return result[0]
        return None

def count_existing_tweets(conn):
    """Count how many tweets we already have."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM raw_tweets WHERE author_handle = 'OPChoudhary_Ind'")
        return cur.fetchone()[0]

def insert_tweets(conn, tweets: list, author_handle: str):
    """Insert new tweets into database."""
    inserted = 0
    with conn.cursor() as cur:
        for tweet in tweets:
            try:
                hashtags = [tag['tag'] for tag in tweet.get('entities', {}).get('hashtags', [])]
                mentions = [mention['username'] for mention in tweet.get('entities', {}).get('mentions', [])]
                urls = [url['url'] for url in tweet.get('entities', {}).get('urls', [])]
                
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
                if cur.rowcount > 0:
                    inserted += 1
            except Exception as e:
                logger.error(f'Error inserting tweet {tweet["id"]}: {str(e)}')
        conn.commit()
    return inserted

def fetch_50_more_tweets(handle: str = 'OPChoudhary_Ind'):
    """Fetch exactly 50 more tweets older than what we have."""
    logger.info("=" * 80)
    logger.info("FETCHING 50 MORE TWEETS")
    logger.info("=" * 80)
    
    conn = None
    try:
        client = TwitterClient()
        conn = get_db_connection()
        
        # Check existing tweets
        existing_count = count_existing_tweets(conn)
        logger.info(f"✓ Current tweets in DB: {existing_count}")
        
        # Get oldest tweet ID for pagination
        oldest_tweet_id = get_oldest_tweet_id(conn)
        
        # Fetch tweets
        total_fetched = 0
        target = 50
        batch_num = 1
        until_id = oldest_tweet_id  # Start from oldest tweet we have
        
        logger.info(f"Target: Fetch {target} more tweets")
        logger.info(f"Starting from (until_id): {until_id}")
        logger.info("")
        
        while total_fetched < target:
            remaining = target - total_fetched
            batch_size = min(100, remaining)  # Max 100 per request
            
            logger.info(f"Batch #{batch_num}: Fetching up to {batch_size} tweets...")
            
            # Get user ID
            user = client.client.get_user(username=handle)
            if not user.data:
                raise ValueError(f'User @{handle} not found')
            user_id = user.data.id
            
            # Fetch older tweets (before until_id)
            response = client.client.get_users_tweets(
                id=user_id,
                max_results=batch_size,
                until_id=until_id,  # Get tweets OLDER than this ID
                exclude=['retweets'],
                tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
            )
            
            tweets_data = response.data
            meta = response.meta
            
            if not tweets_data:
                logger.info("✓ No more older tweets available")
                break
            
            # Insert tweets
            inserted = insert_tweets(conn, tweets_data, handle)
            total_fetched += inserted
            
            logger.info(f"✓ Batch #{batch_num}: Fetched {len(tweets_data)} tweets, inserted {inserted} new ones")
            logger.info(f"✓ Progress: {total_fetched}/{target} tweets fetched")
            
            # Check if we reached our target
            if total_fetched >= target:
                logger.info(f"✅ TARGET REACHED: {total_fetched} tweets fetched!")
                break
            
            # Get next pagination token
            oldest_id = meta.get('oldest_id')
            if not oldest_id:
                logger.info("✓ No more pagination tokens (end of timeline)")
                break
            
            until_id = oldest_id
            batch_num += 1
            
            logger.info(f"⏭️  Next batch will fetch tweets older than {until_id}")
            logger.info("")
        
        # Final summary
        final_count = count_existing_tweets(conn)
        logger.info("=" * 80)
        logger.info("FETCH COMPLETE")
        logger.info("=" * 80)
        logger.info(f"✓ New tweets fetched: {total_fetched}")
        logger.info(f"✓ Total tweets in DB: {final_count}")
        logger.info("")
        
        if final_count >= 59:  # 9 + 50 = 59
            logger.info("✅ SUCCESS: You now have enough tweets to proceed!")
        else:
            logger.info(f"⚠️  WARNING: Only {final_count} tweets in DB (target was 59)")
        
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"❌ Error during fetch: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    fetch_50_more_tweets()

