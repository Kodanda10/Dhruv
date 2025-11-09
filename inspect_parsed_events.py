import os
import json
import psycopg2
from dotenv import load_dotenv

def inspect_parsed_events():
    """Connects to the database and fetches all rows from the parsed_events table."""
    
    project_root = os.path.dirname(os.path.abspath(__file__))
    dotenv_path = os.path.join(project_root, '.env.local')

    if not os.path.exists(dotenv_path):
        print(f"Error: Environment file not found at {dotenv_path}")
        return

    load_dotenv(dotenv_path=dotenv_path)
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL not found in environment variables.")
        return

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        cursor.execute("SELECT to_regclass('public.parsed_events');")
        if cursor.fetchone()[0] is None:
            print("The 'parsed_events' table does not exist.")
            return

        cursor.execute("SELECT * FROM parsed_events;")
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        print(f"Found {len(rows)} rows in 'parsed_events' table.")
        print("-" * 30)
        
        if not rows:
            print("Table is empty.")
            return

        # Get column names from cursor description
        colnames = [desc[0] for desc in cursor.description]
        
        for i, row in enumerate(rows):
            print(f"--- Row {i+1} ---")
            row_dict = dict(zip(colnames, row))
            # Pretty print the JSON for readability
            print(json.dumps(row_dict, indent=2, default=str))

    except psycopg2.Error as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    inspect_parsed_events()
