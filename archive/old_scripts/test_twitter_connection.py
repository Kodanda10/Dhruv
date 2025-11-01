#!/usr/bin/env python3
"""Test Twitter API connection"""

import os
import sys
from pathlib import Path

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env.local')

print("=" * 60)
print("Twitter API Connection Test")
print("=" * 60)
print()

# Check if keys are present
keys = {
    'X_API_KEY': os.getenv('X_API_KEY'),
    'X_API_SECRET': os.getenv('X_API_SECRET'),
    'X_BEARER_TOKEN': os.getenv('X_BEARER_TOKEN'),
    'X_ACCESS_TOKEN': os.getenv('X_ACCESS_TOKEN'),
    'X_ACCESS_TOKEN_SECRET': os.getenv('X_ACCESS_TOKEN_SECRET'),
}

print("Checking environment variables:")
print("-" * 60)
all_present = True
for key, value in keys.items():
    if value and len(value) > 10:
        print(f"✓ {key}: Present ({len(value)} chars)")
    else:
        print(f"✗ {key}: MISSING")
        all_present = False
print()

if not all_present:
    print("❌ Some API keys are missing!")
    print("Please check .env.local and add all required keys.")
    sys.exit(1)

print("✓ All API keys are present!")
print()

# Test Twitter API connection
print("Testing Twitter API connection...")
print("-" * 60)

try:
    import tweepy
    
    # Initialize client
    client = tweepy.Client(
        bearer_token=keys['X_BEARER_TOKEN'],
        consumer_key=keys['X_API_KEY'],
        consumer_secret=keys['X_API_SECRET'],
        access_token=keys['X_ACCESS_TOKEN'],
        access_token_secret=keys['X_ACCESS_TOKEN_SECRET'],
        wait_on_rate_limit=True,
    )
    
    # Test: Get user info
    print("1. Testing user lookup...")
    user = client.get_user(username='OPChoudhary_Ind')
    if user.data:
        print(f"   ✓ Found user: @{user.data.username} (ID: {user.data.id})")
        print(f"   ✓ Name: {user.data.name}")
    else:
        print("   ✗ User not found")
        sys.exit(1)
    
    # Test: Fetch 5 tweets
    print("\n2. Testing tweet fetch...")
    tweets = client.get_users_tweets(
        id=user.data.id,
        max_results=5,
        tweet_fields=['created_at', 'public_metrics'],
    )
    
    if tweets.data:
        print(f"   ✓ Fetched {len(tweets.data)} tweets")
        print("\n   Sample tweet:")
        tweet = tweets.data[0]
        print(f"   - ID: {tweet.id}")
        print(f"   - Date: {tweet.created_at}")
        print(f"   - Text: {tweet.text[:100]}...")
        print(f"   - Likes: {tweet.public_metrics['like_count']}")
    else:
        print("   ✗ No tweets found")
        sys.exit(1)
    
    # Test: Rate limit status
    print("\n3. Checking rate limits...")
    # Note: get_rate_limit_status() is not available in Tweepy v4
    # Rate limits are handled automatically with wait_on_rate_limit=True
    print(f"   ✓ Rate limits handled automatically by Tweepy")
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    print("\nTwitter API is working correctly!")
    print("You can now fetch tweets using:")
    print("  python scripts/fetch_tweets.py --handle OPChoudhary_Ind --since 2023-12-01 --until 2025-10-31")
    
except tweepy.Unauthorized as e:
    print(f"\n❌ Authentication failed: {e}")
    print("Please check your API credentials in .env.local")
    sys.exit(1)
except tweepy.TooManyRequests as e:
    print(f"\n⚠️  Rate limit exceeded: {e}")
    print("Please wait 15 minutes and try again")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ Error: {e}")
    print(f"Error type: {type(e).__name__}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

