#!/usr/bin/env python3
"""
Update parsed_tweets.json with the latest parsed events from the database.
This script fetches parsed_events joined with raw_tweets to get complete data.
"""
import os
import sys
import json
import psycopg2
import psycopg2.extras
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent / '.env.local')

def get_db_connection():
    """Establishes and returns a database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    return psycopg2.connect(database_url)

def fetch_parsed_events(conn, limit=200):
    """Fetch parsed events with tweet content from database."""
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    pe.tweet_id as id,
                    rt.text as content,
                    rt.created_at as timestamp,
                    pe.event_type,
                    pe.event_type_confidence,
                    pe.locations,
                    pe.people_mentioned as people,
                    pe.organizations,
                    pe.schemes_mentioned as schemes,
                    pe.overall_confidence as confidence,
                    pe.needs_review,
                    pe.review_status,
                    pe.parsed_at
                FROM parsed_events pe
                LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
                WHERE rt.text IS NOT NULL
                ORDER BY pe.parsed_at DESC
                LIMIT %s
            """, (limit,))
            
            events = cur.fetchall()
            return events
    except Exception as e:
        print(f"❌ Error fetching parsed events: {e}")
        import traceback
        traceback.print_exc()
        return []

def convert_to_dashboard_format(event):
    """Convert database event to dashboard format."""
    # Handle locations (could be JSONB array or object)
    locations = event.get('locations', [])
    if locations and isinstance(locations, dict):
        locations = [locations]
    elif not locations:
        locations = []
    
    # Extract location names for parsed.locations format
    location_objects = []
    for loc in locations:
        if isinstance(loc, dict):
            location_objects.append({
                'name': loc.get('name', ''),
                'confidence': float(loc.get('confidence', 0)) if 'confidence' in loc else None,
                'type': loc.get('type', ''),
            })
        elif isinstance(loc, str):
            location_objects.append({'name': loc})
    
    parsed_data = {
        'event_type': event.get('event_type', 'other'),
        'locations': location_objects,
        'people': event.get('people', []) or [],
        'organizations': event.get('organizations', []) or [],
        'schemes': event.get('schemes', []) or [],
    }
    
    tweet_obj = {
        'id': str(event.get('id', '')),
        'timestamp': event['timestamp'].isoformat() if event.get('timestamp') else datetime.now().isoformat(),
        'content': event.get('content', ''),
        'parsed': parsed_data,
        'confidence': float(event.get('confidence', 0)) if event.get('confidence') is not None else 0.5,
        'needs_review': event.get('needs_review', False),
        'review_status': event.get('review_status', 'pending')
    }
    
    return tweet_obj

def update_parsed_tweets_file(new_tweets):
    """Update the parsed_tweets.json file with new tweets."""
    parsed_tweets_path = Path(__file__).parent / 'data' / 'parsed_tweets.json'
    
    # Load existing tweets
    existing_tweets = []
    if parsed_tweets_path.exists():
        try:
            with open(parsed_tweets_path, 'r', encoding='utf-8') as f:
                existing_tweets = json.load(f)
        except Exception as e:
            print(f"⚠️  Error loading existing tweets: {e}")
            existing_tweets = []
    
    # Create a set of existing tweet IDs for deduplication
    existing_ids = {str(tweet.get('id', '')) for tweet in existing_tweets}
    
    # Add new tweets that don't already exist
    added_count = 0
    for tweet in new_tweets:
        tweet_id = str(tweet.get('id', ''))
        if tweet_id and tweet_id not in existing_ids:
            existing_tweets.insert(0, tweet)  # Add to beginning (most recent first)
            existing_ids.add(tweet_id)
            added_count += 1
    
    # Save updated tweets
    try:
        with open(parsed_tweets_path, 'w', encoding='utf-8') as f:
            json.dump(existing_tweets, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Updated parsed_tweets.json")
        print(f"   Total tweets: {len(existing_tweets)}")
        print(f"   New tweets added: {added_count}")
        
        return True
    except Exception as e:
        print(f"❌ Error saving parsed_tweets.json: {e}")
        return False

def main():
    """Main function to update parsed tweets from database."""
    print("🔄 Updating parsed_tweets.json with latest parsed events from database")
    print("=" * 70)
    
    conn = None
    try:
        # Connect to database
        print("1. Connecting to database...")
        conn = get_db_connection()
        print("   ✅ Database connected")
        
        # Fetch parsed events
        print("\n2. Fetching parsed events from database...")
        parsed_events = fetch_parsed_events(conn, limit=200)
        
        if not parsed_events:
            print("   ⚠️  No parsed events found in database")
            print("   💡 Run: python scripts/parse_tweets.py to parse raw tweets")
            return
        
        print(f"   ✅ Found {len(parsed_events)} parsed events in database")
        
        # Convert to dashboard format
        print("\n3. Converting to dashboard format...")
        processed_tweets = []
        for event in parsed_events:
            tweet_obj = convert_to_dashboard_format(event)
            processed_tweets.append(tweet_obj)
        
        print(f"   ✅ Processed {len(processed_tweets)} tweets")
        
        # Update parsed_tweets.json
        print("\n4. Updating parsed_tweets.json...")
        success = update_parsed_tweets_file(processed_tweets)
        
        if success:
            print("\n🎉 SUCCESS!")
            print("=" * 70)
            print("✅ Parsed events successfully synced to parsed_tweets.json")
            print("✅ Dashboard will now show the latest parsed tweets")
            print("\nLatest parsed tweets:")
            print("-" * 70)
            for i, tweet in enumerate(processed_tweets[:5], 1):
                event_type = tweet.get('parsed', {}).get('event_type', 'other')
                locations = tweet.get('parsed', {}).get('locations', [])
                location_names = [loc.get('name', '') if isinstance(loc, dict) else loc for loc in locations[:2]]
                print(f"{i}. [{tweet['timestamp'][:10]}] {event_type}")
                print(f"   Locations: {', '.join(location_names) if location_names else 'None'}")
                print(f"   Content: {tweet['content'][:60]}...")
        else:
            print("\n❌ FAILED to update parsed_tweets.json")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    main()
