#!/usr/bin/env python3
"""Export parsed events to JSON for Next.js dashboard"""

import os
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime

load_dotenv(Path(__file__).parent / '.env.local')

def export():
    database_url = os.getenv('DATABASE_URL')
    conn = psycopg2.connect(database_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    cur.execute("""
        SELECT 
            pe.id,
            pe.tweet_id as id,
            rt.text as content,
            rt.created_at as timestamp,
            pe.event_type,
            pe.event_date,
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
    
    events = cur.fetchall()
    
    # Convert to JSON-serializable format
    output = []
    for event in events:
        output.append({
            'id': event['id'],
            'timestamp': event['timestamp'].isoformat() if event['timestamp'] else '',
            'content': event['content'],
            'parsed': {
                'event_type': event['event_type'],
                'event_date': event['event_date'].isoformat() if event['event_date'] else None,
                'locations': event['locations'] or [],
                'people': event['people_mentioned'] or [],
                'organizations': event['organizations'] or [],
                'schemes': event['schemes_mentioned'] or [],
            },
            'confidence': float(event['overall_confidence']) if event['overall_confidence'] else 0,
            'needs_review': event['needs_review'],
            'review_status': event['review_status'],
        })
    
    # Write to data directory
    output_path = Path(__file__).parent / 'data' / 'parsed_tweets.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Exported {len(output)} parsed tweets to {output_path}")
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    export()

