#!/usr/bin/env python3
"""Test fetching recent tweets without date restrictions"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env.local')

sys.path.insert(0, str(Path(__file__).parent))

from api.src.twitter.client import TwitterClient

print("=" * 60)
print("Test: Fetch Recent Tweets from @OPChoudhary_Ind")
print("=" * 60)
print()

try:
    client = TwitterClient()
    
    # Fetch 100 most recent tweets (no date filter, excluding retweets)
    print("Fetching 100 most recent original tweets...")
    print("-" * 60)
    
    tweets = client.fetch_user_tweets(
        username='OPChoudhary_Ind',
        max_results=100,
        # No start_time or end_time - get most recent
    )
    
    if not tweets:
        print("❌ No tweets found")
        print()
        print("Trying WITH retweets to see if account exists...")
        print("-" * 60)
        
        # Try with retweets to verify account
        import tweepy
        tweepy_client = tweepy.Client(
            bearer_token=os.getenv('X_BEARER_TOKEN'),
            wait_on_rate_limit=True,
        )
        
        user = tweepy_client.get_user(username='OPChoudhary_Ind')
        if user.data:
            print(f"✓ Account exists: @{user.data.username}")
            print(f"  Name: {user.data.name}")
            print(f"  ID: {user.data.id}")
            print(f"  Followers: {user.data.public_metrics['followers_count']}")
            print()
            
            # Try fetching WITH retweets
            print("Fetching with retweets included...")
            tweets_with_rt = tweepy_client.get_users_tweets(
                id=user.data.id,
                max_results=10,
                tweet_fields=['created_at', 'public_metrics'],
            )
            
            if tweets_with_rt.data:
                print(f"✓ Found {len(tweets_with_rt.data)} tweets (including retweets)")
                print()
                print("Sample tweets:")
                for i, tweet in enumerate(tweets_with_rt.data[:3], 1):
                    print(f"\n{i}. {tweet.created_at}")
                    print(f"   {tweet.text[:100]}...")
                    print(f"   Likes: {tweet.public_metrics['like_count']}")
            else:
                print("❌ No tweets found even with retweets")
        else:
            print("❌ Account not found")
        
        sys.exit(1)
    
    print(f"\n✅ Successfully fetched {len(tweets)} tweets!")
    print()
    
    # Show date range
    dates = [tweet['created_at'] for tweet in tweets if tweet['created_at']]
    if dates:
        print(f"Date range: {min(dates)} to {max(dates)}")
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
    
    print()
    print("=" * 60)
    print("✅ Test successful!")
    print("=" * 60)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

