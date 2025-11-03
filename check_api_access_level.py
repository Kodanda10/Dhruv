#!/usr/bin/env python3
"""
Check Twitter API Access Level

This script checks what level of access we actually have.
Different access levels have VASTLY different rate limits.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import requests

load_dotenv(Path(__file__).parent / '.env.local')

bearer_token = os.getenv('X_BEARER_TOKEN')

if not bearer_token:
    print("❌ X_BEARER_TOKEN not found")
    sys.exit(1)

print("=" * 60)
print("TWITTER API ACCESS LEVEL CHECK")
print("=" * 60)
print()

# Make a simple API call and check headers
headers = {
    'Authorization': f'Bearer {bearer_token}',
}

try:
    # Use a lightweight endpoint
    response = requests.get(
        'https://api.twitter.com/2/users/by/username/OPChoudhary_Ind',
        headers=headers,
    )
    
    print("Response Status:", response.status_code)
    print()
    
    if response.status_code == 200:
        print("✓ API credentials are valid")
        print()
        
        # Check rate limit headers
        print("Rate Limit Headers:")
        print("-" * 60)
        for key, value in response.headers.items():
            if 'rate-limit' in key.lower():
                print(f"  {key}: {value}")
        
        print()
        
        # Try to determine access level from headers
        limit = response.headers.get('x-rate-limit-limit', 'unknown')
        remaining = response.headers.get('x-rate-limit-remaining', 'unknown')
        reset = response.headers.get('x-rate-limit-reset', 'unknown')
        
        print("Analysis:")
        print("-" * 60)
        print(f"Rate Limit (requests per window): {limit}")
        print(f"Remaining: {remaining}")
        print(f"Resets at: {reset}")
        print()
        
        # Interpret the limit
        if limit != 'unknown':
            limit_num = int(limit)
            if limit_num <= 15:
                print("⚠️  ACCESS LEVEL: Free Tier (EXTREMELY LIMITED)")
                print("   This is why you're hitting rate limits immediately!")
                print()
                print("   Free tier limits:")
                print("   - Very few requests per 15-minute window")
                print("   - Not suitable for bulk data fetching")
                print("   - Designed for testing/hobby use only")
                print()
                print("   Solutions:")
                print("   1. Apply for Elevated Access (Free, but requires approval)")
                print("   2. Use paid Basic tier ($100/month)")
                print("   3. Be extremely patient (fetch over days/weeks)")
                print()
            elif limit_num <= 300:
                print("✓ ACCESS LEVEL: Elevated/Essential (Better)")
                print("  Should be workable for moderate fetching")
            else:
                print("✓ ACCESS LEVEL: Pro/Enterprise")
                print("  Good rate limits")
        
    elif response.status_code == 429:
        print("❌ Rate limit exceeded (can't even check)")
        print()
        print("This means you've exhausted even the user lookup endpoint.")
        print("Need to wait for rate limit to reset.")
        print()
        
        # Check reset time
        reset = response.headers.get('x-rate-limit-reset')
        if reset:
            import datetime
            reset_time = datetime.datetime.fromtimestamp(int(reset))
            print(f"Resets at: {reset_time}")
            print(f"Current time: {datetime.datetime.now()}")
        
    elif response.status_code == 401:
        print("❌ Unauthorized - Invalid credentials")
        print()
        print("Your API key may be:")
        print("  - Incorrect")
        print("  - Expired")
        print("  - Revoked")
        print()
        print("Check your Twitter Developer Portal:")
        print("  https://developer.twitter.com/en/portal/dashboard")
        
    elif response.status_code == 403:
        print("❌ Forbidden - Access denied")
        print()
        print("Your application may be:")
        print("  - Suspended")
        print("  - Not approved for this endpoint")
        print("  - Missing required permissions")
        print()
        print("Check your Twitter Developer Portal:")
        print("  https://developer.twitter.com/en/portal/dashboard")
    
    else:
        print(f"❌ Unexpected status code: {response.status_code}")
        print()
        print("Response:", response.text[:500])
    
    print()
    print("=" * 60)
    print("RECOMMENDATION")
    print("=" * 60)
    print()
    print("If you're on Free tier, you MUST apply for Elevated Access:")
    print()
    print("1. Go to: https://developer.twitter.com/en/portal/petition/essential/basic-info")
    print("2. Fill out the application (explain your use case)")
    print("3. Wait for approval (usually 1-2 days)")
    print("4. Elevated access gives you much better rate limits")
    print()
    print("OR")
    print()
    print("Accept that free tier means:")
    print("  - Fetching ~2000 tweets might take DAYS")
    print("  - Run script once, let it run for 24-48 hours")
    print("  - This is intentional by Twitter")
    print()

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

