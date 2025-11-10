#!/usr/bin/env python3
"""
TEST: Fetch tweets using start_time and end_time to get older tweets directly
This tests if we can skip pagination and fetch directly from date range
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import tweepy

load_dotenv(Path(__file__).parent.parent / '.env.local')

bearer_token = os.getenv('X_BEARER_TOKEN')
if not bearer_token:
    print("❌ X_BEARER_TOKEN not found")
    sys.exit(1)

client = tweepy.Client(
    bearer_token=bearer_token,
    wait_on_rate_limit=False,  # Don't auto-wait for testing
)

# Get user
user = client.get_user(username='OPChoudhary_Ind')
user_id = user.data.id
print(f"User ID: {user_id}")
print()

# Test: Fetch tweets from BEFORE 2025-02-14 (our oldest date)
# Try fetching from 2025-01-01 to 2025-02-13 (just before our oldest)
print("=" * 60)
print("TEST: Fetch tweets using start_time and end_time")
print("=" * 60)
print()
print("Target: Fetch tweets from 2025-01-01 to 2025-02-13")
print("(Just before our oldest tweet date: 2025-02-14)")
print()

start_time = datetime(2025, 1, 1)
end_time = datetime(2025, 2, 13, 23, 59, 59)

try:
    print(f"Requesting tweets with:")
    print(f"  start_time: {start_time}")
    print(f"  end_time: {end_time}")
    print(f"  max_results: 10 (minimal)")
    print()
    
    response = client.get_users_tweets(
        id=user_id,
        max_results=10,
        start_time=start_time,
        end_time=end_time,
        exclude=['retweets'],
        tweet_fields=['created_at', 'id'],
    )
    
    if response.data:
        print(f"✅ SUCCESS! Found {len(response.data)} tweets in date range")
        print()
        print("Tweets found:")
        for i, tweet in enumerate(response.data, 1):
            print(f"  {i}. ID: {tweet.id}")
            print(f"     Date: {tweet.created_at}")
        print()
        print("CONCLUSION:")
        print("✅ Date range filtering WORKS!")
        print("   We CAN fetch tweets directly from before 2025-02-14")
        print("   No need to paginate through newer tweets!")
    else:
        print("❌ No tweets found in date range")
        print()
        print("Possible reasons:")
        print("1. No tweets in that date range")
        print("2. Date filtering not supported on free tier")
        print("3. API limitation")
        print()
        print("Let's try a wider range...")
        
        # Try wider range
        start_time_wide = datetime(2024, 1, 1)
        end_time_wide = datetime(2025, 2, 13, 23, 59, 59)
        
        print(f"Trying wider range: {start_time_wide.date()} to {end_time_wide.date()}")
        response2 = client.get_users_tweets(
            id=user_id,
            max_results=10,
            start_time=start_time_wide,
            end_time=end_time_wide,
            exclude=['retweets'],
            tweet_fields=['created_at', 'id'],
        )
        
        if response2.data:
            print(f"✅ Found {len(response2.data)} tweets in wider range")
            for tweet in response2.data:
                print(f"  - {tweet.created_at}: {tweet.id}")
            print()
            print("CONCLUSION: Date filtering works with wider ranges")
        else:
            print("❌ Still no tweets - date filtering may not work on free tier")
            
except tweepy.TooManyRequests:
    print("❌ Rate limit exceeded - wait before testing")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 60)

