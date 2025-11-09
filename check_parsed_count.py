import os
import psycopg2
from dotenv import load_dotenv

import os
import psycopg2
from dotenv import load_dotenv

def get_parsed_tweets_count():
    """Connects to the database and returns the number of rows in the parsed_events table."""
    
    # Construct the absolute path to the .env.local file
    # The script is in the project root, so we can build the path from there.
    project_root = os.path.dirname(os.path.abspath(__file__))
    dotenv_path = os.path.join(project_root, '.env.local')

    print(f"Attempting to load environment variables from: {dotenv_path}")
    
    if not os.path.exists(dotenv_path):
        print(f"Error: Environment file not found at {dotenv_path}")
        return 0

    load_dotenv(dotenv_path=dotenv_path)
    
    try:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            print("Error: DATABASE_URL not found in environment variables after loading the file.")
            return 0
            
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Check if the table exists before querying
        cursor.execute("SELECT to_regclass('public.parsed_events');")
        table_exists = cursor.fetchone()[0]

        if not table_exists:
            print("The 'parsed_events' table does not exist in the database.")
            count = 0
        else:
            cursor.execute("SELECT COUNT(*) FROM parsed_events;")
            count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return count
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        return 0

if __name__ == "__main__":
    count = get_parsed_tweets_count()
    print(f"Total number of parsed tweets: {count}")

if __name__ == "__main__":
    count = get_parsed_tweets_count()
    print(f"Total number of parsed tweets: {count}")
