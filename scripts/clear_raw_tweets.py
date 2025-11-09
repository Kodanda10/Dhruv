import os
import psycopg2
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_db_connection():
    """Get PostgreSQL database connection."""
    # Load environment variables from .env.local
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    load_dotenv(dotenv_path)
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    
    return psycopg2.connect(database_url)

def clear_raw_tweets_table(conn):
    """Truncate the raw_tweets table to remove all data."""
    with conn.cursor() as cur:
        try:
            cur.execute("TRUNCATE TABLE raw_tweets RESTART IDENTITY CASCADE;")
            conn.commit()
            logger.info("Successfully truncated the 'raw_tweets' table.")
        except psycopg2.Error as e:
            logger.error(f"Error truncating table: {e}")
            conn.rollback()

def main():
    try:
        conn = get_db_connection()
        clear_raw_tweets_table(conn)
        conn.close()
    except Exception as e:
        logger.error(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
