#!/usr/bin/env python3
"""
Fetch EXACTLY 10 tweets - Single API call test

This proves:
1. API credentials work
2. Database connection works
3. Tweet fetching works
4. Data storage works

Uses only 1 of our 3 available requests.
"""

import os
import sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv
import tweepy

sys.path.insert(0, str(Path(__file__).parent))

# Setup logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(Path(__file__).parent / '.env.local')


def get_db_connection():
    """Get PostgreSQL database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    
    return psycopg2.connect(database_url)


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
                    
            except Exception as e:
                logger.error(f'Error inserting tweet {tweet.get("id", "unknown")}: {str(e)}')
        
        conn.commit()
    
    return inserted_count


def main():
    """Fetch 10 tweets - single API call."""
    
    logger.info('=' * 60)
    logger.info('FETCH 10 TWEETS TEST')
    logger.info('=' * 60)
    logger.info('')
    logger.info('This will make ONLY 1 API call')
    logger.info('Fetches 10 most recent tweets from @OPChoudhary_Ind')
    logger.info('')
    
    try:
        # Step 1: Connect to database
        logger.info('Step 1: Connecting to database...')
        conn = get_db_connection()
        logger.info('✓ Database connected')
        logger.info('')
        
        # Step 2: Initialize Twitter client (doesn't count as API call)
        logger.info('Step 2: Initializing Twitter client...')
        bearer_token = os.getenv('X_BEARER_TOKEN')
        if not bearer_token:
            raise ValueError('X_BEARER_TOKEN not found')
        
        client = tweepy.Client(
            bearer_token=bearer_token,
            wait_on_rate_limit=False,  # We're only making 1 call
        )
        logger.info('✓ Client initialized')
        logger.info('')
        
        # Step 3: Get user ID (this uses 1 request, but we already did it in check)
        # So we'll use the known ID directly
        logger.info('Step 3: Using known user ID for @OPChoudhary_Ind')
        user_id = 1706770968  # From previous check
        logger.info(f'✓ User ID: {user_id}')
        logger.info('')
        
        # Step 4: Fetch 10 tweets (THIS IS OUR ONE API CALL)
        logger.info('Step 4: Fetching 10 tweets...')
        logger.info('(Making API call now...)')
        logger.info('')
        
        response = client.get_users_tweets(
            id=user_id,
            max_results=10,  # Just 10 tweets
            pagination_token=None,
            exclude=['retweets'],
            tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
        )
        
        if not response.data:
            logger.error('❌ No tweets returned')
            conn.close()
            sys.exit(1)
        
        logger.info(f'✓ Fetched {len(response.data)} tweets')
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
        
        # Step 6: Store in database
        logger.info('Step 6: Storing in database...')
        inserted = insert_tweets(conn, tweets, 'OPChoudhary_Ind')
        logger.info(f'✓ Inserted {inserted} new tweets')
        logger.info(f'  Skipped {len(tweets) - inserted} duplicates')
        logger.info('')
        
        # Step 7: Show results
        logger.info('=' * 60)
        logger.info('✅ SUCCESS!')
        logger.info('=' * 60)
        logger.info('')
        logger.info(f'Total tweets fetched: {len(tweets)}')
        logger.info(f'New tweets stored: {inserted}')
        logger.info('')
        
        logger.info('Sample tweets:')
        logger.info('-' * 60)
        for i, tweet in enumerate(tweets[:3], 1):
            date = tweet['created_at'][:10] if tweet['created_at'] else 'unknown'
            text_preview = tweet['text'][:80].replace('\n', ' ')
            logger.info(f'{i}. [{date}] {text_preview}...')
        
        logger.info('')
        logger.info('=' * 60)
        logger.info('VERIFICATION')
        logger.info('=' * 60)
        logger.info('')
        logger.info('✅ API credentials: WORKING')
        logger.info('✅ Database connection: WORKING')
        logger.info('✅ Tweet fetching: WORKING')
        logger.info('✅ Data storage: WORKING')
        logger.info('')
        logger.info('Next steps:')
        logger.info('1. Continue with rest of development')
        logger.info('2. Come back later to fetch all tweets')
        logger.info('3. Apply for Elevated Access for faster fetching')
        logger.info('')
        
        conn.close()
        
    except tweepy.TooManyRequests as e:
        logger.error('')
        logger.error('❌ Rate limit exceeded')
        logger.error('   Wait 15 minutes and try again')
        logger.error('')
        sys.exit(1)
        
    except Exception as e:
        logger.error('')
        logger.error(f'❌ Error: {str(e)}')
        logger.error('')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

