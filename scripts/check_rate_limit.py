#!/usr/bin/env python3
"""
Check Twitter API rate limit status and countdown to reset

Usage:
    python scripts/check_rate_limit.py
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
import tweepy
import time

load_dotenv(Path(__file__).parent.parent / '.env.local')


def check_rate_limit():
    """Check rate limit status for user timeline endpoint."""
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token:
        print("❌ X_BEARER_TOKEN not found")
        sys.exit(1)
    
    try:
        client = tweepy.Client(bearer_token=bearer_token)
        
        # The free tier doesn't expose rate_limit_status endpoint
        # So we'll try a lightweight request to check
        print("=" * 60)
        print("TWITTER API RATE LIMIT STATUS")
        print("=" * 60)
        print()
        
        print("Attempting lightweight API call to check status...")
        print()
        
        try:
            # Try to get user info (lightweight call)
            user = client.get_user(username='OPChoudhary_Ind')
            
            print("✅ API is accessible - Rate limit NOT exceeded")
            print()
            print("You can now run:")
            print("  python scripts/fetch_all_tweets.py --handle OPChoudhary_Ind")
            print()
            
        except tweepy.errors.TooManyRequests as e:
            print("⏳ Rate limit exceeded")
            print()
            
            # Try to extract reset time from error
            if hasattr(e.response, 'headers'):
                reset_time = e.response.headers.get('x-rate-limit-reset')
                if reset_time:
                    reset_dt = datetime.fromtimestamp(int(reset_time), tz=timezone.utc)
                    now = datetime.now(timezone.utc)
                    wait_seconds = (reset_dt - now).total_seconds()
                    
                    print(f"Rate limit resets at: {reset_dt.strftime('%Y-%m-%d %H:%M:%S %Z')}")
                    print(f"Current time:         {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
                    print()
                    
                    if wait_seconds > 0:
                        minutes = int(wait_seconds // 60)
                        seconds = int(wait_seconds % 60)
                        print(f"⏰ Wait time: {minutes} minutes {seconds} seconds")
                        print()
                        
                        # Countdown
                        print("Starting countdown...")
                        for remaining in range(int(wait_seconds), 0, -1):
                            mins = remaining // 60
                            secs = remaining % 60
                            print(f"\r⏳ Time remaining: {mins:02d}:{secs:02d}", end='', flush=True)
                            time.sleep(1)
                        
                        print("\n")
                        print("✅ Rate limit should be reset now!")
                        print()
                        print("Run:")
                        print("  python scripts/fetch_all_tweets.py --handle OPChoudhary_Ind")
                    else:
                        print("✅ Rate limit should be reset now!")
                else:
                    print("Unable to determine reset time")
                    print("Free tier rate limit: 1 request per 15 minutes")
                    print()
                    print("⏰ Recommended: Wait 15 minutes and try again")
            else:
                print("Free tier rate limit: 1 request per 15 minutes")
                print()
                print("⏰ Recommended: Wait 15 minutes and try again")
        
        print()
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    check_rate_limit()

