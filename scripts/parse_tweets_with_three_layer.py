#!/usr/bin/env python3
"""
Tweet Parser Script with Three-Layer Consensus Engine Integration

Parses raw tweets using the three-layer consensus engine:
1. Gemini API (Primary)
2. Ollama Local Model (Secondary) 
3. Custom Parsing Engine (Fallback)

Uses 2/3 voting consensus algorithm with confidence scoring.

Usage:
    python scripts/parse_tweets_with_three_layer.py                    # Parse all pending tweets
    python scripts/parse_tweets_with_three_layer.py --limit 100        # Parse 100 tweets
    python scripts/parse_tweets_with_three_layer.py --reparse          # Reparse all tweets
    python scripts/parse_tweets_with_three_layer.py --fallback          # Use Python orchestrator as fallback
"""

import os
import sys
import time
import json
from pathlib import Path
from datetime import datetime
import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

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
        reparse: If True, reparse all tweets (ignore status)
    
    Returns:
        List of tweet dicts with id, text, created_at, author_handle
    """
    with conn.cursor() as cur:
        if reparse:
            # Get all tweets
            query = """
                SELECT tweet_id, text, created_at, author_handle
                FROM raw_tweets
                ORDER BY created_at DESC
            """
            params = []
        else:
            # Get only unparsed tweets
            query = """
                SELECT tweet_id, text, created_at, author_handle
                FROM raw_tweets
                WHERE processing_status = 'pending'
                ORDER BY created_at DESC
            """
            params = []
        
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        
        cur.execute(query, params)
        
        tweets = []
        for row in cur.fetchall():
            tweets.append({
                'id': row[0],
                'text': row[1],
                'created_at': row[2],
                'author_handle': row[3] if len(row) > 3 else 'OPChoudhary_Ind',
            })
        
        return tweets


def call_three_layer_api(tweet_id: str, tweet_text: str, created_at: datetime, author_handle: str, api_base_url: str = None) -> dict:
    """
    Call the three-layer consensus parsing API.
    
    Args:
        tweet_id: Tweet ID
        tweet_text: Tweet text
        created_at: Tweet creation timestamp
        author_handle: Author handle
        api_base_url: Base URL for Next.js API (default: http://localhost:3000)
    
    Returns:
        Parsed result dict
    """
    if api_base_url is None:
        api_base_url = os.getenv('NEXTJS_API_URL', 'http://localhost:3000')
    
    url = f"{api_base_url}/api/parsing/three-layer-consensus"
    
    # Prepare request payload
    payload = {
        'tweet_id': str(tweet_id),
        'tweet_text': tweet_text,
        'created_at': created_at.isoformat() if isinstance(created_at, datetime) else str(created_at),
        'author_handle': author_handle,
    }
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        
        result = response.json()
        
        if result.get('success'):
            # Return the 'result' part which contains parsed_data, consensus_analysis, etc.
            return result.get('result', {})
        else:
            raise Exception(f"API returned error: {result.get('error', 'Unknown error')}")
            
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {e}")
        raise
    except Exception as e:
        logger.error(f"Error calling three-layer API: {e}")
        raise


def convert_three_layer_result_to_db_format(three_layer_result: dict, tweet_id: str) -> dict:
    """
    Convert three-layer consensus result to database format.
    
    Args:
        three_layer_result: Result from three-layer API (response.result)
        tweet_id: Tweet ID
    
    Returns:
        Parsed event dict ready for database insertion
    """
    # API returns: { success: true, result: { parsed_data, consensus_analysis, layer_results } }
    # We're passed the 'result' part
    parsed_data = three_layer_result.get('parsed_data', {})
    consensus_analysis = three_layer_result.get('consensus_analysis', {})
    layer_results = three_layer_result.get('layer_results', {})
    
    # Extract geo_hierarchy from parsed_data
    geo_hierarchy = parsed_data.get('geo_hierarchy', [])
    
    # Extract locations with geo-hierarchy
    locations = []
    if geo_hierarchy and len(geo_hierarchy) > 0:
        # Use geo_hierarchy data
        for geo in geo_hierarchy:
            locations.append({
                'name': geo.get('name', ''),
                'name_en': geo.get('name_en', ''),
                'type': geo.get('type', 'district'),
                'confidence': geo.get('confidence', 0.8),
                'state': geo.get('state', 'Chhattisgarh'),
                'district': geo.get('district', ''),
                'block': geo.get('block', ''),
                'assembly_constituency': geo.get('assembly_constituency', ''),
            })
    else:
        # Fallback: use simple location names
        for loc in parsed_data.get('locations', []):
            if isinstance(loc, str):
                locations.append({
                    'name': loc,
                    'name_en': '',
                    'type': 'unknown',
                    'confidence': 0.6,
                    'state': 'Chhattisgarh',
                    'district': '',
                    'block': '',
                    'assembly_constituency': '',
                })
            elif isinstance(loc, dict):
                locations.append({
                    'name': loc.get('name', ''),
                    'name_en': loc.get('name_en', ''),
                    'type': loc.get('type', 'unknown'),
                    'confidence': loc.get('confidence', 0.6),
                    'state': loc.get('state', 'Chhattisgarh'),
                    'district': loc.get('district', ''),
                    'block': loc.get('block', ''),
                    'assembly_constituency': loc.get('assembly_constituency', ''),
                })
    
    # Extract event date (use tweet created_at as fallback)
    event_date = None
    date_confidence = 0.6
    
    # Use consensus score for overall confidence
    consensus_score = consensus_analysis.get('consensus_score', 0.7)
    agreement_level = consensus_analysis.get('agreement_level', 'medium')
    
    # Map agreement level to confidence
    if agreement_level == 'high':
        overall_confidence = min(0.95, consensus_score + 0.1)
    elif agreement_level == 'medium':
        overall_confidence = consensus_score
    else:
        overall_confidence = max(0.5, consensus_score - 0.1)
    
    # Determine needs_review based on confidence and conflicts
    needs_review = overall_confidence < 0.7 or len(consensus_analysis.get('conflicts', [])) > 0
    
    # Build metadata for consensus_results column
    metadata = {
        'consensus_score': consensus_score,
        'agreement_level': agreement_level,
        'conflicts': consensus_analysis.get('conflicts', []),
        'geo_hierarchy_resolved': consensus_analysis.get('geo_hierarchy_resolved', False),
        'layer_results': {
            'gemini': layer_results.get('gemini'),
            'ollama': layer_results.get('ollama'),
            'custom': layer_results.get('custom'),
        },
        'processing_time_ms': three_layer_result.get('processing_time_ms', 0),
    }
    
    return {
        'tweet_id': str(tweet_id),
        'event_type': parsed_data.get('event_type') or 'अन्य',
        'event_type_confidence': parsed_data.get('confidence', overall_confidence),
        'event_date': event_date,
        'date_confidence': date_confidence,
        'locations': locations,
        'people_mentioned': parsed_data.get('people_mentioned', []),
        'organizations': [],  # Not extracted by three-layer engine yet
        'schemes_mentioned': parsed_data.get('schemes_mentioned', []),
        'overall_confidence': round(overall_confidence, 2),
        'needs_review': needs_review,
        'review_status': 'pending',
        'parsed_by': 'three-layer-consensus',
        
        # Store consensus metadata in JSONB field
        '_metadata': metadata,
        'geo_hierarchy': geo_hierarchy if geo_hierarchy else None,
    }


def insert_parsed_event(conn, parsed_event: dict):
    """
    Insert parsed event into database.
    
    Args:
        conn: Database connection
        parsed_event: Parsed event dict
    """
    with conn.cursor() as cur:
        # First, delete any existing parsed event for this tweet
        cur.execute("""
            DELETE FROM parsed_events WHERE tweet_id = %s
        """, (parsed_event['tweet_id'],))
        
        # Extract metadata if present
        metadata = parsed_event.pop('_metadata', None)
        
        # Extract geo_hierarchy if available in metadata
        geo_hierarchy = None
        if metadata and 'geo_hierarchy' in metadata:
            geo_hierarchy = metadata.pop('geo_hierarchy', None)
        
        # Check if consensus_results column exists
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'parsed_events' 
            AND column_name = 'consensus_results'
        """)
        has_consensus_column = cur.fetchone() is not None
        
        # Build query based on whether consensus_results column exists
        if has_consensus_column:
            cur.execute("""
                INSERT INTO parsed_events (
                    tweet_id,
                    event_type, event_type_confidence,
                    event_date, date_confidence,
                    locations,
                    people_mentioned, organizations, schemes_mentioned,
                    overall_confidence,
                    needs_review, review_status,
                    parsed_by,
                    consensus_results,
                    geo_hierarchy
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
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
                psycopg2.extras.Json(metadata) if metadata else None,
                psycopg2.extras.Json(geo_hierarchy) if geo_hierarchy else None,
            ))
        else:
            # Fallback: insert without consensus_results column
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


def parse_with_fallback(tweet: dict, api_base_url: str = None, use_fallback: bool = False):
    """
    Parse tweet using three-layer consensus, with optional Python orchestrator fallback.
    
    Args:
        tweet: Tweet dict with id, text, created_at, author_handle
        api_base_url: Next.js API base URL
        use_fallback: If True, use Python orchestrator if API fails
    
    Returns:
        Parsed event dict
    """
    try:
        # Try three-layer consensus API first
        three_layer_result = call_three_layer_api(
            tweet_id=tweet['id'],
            tweet_text=tweet['text'],
            created_at=tweet['created_at'],
            author_handle=tweet.get('author_handle', 'OPChoudhary_Ind'),
            api_base_url=api_base_url,
        )
        
        # Convert to database format
        parsed = convert_three_layer_result_to_db_format(three_layer_result, tweet['id'])
        return parsed
        
    except Exception as e:
        logger.warning(f"Three-layer API failed for tweet {tweet['id']}: {e}")
        
        if use_fallback:
            # Fallback to Python orchestrator
            logger.info(f"  Falling back to Python orchestrator...")
            try:
                from api.src.parsing.orchestrator import ParsingOrchestrator
                
                orchestrator = ParsingOrchestrator()
                parsed = orchestrator.parse_tweet(
                    tweet_id=tweet['id'],
                    text=tweet['text'],
                    created_at=tweet['created_at'],
                    tweet_date=tweet['created_at'],
                )
                parsed['parsed_by'] = 'python-orchestrator-fallback'
                return parsed
            except Exception as fallback_error:
                logger.error(f"  Fallback also failed: {fallback_error}")
                raise
        else:
            raise


def main():
    """Main entry point."""
    import argparse
    parser = argparse.ArgumentParser(description='Parse raw tweets using three-layer consensus engine')
    parser.add_argument('--limit', type=int, help='Maximum number of tweets to parse')
    parser.add_argument('--reparse', action='store_true', help='Reparse all tweets (ignore status)')
    parser.add_argument('--batch-size', type=int, default=10, help='Batch size for processing (default: 10)')
    parser.add_argument('--api-url', type=str, help='Next.js API base URL (default: http://localhost:3000)')
    parser.add_argument('--fallback', action='store_true', help='Use Python orchestrator as fallback if API fails')
    
    args = parser.parse_args()
    
    logger.info('=' * 60)
    logger.info('TWEET PARSING PIPELINE - THREE-LAYER CONSENSUS')
    logger.info('=' * 60)
    logger.info('')
    
    api_base_url = args.api_url or os.getenv('NEXTJS_API_URL', 'http://localhost:3000')
    logger.info(f'API Base URL: {api_base_url}')
    logger.info(f'Fallback enabled: {args.fallback}')
    logger.info('')
    
    try:
        # Connect to database
        conn = get_db_connection()
        logger.info('✓ Connected to database')
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
                    # Parse tweet using three-layer consensus
                    parsed = parse_with_fallback(
                        tweet,
                        api_base_url=api_base_url,
                        use_fallback=args.fallback,
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
                    COUNT(*) FILTER (WHERE needs_review = true) as needs_review_count,
                    COUNT(*) FILTER (WHERE parsed_by = 'three-layer-consensus') as three_layer_count
                FROM parsed_events
                GROUP BY event_type
                ORDER BY count DESC
            """)
            
            logger.info('Event Type Summary:')
            logger.info('-' * 60)
            for row in cur.fetchall():
                event_type, count, avg_conf, review_count, three_layer_count = row
                logger.info(f'{event_type:25s} {count:4d} events | Avg confidence: {avg_conf:.2f} | Needs review: {review_count} | Three-layer: {three_layer_count}')
        
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

