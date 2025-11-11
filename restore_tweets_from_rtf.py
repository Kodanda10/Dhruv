#!/usr/bin/env python3
"""
RTF Tweet Parser - Restore tweets from RTF export to database
"""
import re
import json
import psycopg2
from datetime import datetime
import os
from dotenv import load_dotenv

def parse_rtf_tweets(rtf_file_path):
    """Parse tweets from RTF export file"""
    tweets = []

    with open(rtf_file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Split content into tweet sections
    # Each tweet starts with "Tweet ID:" and ends before the next "Tweet ID:" or end of file
    tweet_sections = re.split(r'(?=Tweet ID:\s*\d+)', content)

    print(f"Found {len(tweet_sections)} potential tweet sections")

    for i, section in enumerate(tweet_sections):
        if not section.strip() or 'Tweet ID:' not in section:
            continue

        try:
            # Extract tweet ID
            id_match = re.search(r'Tweet ID:\s*(\d+)', section)
            if not id_match:
                continue
            tweet_id = id_match.group(1).strip()

            # Extract date (may be empty)
            date_match = re.search(r'Date:\s*([^\n]*)', section)
            tweet_date = date_match.group(1).strip() if date_match else ''

            # Extract event type
            event_match = re.search(r'Event Type:\s*([^\n]*)', section)
            event_type = event_match.group(1).strip() if event_match else ''

            # Extract confidence
            confidence_match = re.search(r'Confidence:\s*([^\n]*)', section)
            confidence = confidence_match.group(1).strip() if confidence_match else ''

            # Extract text (everything after "Text:" until next section or end)
            text_match = re.search(r'Text:\s*(.+?)(?=\nTweet ID:|\n-----------------------------------------------------------------------|\Z)', section, re.DOTALL)
            tweet_text = text_match.group(1).strip() if text_match else ''

            # Clean up the text (remove extra whitespace)
            tweet_text = re.sub(r'\n+', ' ', tweet_text).strip()

            tweet_data = {
                'id': tweet_id,
                'date': tweet_date,
                'event_type': event_type,
                'confidence': confidence,
                'text': tweet_text,
                'raw_data': section[:500]  # Store first 500 chars of raw section for debugging
            }

            tweets.append(tweet_data)

            if i < 3:  # Show first few tweets for verification
                print(f"Tweet {i+1}: ID={tweet_id}, Text='{tweet_text[:50]}...'")

        except Exception as e:
            print(f"Error parsing tweet section {i}: {e}")
            continue

    print(f"Successfully parsed {len(tweets)} tweets")
    return tweets

def restore_tweets_to_database(tweets, db_config):
    """Restore tweets to PostgreSQL database"""
    try:
        conn = psycopg2.connect(**db_config)
        cursor = conn.cursor()

        # Check current count
        cursor.execute("SELECT COUNT(*) FROM raw_tweets")
        initial_count = cursor.fetchone()[0]
        print(f"Initial tweet count in database: {initial_count}")

        # Insert tweets
        inserted = 0
        skipped = 0

        for tweet in tweets:
            try:
                # Check if tweet already exists
                cursor.execute("SELECT tweet_id FROM raw_tweets WHERE tweet_id = %s", (tweet['id'],))
                if cursor.fetchone():
                    skipped += 1
                    continue

                # Insert tweet
                cursor.execute("""
                    INSERT INTO raw_tweets (tweet_id, text, created_at, author_handle, processing_status)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    tweet['id'],
                    tweet['text'],
                    datetime.now(),  # Use current timestamp since date parsing is complex
                    'opchoudhary',  # Default author handle
                    'pending'  # Set status for reprocessing
                ))
                inserted += 1

            except Exception as e:
                print(f"Error inserting tweet {tweet['id']}: {e}")
                continue

        conn.commit()
        cursor.close()
        conn.close()

        print(f"Restoration complete: {inserted} tweets inserted, {skipped} tweets skipped (already exist)")
        return inserted, skipped

    except Exception as e:
        print(f"Database error: {e}")
        return 0, 0

def main():
    # Load environment variables
    load_dotenv()

    # Database configuration
    db_config = {
        'host': os.getenv('POSTGRES_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', '5432')),
        'database': os.getenv('POSTGRES_DATABASE', 'dhruv_db'),
        'user': os.getenv('POSTGRES_USER', 'dhruv_user'),
        'password': os.getenv('POSTGRES_PASSWORD', 'dhruv_pass')
    }

    rtf_file = 'database_tweets_readable.rtf'

    if not os.path.exists(rtf_file):
        print(f"RTF file not found: {rtf_file}")
        return

    print("Parsing RTF file...")
    tweets = parse_rtf_tweets(rtf_file)

    if not tweets:
        print("No tweets found in RTF file")
        return

    print(f"Found {len(tweets)} tweets to restore")

    # Ask for confirmation
    response = input(f"Restore {len(tweets)} tweets to database? (y/N): ")
    if response.lower() != 'y':
        print("Restoration cancelled")
        return

    print("Restoring tweets to database...")
    inserted, skipped = restore_tweets_to_database(tweets, db_config)

    print(f"Restoration summary:")
    print(f"  - Tweets parsed: {len(tweets)}")
    print(f"  - Tweets inserted: {inserted}")
    print(f"  - Tweets skipped: {skipped}")

if __name__ == "__main__":
    main()