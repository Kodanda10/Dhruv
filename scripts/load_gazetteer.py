import json
import os
import sys
import psycopg2
from urllib.parse import urlparse
import re
import uuid

def load_gazetteer_data_from_string(json_string_content):
    """
    Loads geographical data from a JSON string into the 'locations' table.
    """
    try:
        # Strip leading/trailing whitespace and newlines from the content
        stripped_content = json_string_content.strip()

        # Use regex to extract JSON content, looking for the first { and last }
        match = re.search(r'(\{.*\})', stripped_content, re.DOTALL)
        if match:
            json_string = match.group(1)
        else:
            # If no JSON object found, assume raw content is JSON (though this case should be rare now)
            json_string = stripped_content
        
        data = json.loads(json_string)

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
        INSERT INTO locations (id, name_hindi, name_english, type, state, district, block)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING;
        """
        locations_to_insert = []

        state_name = data.get("state", "Unknown State")

        # Insert State
        state_id = f"CG_STATE_{state_name.replace(' ', '_')}"
        locations_to_insert.append((state_id, state_name, state_name, 'state', state_name, None, None))

        for district in data.get("districts", []):
            district_name = district.get("name")
            district_id = f"CG_DISTRICT_{district_name.replace(' ', '_')}"
            locations_to_insert.append((district_id, district_name, district_name, 'district', state_name, district_name, None))

            for ac in district.get("acs", []):
                for block in ac.get("blocks", []):
                    block_name = block.get("name")
                    block_id = f"CG_BLOCK_{block_name.replace(' ', '_')}_{district_name.replace(' ', '_')}"
                    locations_to_insert.append((block_id, block_name, block_name, 'block', state_name, district_name, block_name))

                    for gp in block.get("gps", []):
                        for village in gp.get("villages", []):
                            village_name = village.get("name")
                            # Create a more robust unique ID for villages
                            village_id = f"CG_VILLAGE_{village_name.replace(' ', '_')}_{block_name.replace(' ', '_')}_{district_name.replace(' ', '_')}"
                            locations_to_insert.append((village_id, village_name, village_name, 'village', state_name, district_name, block_name))
        
        # Execute batch insertion
        cursor.executemany(insert_query, locations_to_insert)
        conn.commit()
        print(f"Successfully loaded {len(locations_to_insert)} locations into the gazetteer.")

    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format in provided content: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error loading gazetteer data: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals() and conn is not None:
            conn.close()

if __name__ == "__main__":
    if not sys.stdin.isatty():
        # Read from stdin if content is piped
        json_content = sys.stdin.read()
        load_gazetteer_data_from_string(json_content)
    else:
        # Fallback to file path if no stdin (for direct file usage)
        if len(sys.argv) != 2:
            print("Usage: cat <path_to_json_file> | python load_gazetteer.py")
            print("Or: python load_gazetteer.py <path_to_json_file>")
            sys.exit(1)
        
        json_file = sys.argv[1]
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                json_content = f.read()
            load_gazetteer_data_from_string(json_content)
        except FileNotFoundError:
            print(f"Error: JSON file not found at {json_file}")
            sys.exit(1)
