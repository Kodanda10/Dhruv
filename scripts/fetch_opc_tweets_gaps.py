#!/usr/bin/env python3
"""
Fetch OPC tweets for date gaps:
1. After November 3, 2025, 18:28:07 IST (forward to present)
2. Before February 14, 2025, 18:03:37 IST (backward to Dec 1, 2023)

Excludes retweets and replies.
"""

import os
import sys
import time
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.src.twitter.client import TwitterClient

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
    """Insert tweets into database, filtering out retweets and replies."""
    inserted_count = 0
    skipped_retweets = 0
    skipped_replies = 0
    
    with conn.cursor() as cur:
        for tweet in tweets:
            try:
                # Tweet is already a dict from TwitterClient
                tweet_dict = tweet if isinstance(tweet, dict) else {
                    'id': tweet.id if hasattr(tweet, 'id') else None,
                    'text': tweet.text if hasattr(tweet, 'text') else '',
                    'created_at': tweet.created_at if hasattr(tweet, 'created_at') else None,
                    'entities': tweet.entities if hasattr(tweet, 'entities') else {},
                    'public_metrics': tweet.public_metrics if hasattr(tweet, 'public_metrics') else {},
                    'in_reply_to_user_id': getattr(tweet, 'in_reply_to_user_id', None) if hasattr(tweet, 'in_reply_to_user_id') else None,
                }
                
                # Filter out replies (double-check even though API excludes them)
                if tweet_dict.get('in_reply_to_user_id'):
                    skipped_replies += 1
                    continue
                
                # Also check text patterns that indicate replies
                text = tweet_dict.get('text', '')
                if text and text.strip().startswith('@'):
                    skipped_replies += 1
                    continue
                
                # Extract entities
                entities = tweet_dict.get('entities', {})
                hashtags = [tag['tag'] for tag in entities.get('hashtags', [])]
                mentions = [mention['username'] for mention in entities.get('mentions', [])]
                urls = [url['url'] for url in entities.get('urls', [])]
                
                # Extract metrics
                metrics = tweet_dict.get('public_metrics', {})
                
                # Get created_at
                created_at = tweet_dict.get('created_at')
                if isinstance(created_at, str):
                    # Parse ISO format string
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                elif created_at and hasattr(created_at, 'isoformat'):
                    # Already a datetime object
                    pass
                else:
                    logger.warning(f'Could not parse created_at for tweet {tweet_dict.get("id")}')
                    continue
                
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
                    str(tweet_dict.get('id', '')),
                    author_handle,
                    text,
                    created_at,
                    hashtags,
                    mentions,
                    urls,
                    metrics.get('retweet_count', 0),
                    metrics.get('like_count', 0),
                    metrics.get('reply_count', 0),
                    metrics.get('quote_count', 0),
                ))
                
                if cur.rowcount > 0:
                    inserted_count += 1
                    
            except Exception as e:
                logger.error(f'Error inserting tweet {tweet_dict.get("id", "unknown") if "tweet_dict" in locals() else "unknown"}: {str(e)}')
                import traceback
                traceback.print_exc()
        
        conn.commit()
        logger.info(f'Inserted {inserted_count} tweets (skipped {skipped_replies} replies, {skipped_retweets} retweets)')
        return inserted_count


def fetch_forward(client: TwitterClient, conn, author_handle: str, start_date: datetime):
    """
    Fetch tweets AFTER start_date up to present.
    Uses pagination tokens to fetch all pages.
    """
    logger.info('=' * 70)
    logger.info('TASK 1: Fetching tweets AFTER November 3, 2025, 18:28:07 IST')
    logger.info('=' * 70)
    
    total_fetched = 0
    pagination_token = None
    batch_num = 1
    max_results = 100
    
    # Don't use since_id - we want ALL tweets after start_date, including ones we might have missed
    # Just use start_time to filter by date
    logger.info(f'Fetching ALL tweets after {start_date} (IST: Nov 3, 2025, 18:28:07)')
    
    while True:
        logger.info(f'Batch #{batch_num}: Fetching tweets (pagination_token: {pagination_token[:20] + "..." if pagination_token else "None"})...')
        
        try:
            tweets, next_token = client.fetch_user_tweets(
                username=author_handle,
                max_results=max_results,
                start_time=start_date,  # Always use start_time to ensure we get all tweets after this date
                pagination_token=pagination_token,
            )
            
            if not tweets:
                logger.info('No more tweets found')
                break
            
            # Insert into database
            inserted = insert_tweets(conn, tweets, author_handle)
            total_fetched += inserted
            
            logger.info(f'✓ Batch #{batch_num} complete: {inserted} original tweets inserted')
            logger.info(f'✓ Total progress: {total_fetched} tweets fetched so far')
            
            # Check if there's a next page
            if not next_token:
                logger.info('No more pages available (reached end)')
                break
            
            # Update pagination token for next iteration
            pagination_token = next_token
            batch_num += 1
            
            # Rate limit pause (15 minutes for free tier)
            logger.info('⏸️  Rate limit: Pausing for 15 minutes before next batch...')
            logger.info(f'   Next batch will start at: {datetime.now() + timedelta(minutes=15)}')
            time.sleep(15 * 60)
            
        except Exception as e:
            logger.error(f'Error fetching batch: {str(e)}')
            import traceback
            traceback.print_exc()
            break
    
    logger.info(f'✅ Task 1 Complete: Fetched {total_fetched} tweets forward')
    return total_fetched


def fetch_backward(client: TwitterClient, conn, author_handle: str, end_date: datetime, start_date: datetime, max_attempts: int = 2):
    """
    Fetch tweets BEFORE end_date going back to start_date.
    
    SOLUTION: Fetch ALL tweets without date filters, then filter locally.
    This works around Twitter API v2 limitations on historical date ranges.
    
    Args:
        max_attempts: Maximum number of API call attempts (default: 2 to limit costs)
    """
    logger.info('=' * 70)
    logger.info('TASK 2: Fetching tweets BEFORE February 14, 2025, 18:03:37 IST')
    logger.info(f'Going back to: {start_date}')
    logger.info(f'⚠️  MAX ATTEMPTS: {max_attempts} (to limit API costs)')
    logger.info('')
    logger.info('💡 SOLUTION: Fetching ALL tweets without date filters,')
    logger.info('   then filtering locally by date range.')
    logger.info('   This bypasses API date range limitations.')
    logger.info('=' * 70)
    
    total_fetched = 0
    pagination_token = None
    batch_num = 1
    max_results = 100
    attempt_count = 0
    reached_start_date = False
    
    while attempt_count < max_attempts:
        attempt_count += 1
        logger.info(f'Batch #{batch_num} (Attempt {attempt_count}/{max_attempts}): Fetching tweets (pagination_token: {pagination_token[:20] + "..." if pagination_token else "None"})...')
        
        try:
            # SOLUTION: Fetch WITHOUT date filters - get all tweets via pagination
            # Then filter locally by date range
            tweets, next_token = client.fetch_user_tweets(
                username=author_handle,
                max_results=max_results,
                # Don't use start_time/end_time - fetch all tweets
                pagination_token=pagination_token,
            )
            
            if not tweets:
                logger.info('No more tweets found')
                break
            
            # Filter by date range locally (tweets already filtered by API for retweets/replies)
            original_tweets = []
            oldest_in_batch = None
            
            for tweet in tweets:
                # Double-check: Skip replies (shouldn't happen but safety check)
                if tweet.get('in_reply_to_user_id') or (tweet.get('text', '').strip().startswith('@')):
                    continue
                
                # Check date range
                created_at = tweet.get('created_at')
                if created_at:
                    if isinstance(created_at, str):
                        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    
                    # Track oldest tweet in batch
                    if oldest_in_batch is None or created_at < oldest_in_batch:
                        oldest_in_batch = created_at
                    
                    # Only include tweets in our desired range (Dec 1, 2023 to Feb 14, 2025)
                    if created_at >= start_date and created_at <= end_date:
                        original_tweets.append(tweet)
                    # If we've gone past our start_date, we can stop
                    elif created_at < start_date:
                        logger.info(f'Reached start date ({start_date}). Oldest tweet in batch: {oldest_in_batch}')
                        reached_start_date = True
                        break
            
            # Insert tweets that match our date range
            if original_tweets:
                inserted = insert_tweets(conn, original_tweets, author_handle)
                total_fetched += inserted
                logger.info(f'✓ Batch #{batch_num} complete: {inserted} tweets in date range inserted')
                logger.info(f'✓ Total progress: {total_fetched} tweets fetched so far')
            else:
                logger.info(f'✓ Batch #{batch_num}: {len(tweets)} tweets fetched, {len(original_tweets)} in date range')
                if oldest_in_batch:
                    logger.info(f'   Oldest tweet in batch: {oldest_in_batch}')
            
            # Stop if we've reached the start_date
            if reached_start_date:
                logger.info(f'✅ Reached start date ({start_date}). Stopping.')
                break
            
            # Check if there's a next page
            if not next_token:
                logger.info('No more pages available (reached end)')
                break
            
            # Update pagination token for next iteration
            pagination_token = next_token
            batch_num += 1
            
            # Check if we've reached max attempts
            if attempt_count >= max_attempts:
                logger.warning(f'⚠️  Reached maximum attempts ({max_attempts}). Stopping to limit API costs.')
                logger.info(f'   Fetched {total_fetched} tweets so far. More tweets may be available.')
                logger.info(f'   Oldest tweet checked: {oldest_in_batch}')
                break
            
            # Rate limit pause
            logger.info('⏸️  Rate limit: Pausing for 15 minutes before next batch...')
            logger.info(f'   Next batch will start at: {datetime.now() + timedelta(minutes=15)}')
            time.sleep(15 * 60)
            
        except Exception as e:
            logger.error(f'Error fetching batch: {str(e)}')
            import traceback
            traceback.print_exc()
            
            # If we've reached max attempts, stop
            if attempt_count >= max_attempts:
                logger.warning(f'⚠️  Reached maximum attempts ({max_attempts}) after error. Stopping to limit API costs.')
                break
            
            # Otherwise, wait and retry
            logger.info(f'⏸️  Waiting before retry (attempt {attempt_count}/{max_attempts})...')
            time.sleep(60)  # Wait 1 minute before retry
    
    if attempt_count >= max_attempts and total_fetched == 0:
        logger.warning('⚠️  Task 2 stopped: Maximum attempts reached with no tweets fetched.')
        logger.warning('   This might indicate no tweets exist in this date range.')
    else:
        logger.info(f'✅ Task 2 Complete: Fetched {total_fetched} tweets backward')
    
    return total_fetched


def main():
    """Main entry point."""
    # Convert IST to UTC for API calls
    # November 3, 2025, 18:28:07 IST = November 3, 2025, 12:58:07 UTC
    forward_start = datetime(2025, 11, 3, 12, 58, 7, tzinfo=timezone.utc)
    
    # February 14, 2025, 18:03:37 IST = February 14, 2025, 12:33:37 UTC
    backward_end = datetime(2025, 2, 14, 12, 33, 37, tzinfo=timezone.utc)
    
    # December 1, 2023, 00:00:00 IST = November 30, 2023, 18:30:00 UTC
    backward_start = datetime(2023, 11, 30, 18, 30, 0, tzinfo=timezone.utc)
    
    author_handle = 'OPChoudhary_Ind'
    
    logger.info('=' * 70)
    logger.info('OPC TWEET GAP FETCHER')
    logger.info('=' * 70)
    logger.info(f'Author: @{author_handle}')
    logger.info(f'Task 1: Fetch after {forward_start} (IST: Nov 3, 2025, 18:28:07)')
    logger.info(f'Task 2: Fetch before {backward_end} (IST: Feb 14, 2025, 18:03:37) back to {backward_start} (IST: Dec 1, 2023)')
    logger.info('Excluding: Retweets and Replies')
    logger.info('=' * 70)
    
    try:
        # Initialize Twitter client
        client = TwitterClient()
        
        # Get database connection
        conn = get_db_connection()
        
        # TASK 1: Fetch forward (after Nov 3, 2025)
        logger.info('')
        logger.info('Starting Task 1...')
        forward_count = fetch_forward(client, conn, author_handle, forward_start)
        
        if forward_count == 0:
            logger.warning('⚠️  Task 1 fetched 0 tweets. This might mean no new tweets exist.')
        
        # TASK 2: Fetch backward (before Feb 14, 2025)
        # Limit to 2 attempts to control API costs
        logger.info('')
        logger.info('Starting Task 2...')
        logger.info('⚠️  NOTE: Task 2 limited to 2 API call attempts to control costs')
        backward_count = fetch_backward(client, conn, author_handle, backward_end, backward_start, max_attempts=2)
        
        if backward_count == 0:
            logger.warning('⚠️  Task 2 fetched 0 tweets. This might mean no older tweets exist in this range.')
        
        # Summary
        logger.info('')
        logger.info('=' * 70)
        logger.info('FETCH SUMMARY')
        logger.info('=' * 70)
        logger.info(f'Task 1 (Forward): {forward_count} tweets')
        logger.info(f'Task 2 (Backward): {backward_count} tweets')
        logger.info(f'Total: {forward_count + backward_count} tweets')
        logger.info('=' * 70)
        
        # Close connection
        conn.close()
        
    except Exception as e:
        logger.error(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

