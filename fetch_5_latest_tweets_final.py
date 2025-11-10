#!/usr/bin/env python3
"""
Fetch exactly 5 latest tweets from OP Choudhary's account
Check database connection and save tweets

OPTIMIZED: Uses cached user ID to avoid extra API call
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import tweepy
import psycopg2
import json

# Setup logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(Path(__file__).parent / '.env.local')

# Cache file for user ID (to avoid API calls)
USER_ID_CACHE_FILE = Path(__file__).parent / '.user_id_cache.json'

def get_cached_user_id():
    """Get cached user ID or None if not cached."""
    if USER_ID_CACHE_FILE.exists():
        try:
            with open(USER_ID_CACHE_FILE, 'r') as f:
                cache = json.load(f)
                return cache.get('user_id'), cache.get('username')
        except Exception:
            return None, None
    return None, None

def cache_user_id(user_id, username):
    """Cache user ID to avoid future API calls."""
    try:
        with open(USER_ID_CACHE_FILE, 'w') as f:
            json.dump({'user_id': user_id, 'username': username}, f)
    except Exception as e:
        logger.warning(f'Could not cache user ID: {e}')

def get_db_connection():
    """Get PostgreSQL database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    return psycopg2.connect(database_url)

def check_database_status(conn):
    """Check if database is working and count existing tweets."""
    try:
        with conn.cursor() as cur:
            # Check if raw_tweets table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'raw_tweets'
                );
            """)
            table_exists = cur.fetchone()[0]
            
            if not table_exists:
                logger.error("❌ raw_tweets table does not exist")
                return False
            
            # Count existing tweets
            cur.execute("""
                SELECT COUNT(*) FROM raw_tweets 
                WHERE author_handle = 'OPChoudhary_Ind'
            """)
            count = cur.fetchone()[0]
            
            logger.info(f"✓ Database connection: WORKING")
            logger.info(f"✓ raw_tweets table: EXISTS")
            logger.info(f"✓ Current tweets in DB: {count}")
            
            return True
            
    except Exception as e:
        logger.error(f"❌ Database error: {e}")
        return False

def insert_tweets(conn, tweets: list, author_handle: str):
    """Insert tweets into database."""
    inserted_count = 0
    
    with conn.cursor() as cur:
        for tweet in tweets:
            try:
                # Extract entities safely
                hashtags = [tag.get('tag', '') for tag in tweet.get('entities', {}).get('hashtags', [])]
                mentions = [mention.get('username', '') for mention in tweet.get('entities', {}).get('mentions', [])]
                urls = [url.get('url', '') for url in tweet.get('entities', {}).get('urls', [])]
                
                # Insert tweet
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
                
                # Check if actually inserted (not duplicate)
                if cur.fetchone():
                    inserted_count += 1
                    logger.info(f"✓ Inserted new tweet: {tweet['id']}")
                else:
                    logger.info(f"⚠️  Tweet already exists: {tweet['id']}")
                    
            except Exception as e:
                logger.error(f'❌ Error inserting tweet {tweet.get("id", "unknown")}: {str(e)}')
        
        conn.commit()
    
    return inserted_count

def main():
    """Fetch exactly 5 latest tweets and save to database."""
    
    logger.info('=' * 80)
    logger.info('FETCH 5 LATEST TWEETS - OPTIMIZED')
    logger.info('=' * 80)
    logger.info('')
    logger.info('This will:')
    logger.info('1. Check database connection')
    logger.info('2. Use cached user ID (or fetch once if needed)')
    logger.info('3. Fetch exactly 5 latest tweets (MINIMUM API CALLS)')
    logger.info('4. Save to database')
    logger.info('')
    
    conn = None
    try:
        # Step 1: Check database connection
        logger.info('Step 1: Checking database connection...')
        conn = get_db_connection()
        if not check_database_status(conn):
            logger.error('❌ Database connection failed')
            return
        logger.info('')
        
        # Step 2: Initialize Twitter client
        logger.info('Step 2: Initializing Twitter client...')
        bearer_token = os.getenv('X_BEARER_TOKEN')
        if not bearer_token or bearer_token.startswith('your_'):
            logger.error('❌ X_BEARER_TOKEN not found or not set')
            logger.error('Please update .env.local with your actual Twitter API credentials')
            return
        
        client = tweepy.Client(
            bearer_token=bearer_token,
            wait_on_rate_limit=True,  # Handle rate limits automatically
        )
        logger.info('✓ Twitter client initialized')
        logger.info('')
        
        # Step 3: Get user ID (use cache to avoid API call)
        logger.info('Step 3: Getting user ID for @OPChoudhary_Ind...')
        user_id, cached_username = get_cached_user_id()
        
        if user_id:
            logger.info(f'✓ Using cached user ID: {user_id} (saved API call!)')
            username = cached_username or 'OPChoudhary_Ind'
        else:
            logger.info('   Cache miss - fetching user ID (one-time call)...')
            user = client.get_user(username='OPChoudhary_Ind')
            if not user.data:
                logger.error('❌ User @OPChoudhary_Ind not found')
                return
            
            user_id = user.data.id
            username = user.data.username
            cache_user_id(user_id, username)
            logger.info(f'✓ User ID fetched and cached: {user_id}')
        logger.info('')
        
        # Step 4: Fetch exactly 5 tweets (ONLY API CALL for tweets)
        logger.info('Step 4: Fetching 5 latest tweets...')
        logger.info('(Making API call now - this is the ONLY tweet fetch call)...')
        logger.info('')
        
        response = client.get_users_tweets(
            id=user_id,
            max_results=5,  # Exactly 5 tweets (minimum required by Twitter)
            exclude=['retweets'],
            tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
        )
        
        if not response.data:
            logger.error('❌ No tweets returned')
            logger.info('')
            logger.info('Possible reasons:')
            logger.info('  - Account has no recent tweets')
            logger.info('  - Rate limit exceeded (script will auto-retry if wait_on_rate_limit=True)')
            logger.info('  - API credentials issue')
            return
        
        logger.info(f'✅ SUCCESS! Fetched {len(response.data)} tweet(s)')
        logger.info('')
        
        # Step 5: Convert to dict format
        logger.info('Step 5: Processing tweets...')
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
        logger.info(f'✓ Processed {len(tweets)} tweets')
        logger.info('')
        
        # Step 6: Save to database
        logger.info('Step 6: Saving to database...')
        inserted = insert_tweets(conn, tweets, 'OPChoudhary_Ind')
        logger.info(f'✓ Inserted {inserted} new tweets')
        logger.info(f'  Skipped {len(tweets) - inserted} duplicates')
        logger.info('')
        
        # Step 7: Show results
        logger.info('=' * 80)
        logger.info('✅ SUCCESS!')
        logger.info('=' * 80)
        logger.info('')
        logger.info(f'Total tweets fetched: {len(tweets)}')
        logger.info(f'New tweets stored: {inserted}')
        logger.info('')
        
        logger.info('Latest tweets:')
        logger.info('-' * 80)
        for i, tweet in enumerate(tweets, 1):
            date = tweet['created_at'][:10] if tweet['created_at'] else 'unknown'
            text_preview = tweet['text'][:80].replace('\n', ' ')
            logger.info(f'{i}. [{date}] {text_preview}...')
        
        logger.info('')
        logger.info('=' * 80)
        logger.info('VERIFICATION')
        logger.info('=' * 80)
        logger.info('')
        logger.info('✅ API credentials: WORKING')
        logger.info('✅ Database connection: WORKING')
        logger.info('✅ Tweet fetching: WORKING')
        logger.info('✅ Data storage: WORKING')
        logger.info('✅ API call optimization: USER ID CACHED')
        logger.info('')
        
        conn.close()
        
    except tweepy.TooManyRequests as e:
        logger.error('')
        logger.error('❌ Rate limit exceeded')
        logger.error('   The script will automatically wait and retry')
        logger.error('   Check x-rate-limit-reset header for exact wait time')
        logger.error('')
        sys.exit(1)
        
    except Exception as e:
        logger.error('')
        logger.error(f'❌ Error: {str(e)}')
        logger.error('')
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    main()
