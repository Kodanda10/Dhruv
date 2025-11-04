#!/usr/bin/env python3
"""Check parsed events in database"""

import os
import psycopg2
import json
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env.local')

def check():
    database_url = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(database_url)
    
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 
                pe.id,
                pe.tweet_id,
                rt.text,
                rt.created_at,
                pe.event_type,
                pe.event_type_confidence,
                pe.event_date,
                pe.date_confidence,
                pe.locations,
                pe.people_mentioned,
                pe.organizations,
                pe.schemes_mentioned,
                pe.overall_confidence,
                pe.needs_review,
                pe.review_status
            FROM parsed_events pe
            JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
            ORDER BY rt.created_at DESC
        """)
        
        rows = cur.fetchall()
        
        print("=" * 80)
        print(f"PARSED EVENTS ({len(rows)} total)")
        print("=" * 80)
        print()
        
        for row in rows:
            (id, tweet_id, text, created_at, event_type, event_type_conf, 
             event_date, date_conf, locations, people, orgs, schemes, 
             overall_conf, needs_review, review_status) = row
            
            print(f"Event #{id}")
            print("-" * 80)
            print(f"Tweet Date: {created_at}")
            print(f"Text: {text[:100]}...")
            print()
            print(f"Event Type: {event_type} (confidence: {event_type_conf})")
            print(f"Event Date: {event_date} (confidence: {date_conf})")
            print(f"Overall Confidence: {overall_conf}")
            print(f"Needs Review: {'Yes' if needs_review else 'No'} | Status: {review_status}")
            print()
            print(f"Locations: {json.dumps(locations, indent=2) if locations else 'None'}")
            print(f"People: {people if people else 'None'}")
            print(f"Organizations: {orgs if orgs else 'None'}")
            print(f"Schemes: {schemes if schemes else 'None'}")
            print()
            print("=" * 80)
            print()
    
    conn.close()

if __name__ == '__main__':
    check()

