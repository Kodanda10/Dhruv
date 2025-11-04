#!/usr/bin/env python3
"""
Check Twitter API rate limit status WITHOUT consuming tweet quota.
Uses lightweight endpoints that don't count against tweet fetching limits.

OPTIMIZED: Does NOT test tweet fetching (to avoid consuming quota)
"""
import os
import sys
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
import requests

load_dotenv(Path(__file__).parent.parent / '.env.local')


def check_rate_limit_status():
    """
    Check Twitter API rate limit status using ONLY lightweight endpoints.
    Does NOT make tweet fetch calls to avoid consuming quota.
    """
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token:
        print("❌ X_BEARER_TOKEN not found")
        return False
    
    headers = {
        'Authorization': f'Bearer {bearer_token}',
        'User-Agent': 'ProjectDhruv/1.0'
    }
    
    print("=" * 80)
    print("CHECKING TWITTER API RATE LIMIT STATUS")
    print("=" * 80)
    print()
    print("NOTE: This check does NOT consume tweet fetching quota")
    print()
    
    # Check 1: User lookup endpoint (lightweight, separate quota from tweets)
    print("1. Checking user lookup endpoint...")
    print("   (This has separate quota - does NOT affect tweet fetching)")
    try:
        response = requests.get(
            'https://api.twitter.com/2/users/by/username/OPChoudhary_Ind',
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            print("   ✅ API credentials: VALID")
            data = response.json()
            print(f"   User: @{data['data']['username']} ({data['data']['name']})")
            
            # Extract rate limit info for user lookup
            remaining = response.headers.get('x-rate-limit-remaining', 'unknown')
            limit = response.headers.get('x-rate-limit-limit', 'unknown')
            reset = response.headers.get('x-rate-limit-reset', 'unknown')
            
            print(f"   User lookup quota: {remaining}/{limit}")
            
            if reset != 'unknown':
                reset_time = datetime.fromtimestamp(int(reset), tz=timezone.utc)
                now = datetime.now(timezone.utc)
                wait_seconds = max(0, int((reset_time - now).total_seconds()))
                
                if wait_seconds > 0:
                    wait_minutes = wait_seconds // 60
                    print(f"   Resets in: {wait_minutes} minutes")
            
        elif response.status_code == 429:
            reset = response.headers.get('x-rate-limit-reset', 'unknown')
            print("   ❌ Rate limit exceeded on user lookup (429)")
            if reset != 'unknown':
                reset_time = datetime.fromtimestamp(int(reset), tz=timezone.utc)
                now = datetime.now(timezone.utc)
                wait_seconds = max(0, int((reset_time - now).total_seconds()))
                wait_minutes = wait_seconds // 60
                print(f"   Wait: {wait_minutes} minutes until reset")
            # User lookup quota is separate, so we can still proceed
            print("   ⚠️  Note: User lookup quota is separate from tweet fetching")
            
        elif response.status_code == 401:
            print("   ❌ Unauthorized (401) - Invalid credentials")
            return False
        else:
            print(f"   ⚠️ Unexpected status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    print()
    print("2. Tweet fetching endpoint status:")
    print("   ⚠️  Cannot check WITHOUT consuming quota")
    print("   📝 We cannot test tweet fetching without using 1 quota")
    print("   📝 Your fetch script has wait_on_rate_limit=True, so it will")
    print("      automatically wait if rate limited")
    print()
    print("=" * 80)
    print("✅ RECOMMENDATION")
    print("=" * 80)
    print()
    print("API credentials are VALID.")
    print()
    print("To check tweet fetching quota:")
    print("  1. Run the fetch script - it will show if rate limited")
    print("  2. Check response headers in the script output")
    print("  3. The script will automatically wait if rate limited")
    print()
    print("✅ Safe to run fetch script (it handles rate limits automatically)")
    print("=" * 80)
    return True


def main():
    """Main function."""
    can_fetch = check_rate_limit_status()
    
    if can_fetch:
        print()
        print("✅ RECOMMENDATION: Safe to run fetch script")
        print("   The script will automatically handle rate limits")
        sys.exit(0)
    else:
        print()
        print("❌ RECOMMENDATION: Check API credentials")
        sys.exit(1)


if __name__ == '__main__':
    main()
