import os
import re
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
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    
    return psycopg2.connect(database_url)

def create_tweets_table(conn):
    """Create tweets table if it doesn't exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS raw_tweets (
                tweet_id VARCHAR PRIMARY KEY,
                author_id VARCHAR NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMP,
                media_urls TEXT[],
                hashtags TEXT[],
                mentions TEXT[],
                urls TEXT[],
                retweet_count INT DEFAULT 0,
                like_count INT DEFAULT 0,
                reply_count INT DEFAULT 0,
                quote_count INT DEFAULT 0,
                fetched_at TIMESTAMP DEFAULT NOW(),
                processing_status VARCHAR DEFAULT 'pending'
            );
        """)
        # Add author_handle, tweet_url, and author_id columns if they don't exist
        try:
            cur.execute("ALTER TABLE raw_tweets ADD COLUMN IF NOT EXISTS author_id VARCHAR;")
        except psycopg2.errors.DuplicateColumn:
            pass # Column already exists
        try:
            cur.execute("ALTER TABLE raw_tweets ADD COLUMN IF NOT EXISTS author_handle VARCHAR;")
        except psycopg2.errors.DuplicateColumn:
            pass # Column already exists
        try:
            cur.execute("ALTER TABLE raw_tweets ADD COLUMN IF NOT EXISTS tweet_url TEXT;")
        except psycopg2.errors.DuplicateColumn:
            pass # Column already exists
        conn.commit()
        logger.info('Tweets table ready')

def insert_tweets(conn, tweets: list):
    """Insert tweets into database, handling errors individually."""
    success_count = 0
    for tweet in tweets:
        try:
            with conn.cursor() as cur:
                # Insert tweet and update on conflict
                cur.execute("""
                    INSERT INTO raw_tweets (
                        tweet_id, author_id, text, created_at, author_handle, tweet_url, processing_status
                    ) VALUES (%s, %s, %s, %s, %s, %s, 'pending')
                    ON CONFLICT (tweet_id) DO UPDATE SET
                        text = EXCLUDED.text,
                        author_handle = EXCLUDED.author_handle,
                        tweet_url = EXCLUDED.tweet_url,
                        processing_status = 'pending';
                """, (
                    tweet['id'],
                    tweet['author_id'],
                    tweet['text'],
                    tweet['created_at'],
                    tweet['author_handle'],
                    tweet['tweet_url'],
                ))
            conn.commit()
            success_count += 1
        except psycopg2.Error as e:
            logger.error(f'Error inserting tweet {tweet["id"]}: {e}')
            conn.rollback() # Rollback the failed transaction
    
    logger.info(f'Successfully inserted or updated {success_count}/{len(tweets)} tweets.')

def parse_txt_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    tweet_blocks = content.split('================================================================================')

    tweets = []
    for block in tweet_blocks:
        block = block.strip()
        if not block.startswith('Tweet #'):
            continue

        tweet_id_match = re.search(r"ID:\s*([\d\w]+)", block)
        tweet_id = tweet_id_match.group(1) if tweet_id_match else None

        date_match = re.search(r"Date:\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})", block)
        created_at = date_match.group(1) if date_match else None

        author_match = re.search(r"Author:\s*@([\w_]+)", block)
        author_handle = author_match.group(1) if author_match else 'OPChoudhary_Ind'
        author_id = author_handle # Using handle as author_id for now

        text_match = re.search(r"Text:\n(.*?)\n\nMetrics:", block, re.DOTALL)
        text = text_match.group(1).strip() if text_match else ''

        if not tweet_id or not text:
            continue
            
        tweet_url = f"https://twitter.com/{author_handle}/status/{tweet_id}"

        tweets.append({
            'id': tweet_id,
            'text': text,
            'created_at': created_at,
            'author_id': author_id,
            'author_handle': author_handle,
            'tweet_url': tweet_url
        })

    return tweets

def main():
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

    txt_file_path = '/Users/abhijita/Downloads/fetched_tweets_readable.txt'
    
    logger.info(f"Parsing TXT file: {txt_file_path}")
    tweets = parse_txt_file(txt_file_path)
    logger.info(f"Successfully parsed {len(tweets)} tweets.")

    if not tweets:
        logger.warning("No tweets were parsed. Exiting.")
        return

    try:
        # Get database connection
        conn = get_db_connection()
        
        # Create table if needed
        create_tweets_table(conn)
        
        # Insert tweets
        insert_tweets(conn, tweets)
        
        # Close connection
        conn.close()
        
        logger.info(f'✅ Successfully ingested data from RTF file.')
        
    except Exception as e:
        logger.error(f'❌ Error during database operation: {str(e)}')

if __name__ == "__main__":
    main()

