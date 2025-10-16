#!/usr/bin/env python3
"""
Tweet Parser Script

Parses raw tweets from database and stores parsed events.

Usage:
    python scripts/parse_tweets.py                    # Parse all pending tweets
    python scripts/parse_tweets.py --limit 100        # Parse 100 tweets
    python scripts/parse_tweets.py --reparse          # Reparse all tweets
"""

import os
import sys
import time
from pathlib import Path
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.src.parsing.orchestrator import ParsingOrchestrator

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


def get_tweets_to_parse(conn, limit: int = None, reparse: bool = False):
    """
    Get tweets that need parsing.
    
    Args:
        conn: Database connection
        limit: Maximum number of tweets to parse
        reparse: If True, reparse all tweets (ignore processing_status)
    
    Returns:
        List of tweet records
    """
    with conn.cursor() as cur:
        if reparse:
            # Get all tweets
            query = """
                SELECT tweet_id, text, created_at
                FROM raw_tweets
                WHERE author_handle = 'OPChoudhary_Ind'
                ORDER BY created_at DESC
            """
        else:
            # Get only pending tweets
            query = """
                SELECT tweet_id, text, created_at
                FROM raw_tweets
                WHERE author_handle = 'OPChoudhary_Ind'
                  AND processing_status = 'pending'
                ORDER BY created_at DESC
            """
        
        if limit:
            query += f" LIMIT {limit}"
        
        cur.execute(query)
        
        tweets = []
        for row in cur.fetchall():
            tweets.append({
                'id': row[0],
                'text': row[1],
                'created_at': row[2],
            })
        
        return tweets


def insert_parsed_event(conn, parsed_event: dict):
    """
    Insert parsed event into database.
    
    Args:
        conn: Database connection
        parsed_event: Parsed event dict
    """
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO parsed_events (
                tweet_id,
                event_type, event_type_confidence,
                event_date, date_confidence,
                locations,
                people_mentioned, organizations, schemes_mentioned,
                overall_confidence,
                needs_review, review_status,
                parsed_by
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (tweet_id) 
            DO UPDATE SET
                event_type = EXCLUDED.event_type,
                event_type_confidence = EXCLUDED.event_type_confidence,
                event_date = EXCLUDED.event_date,
                date_confidence = EXCLUDED.date_confidence,
                locations = EXCLUDED.locations,
                people_mentioned = EXCLUDED.people_mentioned,
                organizations = EXCLUDED.organizations,
                schemes_mentioned = EXCLUDED.schemes_mentioned,
                overall_confidence = EXCLUDED.overall_confidence,
                needs_review = EXCLUDED.needs_review,
                parsed_by = EXCLUDED.parsed_by,
                parsed_at = NOW()
        """, (
            parsed_event['tweet_id'],
            parsed_event['event_type'],
            parsed_event['event_type_confidence'],
            parsed_event['event_date'],
            parsed_event['date_confidence'],
            psycopg2.extras.Json(parsed_event['locations']),
            parsed_event['people_mentioned'],
            parsed_event['organizations'],
            parsed_event['schemes_mentioned'],
            parsed_event['overall_confidence'],
            parsed_event['needs_review'],
            parsed_event['review_status'],
            parsed_event['parsed_by'],
        ))
        
        conn.commit()


def update_tweet_status(conn, tweet_id: str, status: str = 'parsed'):
    """
    Update raw tweet processing status.
    
    Args:
        conn: Database connection
        tweet_id: Tweet ID
        status: New status
    """
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE raw_tweets
            SET processing_status = %s
            WHERE tweet_id = %s
        """, (status, tweet_id))
        
        conn.commit()


def main():
    """Main entry point."""
    import argparse
    parser = argparse.ArgumentParser(description='Parse raw tweets into structured events')
    parser.add_argument('--limit', type=int, help='Maximum number of tweets to parse')
    parser.add_argument('--reparse', action='store_true', help='Reparse all tweets (ignore status)')
    parser.add_argument('--batch-size', type=int, default=10, help='Batch size for processing (default: 10)')
    
    args = parser.parse_args()
    
    logger.info('=' * 60)
    logger.info('TWEET PARSING PIPELINE')
    logger.info('=' * 60)
    logger.info('')
    
    try:
        # Connect to database
        conn = get_db_connection()
        logger.info('✓ Connected to database')
        
        # Initialize orchestrator
        orchestrator = ParsingOrchestrator()
        logger.info('✓ Parsing orchestrator initialized')
        logger.info('')
        
        # Get tweets to parse
        tweets = get_tweets_to_parse(
            conn,
            limit=args.limit,
            reparse=args.reparse,
        )
        
        if not tweets:
            logger.info('✓ No tweets to parse')
            conn.close()
            return
        
        logger.info(f'Found {len(tweets)} tweets to parse')
        logger.info('')
        
        # Parse tweets in batches
        total_parsed = 0
        total_errors = 0
        batch_size = args.batch_size
        
        for i in range(0, len(tweets), batch_size):
            batch = tweets[i:i+batch_size]
            batch_num = (i // batch_size) + 1
            
            logger.info(f'Batch #{batch_num}: Processing {len(batch)} tweets...')
            
            for tweet in batch:
                try:
                    # Parse tweet
                    parsed = orchestrator.parse_tweet(
                        tweet_id=tweet['id'],
                        text=tweet['text'],
                        created_at=tweet['created_at'],
                        tweet_date=tweet['created_at'],
                    )
                    
                    # Insert into database
                    insert_parsed_event(conn, parsed)
                    
                    # Update tweet status
                    update_tweet_status(conn, tweet['id'], 'parsed')
                    
                    total_parsed += 1
                    
                    # Log progress
                    if total_parsed % 10 == 0:
                        logger.info(f'  Progress: {total_parsed}/{len(tweets)} tweets parsed')
                    
                except Exception as e:
                    logger.error(f'  Error parsing tweet {tweet["id"]}: {str(e)}')
                    total_errors += 1
                    
                    # Mark as error
                    try:
                        update_tweet_status(conn, tweet['id'], 'error')
                    except:
                        pass
            
            logger.info(f'✓ Batch #{batch_num} complete')
            logger.info('')
            
            # Small delay between batches
            if i + batch_size < len(tweets):
                time.sleep(0.5)
        
        # Summary
        logger.info('=' * 60)
        logger.info('PARSING COMPLETE')
        logger.info('=' * 60)
        logger.info(f'✓ Total parsed: {total_parsed}')
        logger.info(f'✗ Total errors: {total_errors}')
        logger.info('')
        
        # Get summary statistics
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    event_type,
                    COUNT(*) as count,
                    AVG(overall_confidence) as avg_confidence,
                    COUNT(*) FILTER (WHERE needs_review = true) as needs_review_count
                FROM parsed_events
                GROUP BY event_type
                ORDER BY count DESC
            """)
            
            logger.info('Event Type Summary:')
            logger.info('-' * 60)
            for row in cur.fetchall():
                event_type, count, avg_conf, review_count = row
                logger.info(f'{event_type:25s} {count:4d} events | Avg confidence: {avg_conf:.2f} | Needs review: {review_count}')
        
        logger.info('')
        logger.info('=' * 60)
        
        # Close connection
        conn.close()
        
    except Exception as e:
        logger.error(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

