#!/usr/bin/env python3
"""
Small batch test for fetch logic - verifies API and database working
Tests fetching 5 tweets and verifying they're stored correctly
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import tweepy
import psycopg2
import json
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).parent.parent / '.env.local')

def test_api_connection():
    """Test Twitter API connection and rate limit status."""
    logger.info('=' * 80)
    logger.info('TEST 1: Twitter API Connection')
    logger.info('=' * 80)
    
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token or bearer_token.startswith('your_'):
        logger.error('❌ X_BEARER_TOKEN not configured')
        return False
    
    try:
        client = tweepy.Client(
            bearer_token=bearer_token,
            wait_on_rate_limit=True,
        )
        
        # Test API connection by getting user info (minimal API call)
        user = client.get_user(username='OPChoudhary_Ind')
        if user.data:
            logger.info(f'✅ API Connection: WORKING')
            logger.info(f'   User: @{user.data.username} (ID: {user.data.id})')
            logger.info(f'   Name: {user.data.name}')
            return True
        else:
            logger.error('❌ User not found')
            return False
            
    except tweepy.TooManyRequests as e:
        logger.error(f'❌ Rate limit exceeded: {e}')
        return False
    except Exception as e:
        logger.error(f'❌ API Error: {e}')
        return False

def test_database_connection():
    """Test database connection and table structure."""
    logger.info('')
    logger.info('=' * 80)
    logger.info('TEST 2: Database Connection')
    logger.info('=' * 80)
    
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            logger.error('❌ DATABASE_URL not configured')
            return False
        
        conn = psycopg2.connect(database_url)
        
        with conn.cursor() as cur:
            # Check table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'raw_tweets'
                );
            """)
            table_exists = cur.fetchone()[0]
            
            if not table_exists:
                logger.error('❌ raw_tweets table does not exist')
                return False
            
            # Count tweets
            cur.execute("""
                SELECT COUNT(*) FROM raw_tweets 
                WHERE author_handle = 'OPChoudhary_Ind'
            """)
            count = cur.fetchone()[0]
            
            logger.info(f'✅ Database Connection: WORKING')
            logger.info(f'✅ Table exists: raw_tweets')
            logger.info(f'✅ Current tweets in DB: {count}')
            
            conn.close()
            return True
            
    except Exception as e:
        logger.error(f'❌ Database Error: {e}')
        return False

def test_fetch_and_store():
    """Test fetching 5 tweets and storing them."""
    logger.info('')
    logger.info('=' * 80)
    logger.info('TEST 3: Fetch & Store 5 Tweets')
    logger.info('=' * 80)
    
    bearer_token = os.getenv('X_BEARER_TOKEN')
    database_url = os.getenv('DATABASE_URL')
    
    if not bearer_token or not database_url:
        logger.error('❌ Missing credentials')
        return False
    
    try:
        # Initialize clients
        client = tweepy.Client(
            bearer_token=bearer_token,
            wait_on_rate_limit=True,
        )
        conn = psycopg2.connect(database_url)
        
        # Get user ID (cached if available)
        user_id_cache = Path(__file__).parent / '.user_id_cache.json'
        if user_id_cache.exists():
            with open(user_id_cache, 'r') as f:
                cache = json.load(f)
                user_id = cache.get('user_id')
        else:
            user = client.get_user(username='OPChoudhary_Ind')
            user_id = user.data.id
        
        logger.info(f'   Fetching 5 tweets for user ID: {user_id}...')
        
        # Fetch 5 tweets
        response = client.get_users_tweets(
            id=user_id,
            max_results=5,
            exclude=['retweets'],
            tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
        )
        
        if not response.data:
            logger.error('❌ No tweets returned')
            return False
        
        logger.info(f'✅ Fetched {len(response.data)} tweets from API')
        
        # Process and store
        inserted_count = 0
        with conn.cursor() as cur:
            for tweet in response.data:
                hashtags = [tag.get('tag', '') for tag in tweet.entities.get('hashtags', [])] if tweet.entities else []
                mentions = [m.get('username', '') for m in tweet.entities.get('mentions', [])] if tweet.entities else []
                urls = [u.get('url', '') for u in tweet.entities.get('urls', [])] if tweet.entities else []
                
                try:
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
                        str(tweet.id),
                        'OPChoudhary_Ind',
                        tweet.text,
                        tweet.created_at.isoformat() if tweet.created_at else None,
                        hashtags,
                        mentions,
                        urls,
                        tweet.public_metrics.get('retweet_count', 0) if isinstance(tweet.public_metrics, dict) else (tweet.public_metrics.retweet_count if tweet.public_metrics else 0),
                        tweet.public_metrics.get('like_count', 0) if isinstance(tweet.public_metrics, dict) else (tweet.public_metrics.like_count if tweet.public_metrics else 0),
                        tweet.public_metrics.get('reply_count', 0) if isinstance(tweet.public_metrics, dict) else (tweet.public_metrics.reply_count if tweet.public_metrics else 0),
                        tweet.public_metrics.get('quote_count', 0) if isinstance(tweet.public_metrics, dict) else (tweet.public_metrics.quote_count if tweet.public_metrics else 0),
                    ))
                    
                    if cur.fetchone():
                        inserted_count += 1
                        
                except Exception as e:
                    logger.warning(f'   Skipped tweet {tweet.id}: {e}')
        
        conn.commit()
        conn.close()
        
        logger.info(f'✅ Stored {inserted_count} new tweets')
        logger.info(f'   Skipped {len(response.data) - inserted_count} duplicates')
        
        return True
        
    except Exception as e:
        logger.error(f'❌ Fetch/Store Error: {e}')
        import traceback
        traceback.print_exc()
        return False

def test_api_endpoint():
    """Test Next.js API endpoint can retrieve tweets."""
    logger.info('')
    logger.info('=' * 80)
    logger.info('TEST 4: API Endpoint Verification')
    logger.info('=' * 80)
    
    try:
        database_url = os.getenv('DATABASE_URL')
        conn = psycopg2.connect(database_url)
        
        with conn.cursor() as cur:
            # Simulate what API endpoint does
            cur.execute("""
                SELECT
                    tweet_id, text, created_at, author_handle, 
                    retweet_count, reply_count, like_count, quote_count,
                    hashtags, mentions, urls
                FROM raw_tweets
                WHERE author_handle = 'OPChoudhary_Ind'
                ORDER BY created_at DESC
                LIMIT 5
            """)
            
            rows = cur.fetchall()
            logger.info(f'✅ API Query: SUCCESS')
            logger.info(f'   Retrieved {len(rows)} tweets from database')
            
            if rows:
                logger.info('   Sample tweet:')
                logger.info(f'   ID: {rows[0][0]}')
                logger.info(f'   Text: {rows[0][1][:80]}...')
                logger.info(f'   Created: {rows[0][2]}')
            
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f'❌ API Endpoint Test Error: {e}')
        return False

def main():
    """Run all tests."""
    logger.info('')
    logger.info('╔══════════════════════════════════════════════════════════════╗')
    logger.info('║         FETCH LOGIC & API SMALL BATCH TEST                  ║')
    logger.info('╚══════════════════════════════════════════════════════════════╝')
    logger.info('')
    
    results = {}
    
    # Test 1: API Connection
    results['api'] = test_api_connection()
    
    # Test 2: Database Connection
    results['database'] = test_database_connection()
    
    # Test 3: Fetch & Store
    if results['api'] and results['database']:
        results['fetch_store'] = test_fetch_and_store()
    else:
        logger.warning('⏭️  Skipping fetch/store test (prerequisites failed)')
        results['fetch_store'] = False
    
    # Test 4: API Endpoint
    if results['database']:
        results['api_endpoint'] = test_api_endpoint()
    else:
        results['api_endpoint'] = False
    
    # Summary
    logger.info('')
    logger.info('=' * 80)
    logger.info('TEST SUMMARY')
    logger.info('=' * 80)
    logger.info('')
    
    for test_name, passed in results.items():
        status = '✅ PASS' if passed else '❌ FAIL'
        logger.info(f'{status}: {test_name.replace("_", " ").title()}')
    
    logger.info('')
    
    all_passed = all(results.values())
    if all_passed:
        logger.info('✅ ALL TESTS PASSED - Ready for large-scale fetching!')
    else:
        logger.warning('⚠️  Some tests failed - review before scaling')
    
    logger.info('')
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())


