
import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env.local in the project root
load_dotenv(dotenv_path=Path(__file__).parent / '.env.local')

def get_db_connection():
    """Establishes a connection to the PostgreSQL database."""
    host = os.getenv("POSTGRES_HOST")
    database = os.getenv("POSTGRES_DATABASE")
    user = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")

    print(f"Connecting with DSN: host={host} dbname={database} user={user}")

    try:
        conn = psycopg2.connect(
            host=host,
            database=database,
            user=user,
            password=password
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error connecting to the database: {e}")
        return None

def check_raw_tweets():
    """Fetches and prints the 10 most recent raw tweets."""
    conn = get_db_connection()
    if not conn:
        return

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT COUNT(*) FROM raw_tweets;")
            count = cur.fetchone()[0]
            print(f"--- Found {count} tweets in raw_tweets table ---")

            if count > 0:
                cur.execute("""
                    SELECT tweet_id, author_handle, text, created_at, processing_status
                    FROM raw_tweets 
                    ORDER BY created_at DESC 
                    LIMIT 10;
                """)
                
                recent_tweets = cur.fetchall()

                print("\n--- 10 Most Recent Raw Tweets ---")
                for i, tweet in enumerate(recent_tweets):
                    print(f"\n--- Tweet {i+1} (ID: {tweet['tweet_id']}) ---")
                    print(f"  Author: {tweet['author_handle']}")
                    print(f"  Created At: {tweet['created_at']}")
                    print(f"  Status: {tweet['processing_status']}")
                    print(f"  Text: {tweet['text'][:100]}...")

    except psycopg2.Error as e:
        print(f"Database query failed: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    check_raw_tweets()
