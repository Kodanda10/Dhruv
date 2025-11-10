import json
import os
import sys
import psycopg2
from urllib.parse import urlparse

def load_event_types_data(json_file_path):
    """
    Loads event type data from a JSON file into the 'event_types' table.
    """
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        db_url = os.environ.get('DATABASE_URL', 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db')
        
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
        print(f"Connected to database: {db_url}")
        conn.autocommit = True
        cursor = conn.cursor()

        # Prepare for batch insertion
        insert_query = """
        INSERT INTO event_types (id, name_hindi, name_english, description_hindi, description_english, category)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING;
        """
        event_types_to_insert = []

        for event_type in data:
            event_types_to_insert.append((
                event_type.get("id"),
                event_type.get("name_hindi"),
                event_type.get("name_english"),
                event_type.get("description_hindi"),
                event_type.get("description_english"),
                event_type.get("category")
            ))
        
        cursor.executemany(insert_query, event_types_to_insert)
        conn.commit()
        print(f"Successfully loaded {len(event_types_to_insert)} event types into the gazetteer.")

    except FileNotFoundError:
        print(f"Error: JSON file not found at {json_file_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in {json_file_path}: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error loading event types data: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals() and conn is not None:
            conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python load_event_types.py <path_to_json_file>")
        sys.exit(1)
    
    json_file = sys.argv[1]
    load_event_types_data(json_file)
