#!/usr/bin/env python3
"""Diagnose Twitter API issues"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv
import tweepy

load_dotenv(Path(__file__).parent / '.env.local')

print("=" * 60)
print("TWITTER API DIAGNOSTICS")
print("=" * 60)
print()

# Check API credentials
bearer_token = os.getenv('X_BEARER_TOKEN')
if not bearer_token:
    print("❌ X_BEARER_TOKEN not found in .env.local")
    sys.exit(1)

print("✓ Bearer token found")
print()

try:
    # Initialize client
    client = tweepy.Client(
        bearer_token=bearer_token,
        wait_on_rate_limit=True,
    )
    
    # Get user info
    print("Step 1: Get user info for @OPChoudhary_Ind")
    print("-" * 60)
    user = client.get_user(username='OPChoudhary_Ind')
    
    if not user.data:
        print("❌ User not found")
        sys.exit(1)
    
    print(f"✓ User found:")
    print(f"  Name: {user.data.name}")
    print(f"  Username: @{user.data.username}")
    print(f"  ID: {user.data.id}")
    print()
    
    # Test 1: Fetch recent tweets (no filters)
    print("Step 2: Fetch 10 most recent tweets (no filters)")
    print("-" * 60)
    
    response = client.get_users_tweets(
        id=user.data.id,
        max_results=10,
        tweet_fields=['created_at', 'public_metrics', 'entities'],
        exclude=['retweets', 'replies'],  # Only original tweets
    )
    
    if not response.data:
        print("❌ No tweets found (even without filters)")
        print("\nPossible reasons:")
        print("1. Account has no original tweets (only retweets/replies)")
        print("2. Account is protected")
        print("3. API permissions issue")
        sys.exit(1)
    
    print(f"✓ Found {len(response.data)} tweets")
    print()
    print("Sample tweets:")
    for i, tweet in enumerate(response.data[:3], 1):
        print(f"\n{i}. {tweet.created_at}")
        print(f"   ID: {tweet.id}")
        print(f"   Text: {tweet.text[:80]}...")
        print(f"   Likes: {tweet.public_metrics['like_count']}")
    
    print()
    
    # Test 2: Fetch with date range
    print("Step 3: Test date range filtering")
    print("-" * 60)
    
    # Try fetching from Dec 2023
    start_date = datetime(2023, 12, 1, tzinfo=None)
    end_date = datetime(2024, 1, 1, tzinfo=None)
    
    print(f"Date range: {start_date.date()} to {end_date.date()}")
    
    response_dated = client.get_users_tweets(
        id=user.data.id,
        max_results=10,
        start_time=start_date,
        end_time=end_date,
        tweet_fields=['created_at', 'public_metrics'],
        exclude=['retweets', 'replies'],
    )
    
    if not response_dated.data:
        print("❌ No tweets found in Dec 2023")
        print("\nThis suggests:")
        print("1. User did not tweet in Dec 2023, OR")
        print("2. Date range filtering doesn't work with free tier")
        print()
        print("Solution: Fetch all tweets without date filter,")
        print("          then filter by date in database")
    else:
        print(f"✓ Found {len(response_dated.data)} tweets in Dec 2023")
    
    print()
    
    # Test 3: Check pagination token
    print("Step 4: Check pagination capability")
    print("-" * 60)
    
    if response.meta and 'next_token' in response.meta:
        print(f"✓ Pagination available (next_token: {response.meta['next_token'][:20]}...)")
        print("  Can fetch more tweets using pagination_token parameter")
    else:
        print("⚠️  No pagination token (either <10 tweets total, or API limitation)")
    
    print()
    print("=" * 60)
    print("DIAGNOSTICS COMPLETE")
    print("=" * 60)
    print()
    print("RECOMMENDED APPROACH:")
    print("1. Fetch ALL tweets without date filters")
    print("2. Use pagination_token to get all available tweets")
    print("3. Filter by date in database after fetching")
    print()
    
except tweepy.errors.Forbidden as e:
    print(f"❌ Forbidden Error: {e}")
    print("\nPossible reasons:")
    print("1. API credentials don't have required permissions")
    print("2. Account is protected")
    print("3. Free tier limitations")
    
except tweepy.errors.TooManyRequests as e:
    print(f"❌ Rate Limit Exceeded: {e}")
    print("\nWait 15 minutes before trying again")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

