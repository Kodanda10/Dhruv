import os
import psycopg2
from dotenv import load_dotenv

def list_all_tables():
    """Connects to the database and lists all tables in the public schema."""
    
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
        
        # Query to get all table names in the public schema
        cursor.execute("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename;
        """)
        
        tables = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        if not tables:
            print("No tables found in the 'public' schema.")
            return

        print("Tables found in the 'public' schema:")
        for table in tables:
            print(f"- {table[0]}")

    except psycopg2.Error as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    list_all_tables()
