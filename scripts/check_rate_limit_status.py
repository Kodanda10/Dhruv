#!/usr/bin/env python3
"""
Check current Twitter API rate limit status.
Shows how many requests can be made before hitting limits.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import tweepy
import time

load_dotenv(Path(__file__).parent.parent / '.env.local')

def check_rate_limit_status():
    """Check current rate limit status for different endpoints."""
    bearer_token = os.getenv('X_BEARER_TOKEN')
    if not bearer_token:
        print('❌ X_BEARER_TOKEN not found in environment variables')
        return
    
    print('=' * 80)
    print('TWITTER API RATE LIMIT STATUS CHECK')
    print('=' * 80)
    print('')
    
    client = tweepy.Client(
        bearer_token=bearer_token,
        wait_on_rate_limit=True,
    )
    
    # Test user lookup endpoint (GET /2/users/:id)
    print('1. Testing User Lookup Endpoint (GET /2/users/:id)')
    print('   This endpoint is used to get user ID before fetching tweets')
    print('   Typical limit: 15 requests per 15 minutes (free tier)')
    print('')
    
    try:
        start_time = time.time()
        user = client.get_user(username='OPChoudhary_Ind')
        elapsed = time.time() - start_time
        
        if user.data:
            print(f'   ✅ Request successful ({elapsed:.2f}s)')
            print(f'   User: @{user.data.username} (ID: {user.data.id})')
        else:
            print('   ⚠️  User not found')
    except tweepy.TooManyRequests as e:
        print('   ❌ Rate limit exceeded')
        print('   This means you need to wait before making more requests')
    except Exception as e:
        print(f'   ❌ Error: {e}')
    
    print('')
    print('2. Testing Tweet Fetch Endpoint (GET /2/users/:id/tweets)')
    print('   This is the main endpoint for fetching tweets')
    print('   Typical limit: 1-5 requests per 15 minutes (free tier)')
    print('   Each request can fetch up to 100 tweets')
    print('')
    
    try:
        user = client.get_user(username='OPChoudhary_Ind')
        user_id = user.data.id
        
        start_time = time.time()
        response = client.get_users_tweets(
            id=user_id,
            max_results=10,  # Small test request
            exclude=['retweets'],
            tweet_fields=['created_at', 'public_metrics', 'entities'],
        )
        elapsed = time.time() - start_time
        
        if response.data:
            print(f'   ✅ Request successful ({elapsed:.2f}s)')
            print(f'   Fetched {len(response.data)} tweets')
            print(f'   This means you can make more requests')
        else:
            print('   ⚠️  No tweets returned')
    except tweepy.TooManyRequests as e:
        print('   ❌ Rate limit exceeded')
        print('   You need to wait before making more requests')
        print('   Script will automatically wait if using wait_on_rate_limit=True')
    except Exception as e:
        print(f'   ❌ Error: {e}')
    
    print('')
    print('=' * 80)
    print('RATE LIMIT GUIDANCE')
    print('=' * 80)
    print('')
    print('Free Tier Limits (Estimated):')
    print('  - User Lookup: ~15 requests per 15 minutes')
    print('  - Tweet Fetch: ~1-5 requests per 15 minutes')
    print('  - Monthly Quota: 500,000 tweets per month')
    print('')
    print('Safe Fetching Strategy:')
    print('  1. Make 1-2 requests per 15 minutes (conservative)')
    print('  2. Each request fetches up to 100 tweets')
    print('  3. Use wait_on_rate_limit=True to auto-handle limits')
    print('  4. Script will automatically pause and resume')
    print('')
    print('Estimated Timeline:')
    print('  - 100 tweets: 1 request (immediate)')
    print('  - 500 tweets: 5 requests (~1-2 hours)')
    print('  - 1000 tweets: 10 requests (~2-5 hours)')
    print('  - 2000 tweets: 20 requests (~4-10 hours)')
    print('')
    print('✅ RECOMMENDATION: Use fetch_tweets_safe.py with wait_on_rate_limit=True')
    print('   It will automatically handle all rate limits - no manual intervention needed')
    print('')

if __name__ == '__main__':
    check_rate_limit_status()

