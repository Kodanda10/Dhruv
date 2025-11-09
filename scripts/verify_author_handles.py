import os
import psycopg2
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_db_connection():
    """Get PostgreSQL database connection."""
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    return psycopg2.connect(database_url)

def verify_author_handles():
    """Connects to the database and checks the distinct author_handles in the raw_tweets table."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            logger.info("Fetching distinct author handles from raw_tweets table...")
            cur.execute("SELECT DISTINCT author_handle, COUNT(*) FROM raw_tweets GROUP BY author_handle;")
            handles = cur.fetchall()
            
            if handles:
                logger.info("Found the following author handles:")
                for handle, count in handles:
                    logger.info(f"- Handle: '{handle}', Count: {count}")
            else:
                logger.warning("No author handles found in the raw_tweets table.")

    except Exception as e:
        logger.error(f"An error occurred: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()
            logger.info("Database connection closed.")

if __name__ == "__main__":
    verify_author_handles()
