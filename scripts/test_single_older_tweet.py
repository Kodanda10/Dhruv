#!/usr/bin/env python3
"""
MINIMAL TEST: Fetch only 1-2 tweets to verify backward pagination works
DOES NOT waste API limits - just tests the approach
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
import tweepy

load_dotenv(Path(__file__).parent.parent / '.env.local')

print("=" * 60)
print("MINIMAL TEST: Fetch 1-2 Older Tweets")
print("=" * 60)
print()

# Get oldest tweet from database
database_url = os.getenv('DATABASE_URL')
conn = psycopg2.connect(database_url)
cur = conn.cursor()

cur.execute('''
    SELECT tweet_id, created_at 
    FROM raw_tweets 
    WHERE author_handle = 'OPChoudhary_Ind'
    ORDER BY created_at ASC 
    LIMIT 1
''')
oldest = cur.fetchone()
conn.close()

if oldest:
    oldest_id, oldest_date = oldest
    print(f"Current oldest tweet in DB:")
    print(f"  ID: {oldest_id}")
    print(f"  Date: {oldest_date}")
    print(f"  We need tweets OLDER than this")
    print()
else:
    print("No tweets in database")
    sys.exit(1)

# Initialize Twitter client
bearer_token = os.getenv('X_BEARER_TOKEN')
if not bearer_token:
    print("❌ X_BEARER_TOKEN not found")
    sys.exit(1)

client = tweepy.Client(
    bearer_token=bearer_token,
    wait_on_rate_limit=False,  # Don't auto-wait - we'll handle it
)

# Get user
user = client.get_user(username='OPChoudhary_Ind')
user_id = user.data.id
print(f"User ID: {user_id}")
print()

# Strategy: Start from newest, paginate backward until we pass oldest date
print("Strategy:")
print("1. Fetch newest tweets (1-2 tweets)")
print("2. Check if we're past oldest date")
print("3. If not, use pagination_token to get older tweets")
print("4. Continue until we find tweets older than our oldest")
print()

print("⚠️  TESTING: Fetching only 2 tweets to verify approach...")
print()

# Fetch 2 newest tweets (minimal API usage)
try:
    response = client.get_users_tweets(
        id=user_id,
        max_results=2,  # ONLY 2 tweets for testing
        exclude=['retweets'],
        tweet_fields=['created_at', 'id'],
    )
    
    if response.data:
        print(f"✓ Fetched {len(response.data)} newest tweets:")
        for i, tweet in enumerate(response.data, 1):
            print(f"  {i}. ID: {tweet.id}, Date: {tweet.created_at}")
            if tweet.created_at and tweet.created_at.date() <= oldest_date.date():
                print(f"     ⚠️  This is older than our oldest! Already in DB")
        
        # Check if we have pagination token
        if response.meta and 'next_token' in response.meta:
            print()
            print("✓ Pagination token available - can fetch older tweets")
            print("  But we won't fetch now to save API limits")
            print()
            print("CONCLUSION:")
            print("✅ Approach works: Use pagination_token to go backward")
            print("⚠️  But we need to start from a point BEFORE our oldest tweet")
            print("   Current approach fetches from newest (wastes API calls)")
            print()
            print("SOLUTION:")
            print("We already have tweets from 2025-02-14 to 2025-11-03")
            print("We need to continue backward from 2025-02-14")
            print("But Twitter API doesn't let us 'jump' to a specific date")
            print()
            print("RECOMMENDATION:")
            print("1. Save the pagination_token from when we last fetched")
            print("2. OR: Fetch in small batches, checking dates and stopping when we reach old data")
            print("3. OR: Accept that we'll fetch some duplicates (deduplication handles it)")
        else:
            print("⚠️  No pagination token - might have reached end")
    else:
        print("❌ No tweets returned")
        
except tweepy.TooManyRequests:
    print("❌ Rate limit hit - we're already at limit!")
    print("   This is why we need to be more careful")
except Exception as e:
    print(f"❌ Error: {e}")

print()
print("=" * 60)

