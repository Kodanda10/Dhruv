#!/usr/bin/env python3
"""
Parse new tweets using enhanced Gemini parser with reference datasets
"""

import psycopg2
import os
import json
import time
from datetime import datetime
from gemini_parser import parse_tweet_with_gemini

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'dhruv_db'),
        user=os.getenv('DB_USER', 'dhruv_user'),
        password=os.getenv('DB_PASSWORD', 'dhruv_pass')
    )

def find_unparsed_tweets():
    """Find tweets that need parsing"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT rt.tweet_id, rt.text, rt.created_at, rt.author_handle
        FROM raw_tweets rt
        LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
        WHERE pe.tweet_id IS NULL
        AND rt.processing_status = 'pending'
        ORDER BY rt.created_at DESC
        LIMIT 10
    """)
    
    tweets = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return tweets

def save_parsed_result(tweet_id: str, parsed_data: dict):
    """Save parsed result to database"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Insert into parsed_events table
        cursor.execute("""
            INSERT INTO parsed_events (
                tweet_id, event_type, event_type_en, event_code,
                locations, people, organizations, schemes, schemes_en,
                date, confidence, reasoning, review_status, needs_review,
                matched_scheme_ids, matched_event_id, generated_hashtags,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
            )
        """, (
            tweet_id,
            parsed_data.get('event_type', 'Unknown'),
            parsed_data.get('event_type_en', 'Unknown'),
            parsed_data.get('event_code', 'UNKNOWN'),
            parsed_data.get('locations', []),
            parsed_data.get('people', []),
            parsed_data.get('organizations', []),
            parsed_data.get('schemes', []),
            parsed_data.get('schemes_en', []),
            parsed_data.get('date'),
            parsed_data.get('confidence', 0.0),
            parsed_data.get('reasoning', ''),
            'pending',  # review_status
            True,       # needs_review
            parsed_data.get('matched_scheme_ids', []),
            parsed_data.get('matched_event_id'),
            parsed_data.get('generated_hashtags', [])
        ))
        
        # Update raw_tweets processing status
        cursor.execute("""
            UPDATE raw_tweets 
            SET processing_status = 'parsed'
            WHERE tweet_id = %s
        """, (tweet_id,))
        
        conn.commit()
        print(f"✓ Parsed and saved tweet {tweet_id}")
        
    except Exception as e:
        print(f"✗ Error saving parsed result for {tweet_id}: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

def parse_new_tweets():
    """Main function to parse new tweets"""
    print(f"[{datetime.now()}] Starting tweet parsing...")
    
    unparsed_tweets = find_unparsed_tweets()
    
    if not unparsed_tweets:
        print("No unparsed tweets found")
        return
    
    print(f"Found {len(unparsed_tweets)} unparsed tweets")
    
    for tweet_id, text, created_at, author_handle in unparsed_tweets:
        try:
            print(f"Parsing tweet {tweet_id} from {author_handle}...")
            
            # Parse using enhanced Gemini parser
            parsed_data = parse_tweet_with_gemini(text)
            
            # Save to database
            save_parsed_result(tweet_id, parsed_data)
            
            # Rate limiting - wait 2 seconds between requests
            time.sleep(2)
            
        except Exception as e:
            print(f"✗ Error parsing tweet {tweet_id}: {e}")
            continue
    
    print(f"[{datetime.now()}] Tweet parsing completed")

if __name__ == "__main__":
    parse_new_tweets()
