#!/usr/bin/env python3
"""Test the fixed fetch with just 1 batch (100 tweets)"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import tweepy

load_dotenv(Path(__file__).parent / '.env.local')

bearer_token = os.getenv('X_BEARER_TOKEN')
client = tweepy.Client(bearer_token=bearer_token, wait_on_rate_limit=True)

# Get user
user = client.get_user(username='OPChoudhary_Ind')
print(f"User: @{user.data.username} (ID: {user.data.id})")
print()

# Fetch 1 batch
print("Fetching 100 tweets...")
response = client.get_users_tweets(
    id=user.data.id,
    max_results=100,
    exclude=['retweets'],
    tweet_fields=['created_at', 'public_metrics'],
)

if response.data:
    print(f"✅ Fetched {len(response.data)} tweets")
    print(f"Oldest: {response.data[-1].created_at}")
    print(f"Newest: {response.data[0].created_at}")
    print()
    
    # Check for pagination token
    if response.meta and 'next_token' in response.meta:
        print(f"✅ Has pagination token: {response.meta['next_token'][:30]}...")
        print("   Can fetch more tweets!")
    else:
        print("⚠️  No pagination token - this is all available tweets")
    
    print()
    print("Sample tweets:")
    for i, tweet in enumerate(response.data[:3], 1):
        print(f"\n{i}. {tweet.created_at}")
        print(f"   {tweet.text[:100]}...")
else:
    print("❌ No tweets found")

