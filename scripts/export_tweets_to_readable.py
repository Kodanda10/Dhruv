#!/usr/bin/env python3
"""
Export tweets from database to readable text file.
Updates data/fetched_tweets_readable.txt with all fetched tweets.
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
import json

sys.path.insert(0, str(Path(__file__).parent.parent))

load_dotenv(Path(__file__).parent.parent / '.env.local')

def export_tweets_to_readable():
    """Export all tweets from database to readable text file."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print('❌ DATABASE_URL not found')
        sys.exit(1)
    
    conn = psycopg2.connect(database_url)
    
    try:
        with conn.cursor() as cur:
            # Get all tweets ordered by created_at DESC (newest first)
            cur.execute('''
                SELECT 
                    tweet_id,
                    text,
                    created_at,
                    author_handle,
                    retweet_count,
                    like_count,
                    reply_count,
                    quote_count,
                    hashtags,
                    mentions,
                    urls,
                    processing_status
                FROM raw_tweets
                ORDER BY created_at DESC
            ''')
            
            tweets = cur.fetchall()
            
            if not tweets:
                print('⚠️  No tweets found in database')
                return
            
            # Prepare output
            output_lines = []
            output_lines.append('=' * 80)
            output_lines.append('FETCHED TWEETS - READABLE FORMAT')
            output_lines.append('=' * 80)
            output_lines.append('')
            output_lines.append(f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
            output_lines.append(f'Total Tweets: {len(tweets)}')
            output_lines.append('')
            output_lines.append('=' * 80)
            output_lines.append('')
            
            # Process each tweet
            for idx, tweet in enumerate(tweets, 1):
                tweet_id, text, created_at, author_handle, retweet_count, like_count, reply_count, quote_count, hashtags, mentions, urls, processing_status = tweet
                
                output_lines.append(f'Tweet #{idx}')
                output_lines.append('-' * 80)
                output_lines.append(f'ID: {tweet_id}')
                output_lines.append(f'Date: {created_at.strftime("%Y-%m-%d %H:%M:%S") if created_at else "N/A"}')
                output_lines.append(f'Author: @{author_handle or "unknown"}')
                output_lines.append(f'Status: {processing_status or "unknown"}')
                output_lines.append('')
                output_lines.append('Text:')
                output_lines.append(text or '(No text)')
                output_lines.append('')
                
                # Metrics
                if retweet_count or like_count or reply_count or quote_count:
                    output_lines.append('Metrics:')
                    if retweet_count:
                        output_lines.append(f'  Retweets: {retweet_count}')
                    if like_count:
                        output_lines.append(f'  Likes: {like_count}')
                    if reply_count:
                        output_lines.append(f'  Replies: {reply_count}')
                    if quote_count:
                        output_lines.append(f'  Quotes: {quote_count}')
                    output_lines.append('')
                
                # Hashtags
                if hashtags:
                    tags = hashtags if isinstance(hashtags, list) else json.loads(hashtags) if isinstance(hashtags, str) else []
                    if tags:
                        output_lines.append(f'Hashtags: {", ".join(tags)}')
                        output_lines.append('')
                
                # Mentions
                if mentions:
                    ments = mentions if isinstance(mentions, list) else json.loads(mentions) if isinstance(mentions, str) else []
                    if ments:
                        output_lines.append(f'Mentions: {", ".join(ments)}')
                        output_lines.append('')
                
                # URLs
                if urls:
                    url_list = urls if isinstance(urls, list) else json.loads(urls) if isinstance(urls, str) else []
                    if url_list:
                        output_lines.append('URLs:')
                        for url in url_list:
                            output_lines.append(f'  {url}')
                        output_lines.append('')
                
                output_lines.append('=' * 80)
                output_lines.append('')
            
            # Write to file
            output_file = Path(__file__).parent.parent / 'data' / 'fetched_tweets_readable.txt'
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(output_lines))
            
            print('=' * 80)
            print('✅ TWEETS EXPORTED TO READABLE FILE')
            print('=' * 80)
            print()
            print(f'📄 File: {output_file}')
            print(f'📊 Total tweets: {len(tweets)}')
            print(f'📅 Date range: {tweets[-1][2].strftime("%Y-%m-%d") if tweets[-1][2] else "N/A"} to {tweets[0][2].strftime("%Y-%m-%d") if tweets[0][2] else "N/A"}')
            print()
            print('=' * 80)
            
    except Exception as e:
        print(f'❌ Error exporting tweets: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    export_tweets_to_readable()


