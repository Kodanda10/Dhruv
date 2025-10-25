#!/usr/bin/env python3
"""
Fetch exactly 5 latest tweets from OP Choudhary's account.
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
                    logger.info(f"✓ Inserted tweet {tweet['id']}: {tweet['text'][:50]}...")
                else:
                    logger.info(f"⚠️ Tweet {tweet['id']} already exists")
            except Exception as e:
                logger.error(f'Error inserting tweet {tweet["id"]}: {str(e)}')
        conn.commit()
    return inserted

def fetch_5_latest_tweets(handle: str = 'OPChoudhary_Ind'):
    """Fetch exactly 5 latest tweets."""
    logger.info("=" * 60)
    logger.info("FETCHING 5 LATEST TWEETS")
    logger.info("=" * 60)
    
    conn = None
    try:
        client = TwitterClient()
        conn = get_db_connection()
        
        # Get user ID
        user = client.client.get_user(username=handle)
        if not user.data:
            raise ValueError(f'User @{handle} not found')
        user_id = user.data.id
        logger.info(f"✓ Found user @{handle} (ID: {user_id})")
        
        # Fetch latest 5 tweets
        logger.info("Fetching 5 latest tweets...")
        response = client.client.get_users_tweets(
            id=user_id,
            max_results=5,
            exclude=['retweets'],
            tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
        )
        
        tweets_data = response.data
        
        if not tweets_data:
            logger.info("❌ No tweets found")
            return
        
        logger.info(f"✓ Fetched {len(tweets_data)} tweets from API")
        
        # Display tweets before inserting
        logger.info("\n" + "=" * 60)
        logger.info("LATEST TWEETS:")
        logger.info("=" * 60)
        
        for i, tweet in enumerate(tweets_data, 1):
            logger.info(f"\n--- Tweet {i} ---")
            logger.info(f"ID: {tweet['id']}")
            logger.info(f"Date: {tweet['created_at']}")
            logger.info(f"Text: {tweet['text']}")
            logger.info(f"Likes: {tweet['public_metrics']['like_count']}")
            logger.info(f"Retweets: {tweet['public_metrics']['retweet_count']}")
            logger.info(f"Replies: {tweet['public_metrics']['reply_count']}")
            
            hashtags = [tag['tag'] for tag in tweet.get('entities', {}).get('hashtags', [])]
            mentions = [mention['username'] for mention in tweet.get('entities', {}).get('mentions', [])]
            
            if hashtags:
                logger.info(f"Hashtags: {', '.join(hashtags)}")
            if mentions:
                logger.info(f"Mentions: {', '.join(mentions)}")
        
        # Insert tweets into database
        logger.info("\n" + "=" * 60)
        logger.info("INSERTING INTO DATABASE:")
        logger.info("=" * 60)
        
        inserted = insert_tweets(conn, tweets_data, handle)
        
        # Final summary
        logger.info("\n" + "=" * 60)
        logger.info("FETCH COMPLETE")
        logger.info("=" * 60)
        logger.info(f"✓ Tweets fetched from API: {len(tweets_data)}")
        logger.info(f"✓ New tweets inserted: {inserted}")
        logger.info(f"✓ Duplicates skipped: {len(tweets_data) - inserted}")
        
        if inserted > 0:
            logger.info("✅ SUCCESS: Latest tweets fetched and stored!")
        else:
            logger.info("⚠️ All tweets were already in database")
        
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ Error during fetch: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    fetch_5_latest_tweets()
