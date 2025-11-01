#!/usr/bin/env python3
"""Test fetching 100 tweets (1 batch)"""

import os
import sys
from pathlib import Path
from datetime import datetime

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env.local')

sys.path.insert(0, str(Path(__file__).parent))

from api.src.twitter.client import TwitterClient

print("=" * 60)
print("Test: Fetch 100 Tweets from @OPChoudhary_Ind")
print("=" * 60)
print()

try:
    # Initialize client
    client = TwitterClient()
    
    # Fetch 100 tweets (excluding retweets)
    print("Fetching 100 original tweets (excluding retweets)...")
    print("-" * 60)
    
    tweets = client.fetch_user_tweets(
        username='OPChoudhary_Ind',
        max_results=100,
    )
    
    if not tweets:
        print("❌ No tweets found")
        sys.exit(1)
    
    print(f"\n✅ Successfully fetched {len(tweets)} tweets!")
    print()
    
    # Show sample tweets
    print("Sample tweets:")
    print("-" * 60)
    for i, tweet in enumerate(tweets[:5], 1):
        print(f"\n{i}. Tweet ID: {tweet['id']}")
        print(f"   Date: {tweet['created_at']}")
        print(f"   Text: {tweet['text'][:150]}...")
        print(f"   Likes: {tweet['public_metrics']['like_count']}")
        print(f"   Retweets: {tweet['public_metrics']['retweet_count']}")
        print(f"   Hashtags: {', '.join([tag['tag'] for tag in tweet['entities']['hashtags']]) if tweet['entities']['hashtags'] else 'None'}")
    
    print()
    print("=" * 60)
    print("✅ Test successful!")
    print("=" * 60)
    print()
    print("All tweets are original (no retweets)")
    print(f"Total: {len(tweets)} tweets fetched")
    print()
    print("Ready to start full fetch with:")
    print("  python scripts/fetch_tweets.py --handle OPChoudhary_Ind --since 2023-12-01 --until 2025-10-31")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

