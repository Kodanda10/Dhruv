import os
import sys
import psycopg2
from urllib.parse import urlparse

def execute_sql_file(file_path):
    """
    Executes the SQL commands from a given file.
    """
    try:
        db_url = os.environ.get('DATABASE_URL', 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db')
        
        # Parse the database URL
        result = urlparse(db_url)
        dbname = result.path[1:]
        user = result.username
        password = result.password
        host = result.hostname
        port = result.port

        conn = psycopg2.connect(
            dbname=dbname,
            user=user,
            password=password,
            host=host,
            port=port
        )
        
        conn.autocommit = True
        cursor = conn.cursor()

        with open(file_path, 'r') as f:
            sql_script = f.read()
            cursor.execute(sql_script)
            print(f"Successfully executed SQL script from {file_path}")

    except Exception as e:
        print(f"Error executing SQL script: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals() and conn is not None:
            conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python run_sql.py <path_to_sql_file>")
        sys.exit(1)
    
    sql_file = sys.argv[1]
    if not os.path.exists(sql_file):
        print(f"Error: File not found at {sql_file}")
        sys.exit(1)
        
    execute_sql_file(sql_file)
