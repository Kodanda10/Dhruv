#!/usr/bin/env python3
"""
Test backward pagination to understand how to fetch older tweets
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import tweepy

load_dotenv(Path(__file__).parent.parent / '.env.local')

bearer_token = os.getenv('X_BEARER_TOKEN')
if not bearer_token:
    print("❌ X_BEARER_TOKEN not found")
    sys.exit(1)

client = tweepy.Client(
    bearer_token=bearer_token,
    wait_on_rate_limit=True,
)

# Get user
user = client.get_user(username='OPChoudhary_Ind')
user_id = user.data.id
print(f"User ID: {user_id}")
print()

# Test 1: Fetch without until_id (should get newest tweets)
print("Test 1: Fetch newest tweets (no until_id)")
print("-" * 60)
response1 = client.get_users_tweets(
    id=user_id,
    max_results=5,
    exclude=['retweets'],
    tweet_fields=['created_at', 'id'],
)
if response1.data:
    print(f"Found {len(response1.data)} tweets")
    for tweet in response1.data:
        print(f"  ID: {tweet.id}, Date: {tweet.created_at}")
    print(f"Next token available: {'next_token' in (response1.meta or {})}")
    if response1.meta and 'next_token' in response1.meta:
        next_token = response1.meta['next_token']
        print(f"Next token: {next_token[:50]}...")
else:
    print("No tweets found")
print()

# Test 2: Use pagination_token to get older tweets
print("Test 2: Use pagination_token to get older tweets")
print("-" * 60)
if response1.meta and 'next_token' in response1.meta:
    next_token = response1.meta['next_token']
    response2 = client.get_users_tweets(
        id=user_id,
        max_results=5,
        exclude=['retweets'],
        tweet_fields=['created_at', 'id'],
        pagination_token=next_token,
    )
    if response2.data:
        print(f"Found {len(response2.data)} older tweets")
        for tweet in response2.data:
            print(f"  ID: {tweet.id}, Date: {tweet.created_at}")
    else:
        print("No older tweets found with pagination_token")
else:
    print("No pagination token available")
print()

# Test 3: Try until_id with a known tweet ID
print("Test 3: Try until_id with oldest tweet ID we have")
print("-" * 60)
oldest_id = "1890378865639407799"
response3 = client.get_users_tweets(
    id=user_id,
    max_results=5,
    exclude=['retweets'],
    tweet_fields=['created_at', 'id'],
    until_id=oldest_id,
)
if response3.data:
    print(f"Found {len(response3.data)} tweets older than {oldest_id}")
    for tweet in response3.data:
        print(f"  ID: {tweet.id}, Date: {tweet.created_at}")
else:
    print(f"No tweets found older than {oldest_id}")
    print("This might mean:")
    print("  1. No tweets exist before this ID")
    print("  2. until_id doesn't work for backward pagination")
    print("  3. Need to use pagination_token instead")
print()

print("=" * 60)
print("CONCLUSION:")
print("To fetch older tweets, we should use pagination_token")
print("until_id may not work for backward fetching")
print("=" * 60)

