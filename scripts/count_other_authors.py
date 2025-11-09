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

def count_tweets_from_other_authors():
    """Connects to the database and counts tweets from authors other than OPChoudhary_Ind."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            logger.info("Counting tweets from authors other than 'OPChoudhary_Ind'...")
            
            # Count total tweets
            cur.execute("SELECT COUNT(*) FROM raw_tweets;")
            total_count = cur.fetchone()[0]
            
            # Count tweets from OPChoudhary_Ind
            cur.execute("SELECT COUNT(*) FROM raw_tweets WHERE author_handle = 'OPChoudhary_Ind';")
            op_choudhary_count = cur.fetchone()[0]

            # Count tweets from other authors
            cur.execute("SELECT COUNT(*) FROM raw_tweets WHERE author_handle != 'OPChoudhary_Ind';")
            other_authors_count = cur.fetchone()[0]
            
            logger.info(f"Total tweets in database: {total_count}")
            logger.info(f"Tweets from 'OPChoudhary_Ind': {op_choudhary_count}")
            logger.info(f"Tweets from other authors: {other_authors_count}")

    except Exception as e:
        logger.error(f"An error occurred: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()
            logger.info("Database connection closed.")

if __name__ == "__main__":
    count_tweets_from_other_authors()
