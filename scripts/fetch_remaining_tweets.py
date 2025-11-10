#!/usr/bin/env python3
"""
Fetch remaining tweets within the 3,200 limit (693 tweets remaining)

This script continues fetching backward from the oldest tweet we have
until we reach the 3,200 limit or run out of tweets.
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


def get_db_connection():
    """Get PostgreSQL database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    return psycopg2.connect(database_url)


def get_current_stats(conn):
    """Get current tweet count and oldest tweet."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                MIN(created_at) as oldest_date,
                MIN(tweet_id::bigint) as oldest_id
            FROM raw_tweets
            WHERE author_handle = 'OPChoudhary_Ind'
        """)
        result = cur.fetchone()
        return {
            'total': result[0],
            'oldest_date': result[1],
            'oldest_id': str(result[2]) if result[2] else None
        }


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


def fetch_remaining_tweets(author_handle: str, max_tweets: int = 693):
    """
    Fetch remaining tweets within the 3,200 limit.
    
    Strategy:
    - Start from newest tweets (API default)
    - Use pagination_token to go backward
    - Stop when we've fetched max_tweets or hit the 3,200 limit
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
        # Get current stats
        stats = get_current_stats(conn)
        logger.info('=' * 80)
        logger.info('FETCHING REMAINING TWEETS')
        logger.info('=' * 80)
        logger.info(f'Current tweets in DB: {stats["total"]:,}')
        logger.info(f'Oldest tweet date: {stats["oldest_date"]}')
        logger.info(f'Oldest tweet ID: {stats["oldest_id"]}')
        logger.info(f'Target: Fetch up to {max_tweets} more tweets')
        logger.info(f'Expected total after fetch: ~{stats["total"] + max_tweets:,} (within 3,200 limit)')
        logger.info('')
        
        # Get user ID
        logger.info(f'Looking up user @{author_handle}...')
        user = client.get_user(username=author_handle)
        if not user.data:
            raise ValueError(f'User @{author_handle} not found')
        
        user_id = user.data.id
        logger.info(f'✓ User found: @{user.data.username} (ID: {user_id})')
        logger.info('')
        
        # Pagination variables
        # Strategy: Start from newest and paginate backward, skipping duplicates
        # until we reach tweets older than our oldest tweet
        pagination_token = None
        total_fetched = 0
        total_inserted = 0
        batch_num = 1
        max_batches = 50  # Increased limit - keep going until we find older tweets
        
        # Track if we've reached tweets older than our oldest
        oldest_db_date = datetime.fromisoformat(str(stats['oldest_date']).replace('Z', '+00:00')) if stats['oldest_date'] else None
        reached_older_tweets = False
        consecutive_duplicate_batches = 0
        max_consecutive_duplicates = 30  # Increased - we expect many duplicates as we go through already-fetched tweets
        total_duplicate_batches = 0  # Track total duplicate batches
        
        logger.info('Starting fetch...')
        logger.info('Strategy: Paginate backward from newest, skipping duplicates')
        logger.info(f'Target: Fetch {max_tweets} tweets older than {stats["oldest_date"]}')
        logger.info('Will continue paginating until we find older tweets or hit API limit')
        logger.info('=' * 80)
        logger.info('')
        
        while total_inserted < max_tweets and not reached_older_tweets:
            # Check if we've hit max batches (safety limit)
            if batch_num > max_batches:
                logger.warning(f'⚠️  Reached maximum batch limit ({max_batches})')
                logger.warning('   This may indicate we need to continue beyond this limit')
                logger.warning('   Or we may have hit the 3,200 API limit')
                break
            
            logger.info(f'📥 Batch #{batch_num}: Fetching up to 100 tweets...')
            
            try:
                # Build request parameters
                request_params = {
                    'id': user_id,
                    'max_results': 100,
                    'exclude': ['retweets'],
                    'tweet_fields': ['created_at', 'public_metrics', 'entities', 'author_id'],
                }
                
                # Use pagination token for backward pagination
                if pagination_token:
                    request_params['pagination_token'] = pagination_token
                
                response = client.get_users_tweets(**request_params)
                
                if not response.data:
                    logger.info('✓ No more tweets available')
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
                
                # Track consecutive duplicate batches and date analysis
                all_tweets_newer = False
                if inserted == 0:
                    consecutive_duplicate_batches += 1
                    total_duplicate_batches += 1
                    
                    # Check if ALL tweets in this batch are newer than our oldest
                    if tweets and oldest_db_date:
                        try:
                            oldest_tweet_date = tweets[-1]['created_at']
                            if oldest_tweet_date:
                                tweet_date_str = oldest_tweet_date.replace('Z', '+00:00')
                                tweet_date = datetime.fromisoformat(tweet_date_str)
                                if tweet_date >= oldest_db_date:
                                    all_tweets_newer = True
                                    logger.info(f'  ⚠️  All tweets are duplicates AND newer than our oldest')
                                    logger.info(f'     Still in "already fetched" zone - continuing to paginate...')
                                else:
                                    logger.warning(f'  ⚠️  All duplicates but dates are older - this shouldn\'t happen!')
                        except:
                            pass
                    
                    if not all_tweets_newer:
                        logger.info(f'  ⚠️  All tweets in batch are duplicates (consecutive: {consecutive_duplicate_batches})')
                else:
                    consecutive_duplicate_batches = 0  # Reset counter
                
                # Smart stop: If we're getting duplicates AND all dates are newer than our oldest,
                # we know we're still in the "already fetched" zone, so we should continue
                # But if we've been getting duplicates for a very long time with no progress,
                # we might have hit the API limit
                if consecutive_duplicate_batches >= max_consecutive_duplicates:
                    if all_tweets_newer:
                        logger.info(f'  ℹ️  {max_consecutive_duplicates} consecutive duplicate batches (all newer than oldest)')
                        logger.info('     Still paginating through already-fetched tweets to reach older ones...')
                        logger.info('     This is expected - we need to go through duplicates to reach new tweets')
                    else:
                        logger.warning(f'⚠️  {max_consecutive_duplicates} consecutive batches were duplicates')
                        logger.warning('   This may indicate we\'ve hit the 3,200 API limit')
                        # Don't break yet - continue to see if we eventually reach older tweets
                
                # Show date range for this batch
                if tweets:
                    oldest_tweet_date = tweets[-1]['created_at']
                    newest_tweet_date = tweets[0]['created_at']
                    oldest = oldest_tweet_date[:10] if oldest_tweet_date else 'unknown'
                    newest = newest_tweet_date[:10] if newest_tweet_date else 'unknown'
                    logger.info(f'  Date range: {oldest} to {newest}')
                    
                    # Check if we've reached tweets older than our oldest tweet
                    if oldest_tweet_date and oldest_db_date:
                        try:
                            # Parse tweet date
                            tweet_date_str = oldest_tweet_date.replace('Z', '+00:00')
                            tweet_date = datetime.fromisoformat(tweet_date_str)
                            
                            # Compare dates
                            if tweet_date < oldest_db_date:
                                reached_older_tweets = True
                                logger.info(f'  ✅ SUCCESS: Found tweets older than {stats["oldest_date"]}')
                                logger.info(f'     Oldest in batch: {oldest_tweet_date[:19]}')
                                logger.info(f'     Our oldest:      {stats["oldest_date"]}')
                            else:
                                logger.info(f'  📍 Still fetching newer tweets (will continue paginating...)')
                                logger.info(f'     Oldest in batch: {oldest_tweet_date[:19]}')
                                logger.info(f'     Our oldest:      {stats["oldest_date"]}')
                        except Exception as e:
                            logger.debug(f'  Could not compare dates: {e}')
                
                # Progress update
                logger.info(f'  Progress: {total_fetched} tweets fetched, {total_inserted} new tweets stored')
                logger.info(f'  Duplicate batches: {total_duplicate_batches} (consecutive: {consecutive_duplicate_batches})')
                logger.info(f'  Remaining target: {max(0, max_tweets - total_inserted)} new tweets needed')
                
                # Efficiency warning: If we've fetched many duplicates without finding new tweets
                if total_duplicate_batches > 20 and total_inserted == 0:
                    logger.warning('  ⚠️  Fetched many duplicates without new tweets - consuming API quota')
                    logger.warning('     But this is necessary to reach older tweets - continuing...')
                
                logger.info('')
                
                # Check if we've reached older tweets
                if reached_older_tweets:
                    logger.info('✅ REACHED OLDER TWEETS: Continuing to fetch and store...')
                    # Don't break - continue fetching to get all older tweets
                
                # Check if we've reached our target (new tweets inserted)
                if total_inserted >= max_tweets:
                    logger.info(f'✅ TARGET REACHED: Inserted {total_inserted} new tweets')
                    if not reached_older_tweets:
                        logger.warning('  ⚠️  But we haven\'t reached older tweets yet')
                    break
                
                # Also check if we've reached the 3,200 limit
                final_stats = get_current_stats(conn)
                if final_stats['total'] >= 3200:
                    logger.info(f'✅ REACHED 3,200 LIMIT: Total tweets now {final_stats["total"]:,}')
                    if not reached_older_tweets:
                        logger.warning('  ⚠️  Reached 3,200 limit before finding older tweets')
                        logger.warning('     This confirms tweets are beyond the API limit')
                    break
                
                # Check for pagination token (more tweets available)
                if response.meta and 'next_token' in response.meta:
                    pagination_token = response.meta['next_token']
                    batch_num += 1
                    
                    # Small delay between successful requests
                    time.sleep(1)
                else:
                    logger.info('✓ Reached end of available tweets (no more pagination)')
                    if reached_older_tweets:
                        logger.info('  ✅ Successfully reached older tweets before API limit')
                    elif total_inserted > 0:
                        logger.info('  ✅ Fetched some new tweets')
                    else:
                        logger.warning('  ⚠️  No older tweets found - hit 3,200 limit')
                        logger.warning('     Tweets from 2023-12-01 to 2025-02-14 are beyond API reach')
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
                
                # Exponential backoff for unknown errors
                wait_time = min(2 ** (batch_num % 5), 60)
                logger.info(f'   Waiting {wait_time} seconds before retry...')
                time.sleep(wait_time)
                continue
        
        # Final stats
        final_stats = get_current_stats(conn)
        
        logger.info('')
        logger.info('=' * 80)
        logger.info('✅ FETCH COMPLETE')
        logger.info('=' * 80)
        logger.info(f'Total tweets fetched this session: {total_fetched:,}')
        logger.info(f'New tweets stored: {total_inserted:,}')
        logger.info(f'Duplicates skipped: {total_fetched - total_inserted:,}')
        logger.info('')
        logger.info(f'Final database stats:')
        logger.info(f'  Total tweets: {final_stats["total"]:,}')
        logger.info(f'  Oldest tweet: {final_stats["oldest_date"]}')
        logger.info(f'  Tweets remaining in 3,200 limit: ~{3200 - final_stats["total"]:,}')
        logger.info('')
        
    finally:
        conn.close()
        logger.info('Database connection closed')
    
    return total_inserted


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Fetch remaining tweets within 3,200 limit')
    parser.add_argument('--handle', default='OPChoudhary_Ind', help='Twitter username (without @)')
    parser.add_argument('--max-tweets', type=int, default=693, help='Maximum tweets to fetch (default: 693)')
    
    args = parser.parse_args()
    
    try:
        fetch_remaining_tweets(args.handle, args.max_tweets)
    except Exception as e:
        logger.error(f'❌ Fatal error: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

