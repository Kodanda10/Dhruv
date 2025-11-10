
import os
import psycopg2
import psycopg2.extras
import json
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env.local in the project root
load_dotenv(dotenv_path=Path(__file__).parent / '.env.local')

def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST"),
            database=os.getenv("POSTGRES_DATABASE"),
            user=os.getenv("POSTGRES_USER"),
            password=os.getenv("POSTGRES_PASSWORD")
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error connecting to the database: {e}")
        return None

def diagnose_parsed_events():
    """Fetches and prints the 10 most recent parsed events."""
    conn = get_db_connection()
    if not conn:
        return

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("""
                SELECT * 
                FROM parsed_events 
                ORDER BY parsed_at DESC 
                LIMIT 10;
            """)
            
            recent_events = cur.fetchall()

            if not recent_events:
                print("No parsed events found in the database.")
                return

            print("--- Diagnosis of 10 Most Recent Parsed Events ---")
            for i, event in enumerate(recent_events):
                print(f"\n--- Event {i+1} (ID: {event['id']}) ---")
                print(f"  Tweet ID: {event['tweet_id']}")
                print(f"  Parsed At: {event['parsed_at']}")
                print(f"  Review Status: {event['review_status']}")
                print(f"  Needs Review: {event['needs_review']}")
                
                # Check for missing core data
                print(f"  Event Type: {event['event_type']} (Confidence: {event['event_type_confidence']})")
                print(f"  Event Date: {event['event_date']} (Confidence: {event['date_confidence']})")
                
                # Pretty print JSONB fields for readability
                locations = event['locations']
                print(f"  Locations: {json.dumps(locations, indent=2) if locations else '[]'}")
                
                print(f"  People Mentioned: {event['people_mentioned'] if event['people_mentioned'] else '[]'}")
                print(f"  Organizations: {event['organizations'] if event['organizations'] else '[]'}")
                print(f"  Schemes Mentioned: {event['schemes_mentioned'] if event['schemes_mentioned'] else '[]'}")
                print(f"  Overall Confidence: {event['overall_confidence']}")

    except psycopg2.Error as e:
        print(f"Database query failed: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    diagnose_parsed_events()
