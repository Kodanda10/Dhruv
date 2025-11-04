#!/usr/bin/env python3
"""
Test Secrets Integrity - Verify all required secrets are configured correctly
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
import tweepy
import google.generativeai as genai

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env.local')

def mask_secret(value: str, show_length: int = 4) -> str:
    """Mask secret value for display"""
    if not value:
        return 'NOT SET'
    if len(value) <= show_length * 2:
        return '***'
    return value[:show_length] + '...' + value[-show_length:]

def test_database():
    """Test database connection"""
    print('\n🔍 Testing Database Connection...')
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            print('❌ DATABASE_URL not set')
            return False
        
        conn = psycopg2.connect(database_url)
        with conn.cursor() as cur:
            cur.execute('SELECT COUNT(*) FROM raw_tweets')
            count = cur.fetchone()[0]
            print(f'✅ Database connected successfully')
            print(f'   Tweets in database: {count:,}')
        conn.close()
        return True
    except Exception as e:
        print(f'❌ Database connection failed: {str(e)}')
        return False

def test_twitter_api():
    """Test Twitter API connection"""
    print('\n🔍 Testing Twitter API...')
    try:
        bearer_token = os.getenv('X_BEARER_TOKEN')
        if not bearer_token:
            print('❌ X_BEARER_TOKEN not set')
            return False
        
        client = tweepy.Client(bearer_token=bearer_token)
        user = client.get_user(username='OPChoudhary_Ind')
        if user.data:
            print(f'✅ Twitter API connected successfully')
            print(f'   User: @{user.data.username} (ID: {user.data.id})')
            return True
        else:
            print('❌ Twitter API: User not found')
            return False
    except Exception as e:
        print(f'❌ Twitter API connection failed: {str(e)}')
        return False

def test_gemini_api():
    """Test Gemini API connection"""
    print('\n🔍 Testing Gemini API...')
    try:
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not api_key:
            print('❌ GEMINI_API_KEY or GOOGLE_API_KEY not set')
            return False
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Simple test request
        response = model.generate_content('Say "test"')
        if response.text:
            print(f'✅ Gemini API connected successfully')
            print(f'   Model: gemini-1.5-flash')
            print(f'   Test response: {response.text[:50]}')
            return True
        else:
            print('❌ Gemini API: No response')
            return False
    except Exception as e:
        print(f'❌ Gemini API connection failed: {str(e)}')
        return False

def main():
    """Main test function"""
    print('=' * 60)
    print('🔐 SECRETS INTEGRITY CHECK')
    print('=' * 60)
    
    # Check if secrets exist
    secrets = {
        'DATABASE_URL': os.getenv('DATABASE_URL'),
        'X_BEARER_TOKEN': os.getenv('X_BEARER_TOKEN'),
        'GEMINI_API_KEY': os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY'),
    }
    
    print('\n📋 Checking Secret Configuration...')
    all_set = True
    for key, value in secrets.items():
        if value:
            masked = mask_secret(value)
            print(f'✅ {key}: {masked} (length: {len(value)})')
        else:
            print(f'❌ {key}: NOT SET')
            all_set = False
    
    if not all_set:
        print('\n❌ ERROR: Some secrets are missing!')
        print('   Please set them in .env.local file')
        sys.exit(1)
    
    print('\n✅ All secrets are configured')
    
    # Test connections
    results = []
    results.append(test_database())
    results.append(test_twitter_api())
    results.append(test_gemini_api())
    
    # Summary
    print('\n' + '=' * 60)
    print('📊 INTEGRITY CHECK SUMMARY')
    print('=' * 60)
    
    if all(results):
        print('✅ All systems operational!')
        print('   Ready for GitHub Actions workflow')
        sys.exit(0)
    else:
        print('❌ Some systems failed!')
        print('   Please check the errors above')
        sys.exit(1)

if __name__ == '__main__':
    main()

