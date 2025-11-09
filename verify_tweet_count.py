import os
import psycopg2
from dotenv import load_dotenv

def check_tweet_count():
    """
    Connects to the database specified in .env.local and counts the number
    of tweets from the author 'OPChoudhary_Ind' in the raw_tweets table.
    """
    try:
        # Load environment variables from .env.local
        load_dotenv('.env.local')
        database_url = os.getenv('DATABASE_URL')

        if not database_url:
            print("Error: DATABASE_URL not found in .env.local")
            return

        print(f"Connecting to the database...")

        # Connect to the database
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        print("Connection successful.")

        # Query to count tweets from the specific author
        query = "SELECT COUNT(*) FROM raw_tweets WHERE author_handle = 'OPChoudhary_Ind';"
        
        print(f"Executing query: {query}")
        cur.execute(query)
        
        # Fetch the result
        count = cur.fetchone()[0]
        
        print("\n--- Query Result ---")
        print(f"Total number of tweets from 'OPChoudhary_Ind': {count}")
        print("--------------------\n")

        if count > 2500:
            print("✅ Verification successful: The database contains more than 2500 tweets from the specified author.")
        else:
            print(f"⚠️ Verification failed: The database only contains {count} tweets from the specified author. This is likely the root cause of the issue.")

        # Close the connection
        cur.close()
        conn.close()

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    check_tweet_count()
