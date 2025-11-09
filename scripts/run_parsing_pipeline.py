import os
import re
import json
import time
import logging
import psycopg2
import requests
from dotenv import load_dotenv
from collections import Counter

# --- Basic Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

import google.generativeai as genai

# --- Constants ---
GEMINI_REQUEST_DELAY_SECONDS = 2
OLLAMA_REQUEST_DELAY_SECONDS = 0

COMPREHENSIVE_PROMPT = """
Analyze the following tweet text from India, which is likely in Hindi or a mix of Hindi and English.
Extract the specified entities and provide the output as a single, clean JSON object.

**JSON Schema to follow:**
{{
  "event_type": "string",
  "locations": ["string"],
  "people_mentioned": ["string"],
  "organizations": ["string"],
  "schemes_mentioned": ["string"]
}}

**Instructions:**
1.  **event_type**: Classify the main event. Must be one of: 'Protest', 'Rally', 'Meeting', 'Public Address', 'Cultural Event', 'Inauguration', 'Condolence', 'Birthday Wishes', 'Scheme Announcement', 'Inspection', 'Other'. If uncertain, use 'Unknown'.
2.  **locations**: Extract all city, district, or state names. Return as a JSON list of strings. If none, return an empty list [].
3.  **people_mentioned**: Extract all names of people, often preceded by titles like 'श्री', 'श्रीमती', or 'माननीय'. Return as a JSON list of strings. If none, return an empty list [].
4.  **organizations**: Extract names of political parties, government bodies, or companies (e.g., 'भारतीय जनता पार्टी', 'कांग्रेस', 'सरकार'). Return as a JSON list of strings. If none, return an empty list [].
5.  **schemes_mentioned**: Extract names of government schemes (e.g., 'प्रधानमंत्री आवास योजना'). Return as a JSON list of strings. If none, return an empty list [].

**Tweet Text:**
"{text}"

**JSON Output:**
"""

# --- Global Parser Instances ---
gemini_model = None

def initialize_parsers():
    """Initializes API-based parsers like Gemini."""
    global gemini_model
    try:
        gemini_api_key = os.getenv('GEMINI_API_KEY')
        if not gemini_api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables.")
        genai.configure(api_key=gemini_api_key)
        gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        logger.info("Gemini parser initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini parser: {e}")
        gemini_model = None

def parse_with_gemini(text):
    """Layer 1: Parses text using the Gemini API with a comprehensive prompt."""
    if not gemini_model:
        logger.error("Gemini model not initialized. Skipping parse.")
        return {}

    logger.info("Parsing with Gemini...")
    time.sleep(GEMINI_REQUEST_DELAY_SECONDS)
    
    prompt = COMPREHENSIVE_PROMPT.format(text=text)
    
    try:
        response = gemini_model.generate_content(prompt)
        # Clean up the response to get a valid JSON string
        json_string = response.text.strip().replace('`', '').replace('json', '').strip()
        return json.loads(json_string)
    except Exception as e:
        logger.error(f"Error during Gemini parsing: {e}")
        return {}

# --- Database Functions ---

def get_db_connection():
    """Gets a connection to the PostgreSQL database."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set.")
    return psycopg2.connect(database_url)

def create_parsed_events_table(conn):
    """
    Ensures the parsed_events table exists with the correct schema.
    This is now destructive in test_mode to ensure a clean slate.
    """
    with conn.cursor() as cur:
        # In test mode, we drop the table to ensure the schema is always correct.
        # In a real production environment, a proper migration tool should be used.
        logger.info("Dropping parsed_events table to ensure clean schema...")
        cur.execute("DROP TABLE IF EXISTS parsed_events CASCADE;")

        logger.info("Creating parsed_events table with correct schema...")
        cur.execute("""
            CREATE TABLE parsed_events (
                id SERIAL PRIMARY KEY,
                tweet_id VARCHAR(255) UNIQUE NOT NULL,
                event_type VARCHAR(255),
                event_type_confidence FLOAT,
                event_date TIMESTAMP,
                date_confidence FLOAT,
                locations TEXT[],
                people_mentioned TEXT[],
                organizations TEXT[],
                schemes_mentioned TEXT[],
                overall_confidence FLOAT,
                needs_review BOOLEAN DEFAULT true,
                review_status VARCHAR(50) DEFAULT 'pending',
                reviewed_at TIMESTAMP,
                reviewed_by VARCHAR(255),
                parsed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                parsed_by VARCHAR(255) DEFAULT 'parsing_pipeline_v2',
                FOREIGN KEY (tweet_id) REFERENCES raw_tweets(tweet_id)
            );
        """)
    conn.commit()
    logger.info("`parsed_events` table is ready.")

def fetch_unprocessed_tweets(conn, batch_size=20):
    """
    Fetches a batch of raw tweets that haven't been parsed yet.
    It also marks them as 'in_progress' to prevent other workers from picking them up.
    """
    with conn.cursor() as cur:
        # First, select a batch of 'pending' tweets
        cur.execute("""
            SELECT tweet_id, text 
            FROM raw_tweets 
            WHERE processing_status = 'pending'
            ORDER BY created_at ASC
            LIMIT %s;
        """, (batch_size,))
        tweets = cur.fetchall()
        
        if not tweets:
            return []

        # Next, mark these specific tweets as 'in_progress'
        tweet_ids = [t[0] for t in tweets]
        cur.execute("""
            UPDATE raw_tweets
            SET processing_status = 'in_progress'
            WHERE tweet_id = ANY(%s);
        """, (tweet_ids,))
        conn.commit()
        
        logger.info(f"Fetched and locked {len(tweets)} tweets for processing.")
        return tweets

def save_parsed_event(conn, parsed_data):
    """Saves a single parsed event to the parsed_events table, including new fields."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO parsed_events (
                tweet_id,
                event_type,
                locations,
                people_mentioned,
                organizations,
                schemes_mentioned,
                parsed_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (tweet_id) DO UPDATE SET
                event_type = EXCLUDED.event_type,
                locations = EXCLUDED.locations,
                people_mentioned = EXCLUDED.people_mentioned,
                organizations = EXCLUDED.organizations,
                schemes_mentioned = EXCLUDED.schemes_mentioned,
                parsed_at = CURRENT_TIMESTAMP,
                parsed_by = EXCLUDED.parsed_by,
                review_status = 'pending';
        """, (
            parsed_data['tweet_id'],
            parsed_data.get('event_type'),
            parsed_data.get('locations', []),
            parsed_data.get('people_mentioned', []),
            parsed_data.get('organizations', []),
            parsed_data.get('schemes_mentioned', []),
            'parsing_pipeline_v2'  # Version bump
        ))
    conn.commit()
    logger.info(f"Saved parsed event for tweet_id: {parsed_data['tweet_id']}")

def update_tweet_status(conn, tweet_id, status):
    """Updates the processing status of a raw tweet."""
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE raw_tweets 
            SET processing_status = %s 
            WHERE tweet_id = %s;
        """, (status, tweet_id))
    conn.commit()

# --- Parsing Layers ---

def parse_with_gemini(text):
    """Layer 1: Parses text using Gemini API (Placeholder)."""
    logger.info("Parsing with Gemini...")
    time.sleep(GEMINI_REQUEST_DELAY_SECONDS)
    # Placeholder: In a real scenario, this would call the Gemini API
    return {"event_type": "Protest", "location": "Raipur"}

def parse_with_ollama(text):
    """Layer 2: Parses text using a local Ollama model with a comprehensive prompt."""
    logger.info("Parsing with Ollama...")
    time.sleep(OLLAMA_REQUEST_DELAY_SECONDS)
    
    prompt = COMPREHENSIVE_PROMPT.format(text=text)

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "gemma2:2b",
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=30
        )
        response.raise_for_status()
        
        response_data = response.json()
        json_string = response_data.get("response", "{}")
        
        return json.loads(json_string)

    except requests.exceptions.RequestException as e:
        logger.error(f"Error during Ollama parsing (request failed): {e}")
        return {}
    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JSON from Ollama response: {e}")
        return {}
    except Exception as e:
        logger.error(f"An unexpected error occurred during Ollama parsing: {e}")
        return {}

def parse_with_regex(text):
    """Layer 3: Parses text using regular expressions."""
    logger.info("Parsing with Regex...")
    
    # Simple patterns for event types and locations
    # This is a basic example and can be expanded significantly.
    event_patterns = {
        'Protest': r'\b(protest|demonstration|strike|dharna)\b',
        'Rally': r'\b(rally|march|procession)\b',
        'Meeting': r'\b(meeting|conference|sabha)\b',
        'Public Address': r'\b(address|speech)\b',
    }
    
    location_patterns = [
        r'in (\w+)',
        r'at (\w+)',
        r'near (\w+)',
    ]

    event_type = "Unknown"
    location = "Unknown"

    # Find event type
    for event, pattern in event_patterns.items():
        if re.search(pattern, text, re.IGNORECASE):
            event_type = event
            break

    # Find location
    for pattern in location_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            # We can add more logic here to filter out non-location words
            location = match.group(1).capitalize()
            break
            
    return {"event_type": event_type, "location": location}

# --- Consensus Logic ---

def get_consensus(results):
    """
    Takes a list of parsing results and finds a consensus.
    - For string values, it requires a 2/3 majority.
    - For list values, it combines all unique items from all parsers.
    """
    consensus_result = {}
    if not results:
        return consensus_result

    all_keys = set(key for res in results for key in res.keys())

    for key in all_keys:
        values = [res.get(key) for res in results if res.get(key) is not None]
        if not values:
            continue

        # Check if the values are lists (e.g., for locations, people)
        if isinstance(values[0], list):
            # For lists, combine all unique items from all parsers
            combined_list = set()
            for v_list in values:
                if isinstance(v_list, list):
                    for item in v_list:
                        combined_list.add(item)
            consensus_result[key] = list(combined_list)
        else:
            # For string values (like event_type), find the most common
            value_counts = Counter(values)
            most_common = value_counts.most_common(1)[0]
            
            # Check for 2/3 majority
            if most_common[1] >= 2:
                consensus_result[key] = most_common[0]
            else:
                consensus_result[key] = "Uncertain"
            
    return consensus_result

# --- Main Pipeline ---

def run_pipeline(test_mode=False):
    """Main function to run the entire parsing pipeline."""
    logger.info("Starting parsing pipeline...")
    
    # Initialize API-based parsers
    initialize_parsers()

    total_processed_count = 0
    total_failed_count = 0
    
    try:
        conn = get_db_connection()
        create_parsed_events_table(conn)

        batch_size = 3 if test_mode else 20
        
        while True:
            tweets_to_process = fetch_unprocessed_tweets(conn, batch_size=batch_size)
            
            if not tweets_to_process:
                logger.info("No new tweets to process. Pipeline finished.")
                break

            logger.info(f"--- Processing batch of {len(tweets_to_process)} tweets ---")
            
            for tweet_id, text in tweets_to_process:
                try:
                    logger.info(f"Processing tweet_id: {tweet_id}")
                    
                    gemini_result = parse_with_gemini(text)
                    ollama_result = parse_with_ollama(text)
                    regex_result = parse_with_regex(text)
                    
                    final_result = get_consensus([gemini_result, ollama_result, regex_result])
                    logger.info(f"Consensus result: {final_result}")
                    
                    parsed_data = {"tweet_id": tweet_id, **final_result}
                    
                    save_parsed_event(conn, parsed_data)
                    update_tweet_status(conn, tweet_id, 'processed')
                    
                    logger.info(f"Successfully processed and saved tweet_id: {tweet_id}")
                    total_processed_count += 1

                except Exception as e:
                    logger.error(f"Error processing tweet {tweet_id}: {e}")
                    update_tweet_status(conn, tweet_id, 'failed')
                    total_failed_count += 1
            
            if test_mode:
                logger.info("Test mode complete. Exiting after one batch.")
                break

    except Exception as e:
        logger.critical(f"A critical error occurred in the pipeline: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()
            logger.info("Database connection closed.")
        
        logger.info("--- Pipeline Run Summary ---")
        logger.info(f"Successfully processed: {total_processed_count} tweets")
        logger.info(f"Failed to process: {total_failed_count} tweets")
        logger.info("--------------------------")

if __name__ == "__main__":
    # To run in test mode: python scripts/run_parsing_pipeline.py --test
    import argparse
    parser = argparse.ArgumentParser(description="Run the 3-layer parsing pipeline.")
    parser.add_argument('--test', action='store_true', help='Run in test mode on a small sample of tweets.')
    args = parser.parse_args()
    
    run_pipeline(test_mode=args.test)
