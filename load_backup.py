import json
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

def load_parsed_events():
    # Connect to database
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cursor = conn.cursor()

    # Load backup data
    backup_file = 'data/parsed_events_backup.jsonl'
    count = 0
    errors = 0

    with open(backup_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            if line.strip():
                try:
                    data = json.loads(line.strip())

                    # Ensure arrays are properly formatted
                    locations = data.get('locations', [])
                    if not isinstance(locations, list):
                        locations = [locations] if locations else []

                    people = data.get('people_mentioned', [])
                    if not isinstance(people, list):
                        people = [people] if people else []

                    organizations = data.get('organizations', [])
                    if not isinstance(organizations, list):
                        organizations = [organizations] if organizations else []

                    schemes = data.get('schemes_mentioned', [])
                    if not isinstance(schemes, list):
                        schemes = [schemes] if schemes else []

                    cursor.execute('''
                        INSERT INTO parsed_events (
                            tweet_id, event_type, locations, people_mentioned,
                            organizations, schemes_mentioned, needs_review, review_status
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (tweet_id) DO NOTHING
                    ''', (
                        data['tweet_id'],
                        data.get('event_type'),
                        locations,
                        people,
                        organizations,
                        schemes,
                        True,
                        'pending'
                    ))
                    count += 1

                except Exception as e:
                    print(f'Error on line {line_num}: {e}')
                    errors += 1
                    continue

    conn.commit()
    cursor.close()
    conn.close()

    print(f'Successfully loaded {count} parsed events into database')
    if errors > 0:
        print(f'Encountered {errors} errors during loading')

if __name__ == "__main__":
    load_parsed_events()