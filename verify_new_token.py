#!/usr/bin/env python3
"""
CAREFUL TOKEN VERIFICATION - Uses minimal API calls

Step 1: Check if token is valid (uses 0 tweets from quota)
Step 2: Show current quota status
Step 3: Ask before proceeding to fetch tweets
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import requests

load_dotenv(Path(__file__).parent / '.env.local')

bearer_token = os.getenv('X_BEARER_TOKEN')

if not bearer_token:
    print("❌ X_BEARER_TOKEN not found in .env.local")
    sys.exit(1)

print("=" * 60)
print("TOKEN VERIFICATION (CAREFUL)")
print("=" * 60)
print()
print("This will make 1 lightweight API call to verify credentials")
print("This does NOT count against your 100 tweet quota")
print()

headers = {
    'Authorization': f'Bearer {bearer_token}',
}

try:
    # Use the user lookup endpoint (doesn't count against tweet quota)
    print("Checking token validity...")
    response = requests.get(
        'https://api.twitter.com/2/users/by/username/OPChoudhary_Ind',
        headers=headers,
    )
    
    print(f"Status: {response.status_code}")
    print()
    
    if response.status_code == 200:
        print("✅ TOKEN IS VALID!")
        print()
        
        # Get user info
        data = response.json()
        if 'data' in data:
            print(f"✓ User: @{data['data']['username']}")
            print(f"✓ Name: {data['data']['name']}")
            print(f"✓ ID: {data['data']['id']}")
        print()
        
        # Check rate limit headers
        print("Current Quota Status:")
        print("-" * 60)
        
        limit = response.headers.get('x-rate-limit-limit', 'unknown')
        remaining = response.headers.get('x-rate-limit-remaining', 'unknown')
        reset = response.headers.get('x-rate-limit-reset', 'unknown')
        
        print(f"Rate Limit: {limit} requests per window")
        print(f"Remaining: {remaining} requests")
        
        if reset != 'unknown':
            import datetime
            reset_time = datetime.datetime.fromtimestamp(int(reset))
            print(f"Resets at: {reset_time}")
        
        print()
        print("=" * 60)
        print("✅ VERIFICATION COMPLETE")
        print("=" * 60)
        print()
        print("Token is working correctly!")
        print()
        print("Next step:")
        print("  python fetch_10_tweets.py")
        print()
        print("This will fetch 10 tweets to verify full functionality.")
        print("You'll have 90 tweets remaining for the month.")
        print()
        
    elif response.status_code == 401:
        print("❌ UNAUTHORIZED")
        print()
        print("The bearer token is invalid or expired.")
        print()
        print("Please check:")
        print("1. You copied the FULL bearer token")
        print("2. It's from the correct project (0/100 usage)")
        print("3. There are no extra spaces or characters")
        print()
        sys.exit(1)
        
    elif response.status_code == 429:
        print("❌ RATE LIMIT EXCEEDED")
        print()
        print("This token has already been rate limited.")
        print("This might be the same token as before.")
        print()
        print("Make sure you got the token from the project showing 0/100 usage.")
        print()
        sys.exit(1)
        
    elif response.status_code == 403:
        print("❌ FORBIDDEN")
        print()
        print("Access denied. This could mean:")
        print("1. The app doesn't have required permissions")
        print("2. The app is suspended")
        print()
        sys.exit(1)
        
    else:
        print(f"❌ UNEXPECTED STATUS: {response.status_code}")
        print()
        print("Response:", response.text[:500])
        print()
        sys.exit(1)

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

