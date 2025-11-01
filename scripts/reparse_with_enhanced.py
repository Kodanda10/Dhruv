#!/usr/bin/env python3
"""
Reparse all tweets using the enhanced parser (combines regex + AI).
"""
import os
import sys
from pathlib import Path
import psycopg2
import psycopg2.extras
from datetime import datetime
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

from api.src.parsing.enhanced_parser import get_enhanced_parser

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


def get_all_tweets(conn):
    """Get all tweets that need reparsing."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT tweet_id, text, created_at
            FROM raw_tweets
            WHERE author_handle = 'OPChoudhary_Ind'
            ORDER BY created_at DESC
        """)
        
        tweets = []
        for row in cur.fetchall():
            tweets.append({
                'id': row[0],
                'text': row[1],
                'created_at': row[2],
            })
        
        return tweets


def delete_and_insert_parsed_event(conn, parsed_event: dict):
    """
    Delete existing and insert new parsed event.
    
    Args:
        conn: Database connection
        parsed_event: Parsed event dict
    """
    with conn.cursor() as cur:
        # First, delete any existing parsed event for this tweet
        cur.execute("""
            DELETE FROM parsed_events WHERE tweet_id = %s
        """, (parsed_event['tweet_id'],))
        
        # Then insert the new one
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
    """Update raw tweet processing status."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE raw_tweets
            SET processing_status = %s
            WHERE tweet_id = %s
        """, (status, tweet_id))
        
        conn.commit()


def main():
    """Main entry point."""
    logger.info('=' * 80)
    logger.info('REPARSING WITH ENHANCED PARSER')
    logger.info('=' * 80)
    logger.info('')
    
    try:
        # Connect to database
        conn = get_db_connection()
        logger.info('✓ Connected to database')
        
        # Initialize enhanced parser
        parser = get_enhanced_parser()
        logger.info('✓ Enhanced parser initialized')
        logger.info('  Combines: Regex patterns (parse.ts) + AI extraction')
        logger.info('')
        
        # Get all tweets
        tweets = get_all_tweets(conn)
        logger.info(f'Found {len(tweets)} tweets to reparse')
        logger.info('')
        
        if not tweets:
            logger.info('✓ No tweets to reparse')
            conn.close()
            return
        
        # Reparse all tweets
        total_parsed = 0
        total_errors = 0
        
        for i, tweet in enumerate(tweets, 1):
            try:
                logger.info(f'[{i}/{len(tweets)}] Parsing tweet {tweet["id"]}...')
                
                # Parse tweet
                parsed = parser.parse_tweet(
                    tweet_id=tweet['id'],
                    text=tweet['text'],
                    created_at=tweet['created_at'],
                    tweet_date=tweet['created_at'],
                )
                
                # Log extracted info
                logger.info(f'  Event: {parsed["event_type"]} (conf: {parsed["event_type_confidence"]:.2f})')
                logger.info(f'  Locations: {[loc["name"] for loc in parsed["locations"]]}')
                logger.info(f'  People: {parsed["people_mentioned"]}')
                logger.info(f'  Organizations: {parsed["organizations"]}')
                logger.info(f'  Schemes: {parsed["schemes_mentioned"]}')
                logger.info(f'  Overall confidence: {parsed["overall_confidence"]:.2f}')
                logger.info(f'  Needs review: {parsed["needs_review"]}')
                
                # Save to database
                delete_and_insert_parsed_event(conn, parsed)
                update_tweet_status(conn, tweet['id'], 'parsed')
                
                total_parsed += 1
                logger.info(f'  ✓ Saved')
                logger.info('')
                
            except Exception as e:
                logger.error(f'  ✗ Error parsing tweet {tweet["id"]}: {str(e)}')
                total_errors += 1
                try:
                    update_tweet_status(conn, tweet['id'], 'error')
                except:
                    pass
                logger.info('')
        
        # Summary
        logger.info('=' * 80)
        logger.info('REPARSING COMPLETE')
        logger.info('=' * 80)
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
            logger.info('-' * 80)
            for row in cur.fetchall():
                event_type, count, avg_conf, review_count = row
                logger.info(
                    f'{event_type:25s} {count:4d} events | '
                    f'Avg confidence: {avg_conf:.2f} | Needs review: {review_count}'
                )
        
        logger.info('')
        logger.info('=' * 80)
        
        # Close connection
        conn.close()
        
    except Exception as e:
        logger.error(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

