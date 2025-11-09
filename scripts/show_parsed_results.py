import os
import psycopg2
from dotenv import load_dotenv
import logging

# --- Basic Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

def get_db_connection():
    """Gets a connection to the PostgreSQL database."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set.")
    return psycopg2.connect(database_url)

def fetch_parsed_results(conn, limit=20):
    """Fetches the most recently parsed events from the database."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT tweet_id, event_type, locations, parsed_at
            FROM parsed_events
            ORDER BY parsed_at DESC
            LIMIT %s;
        """, (limit,))
        results = cur.fetchall()
        return results

def display_results(results):
    """Displays the fetched results in a formatted table."""
    if not results:
        logger.info("No parsed results found in the database yet.")
        return

    print("\n--- Most Recent Parsed Events ---")
    print("-" * 80)
    print(f"{'Tweet ID':<20} | {'Event Type':<15} | {'Locations':<30} | {'Parsed At':<20}")
    print("-" * 80)

    for row in results:
        tweet_id, event_type, locations, parsed_at = row
        locations_str = ", ".join(locations) if locations else "N/A"
        print(f"{tweet_id:<20} | {event_type:<15} | {locations_str:<30} | {parsed_at.strftime('%Y-%m-%d %H:%M:%S')}")

    print("-" * 80)
    print(f"Showing {len(results)} most recent results.\n")


if __name__ == "__main__":
    try:
        connection = get_db_connection()
        parsed_results = fetch_parsed_results(connection)
        display_results(parsed_results)
    except Exception as e:
        logger.error(f"An error occurred: {e}")
    finally:
        if 'connection' in locals() and connection:
            connection.close()
            logger.info("Database connection closed.")
