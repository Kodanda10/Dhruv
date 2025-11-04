#!/usr/bin/env python3
"""
Test Complete Pipeline - End-to-End Verification
Tests: Fetch → Parse → Database → Review Screen → Analytics

Uses real tweets from data/parsed_tweets.json for validation.
"""
import os
import sys
import json
import requests
import time
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env.local')

def get_db_connection():
    """Get database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found')
    return psycopg2.connect(database_url)

def load_real_tweets():
    """Load real tweets from parsed_tweets.json for testing."""
    tweets_path = Path(__file__).parent.parent / 'data' / 'parsed_tweets.json'
    if tweets_path.exists():
        with open(tweets_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def test_database_state():
    """Test database has parsed events."""
    print("=" * 80)
    print("TEST 1: Database State Check")
    print("=" * 80)
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check raw_tweets
            cur.execute("SELECT COUNT(*) FROM raw_tweets WHERE author_handle = 'OPChoudhary_Ind'")
            raw_count = cur.fetchone()[0]
            print(f"✅ Raw tweets in database: {raw_count}")
            
            # Check parsed_events
            cur.execute("SELECT COUNT(*) FROM parsed_events")
            parsed_count = cur.fetchone()[0]
            print(f"✅ Parsed events in database: {parsed_count}")
            
            # Check latest parsed event
            cur.execute("""
                SELECT pe.tweet_id, pe.event_type, pe.overall_confidence, pe.needs_review, pe.review_status
                FROM parsed_events pe
                ORDER BY pe.parsed_at DESC
                LIMIT 1
            """)
            latest = cur.fetchone()
            if latest:
                print(f"✅ Latest parsed event:")
                print(f"   Tweet ID: {latest[0]}")
                print(f"   Event Type: {latest[1]}")
                print(f"   Confidence: {latest[2]}")
                print(f"   Needs Review: {latest[3]}")
                print(f"   Review Status: {latest[4]}")
            
            return raw_count > 0 and parsed_count > 0
    finally:
        conn.close()

def test_api_endpoint(base_url='http://localhost:3000'):
    """Test parsed-events API endpoint."""
    print()
    print("=" * 80)
    print("TEST 2: API Endpoint Check")
    print("=" * 80)
    
    try:
        # Test 1: Get all parsed events
        print("\n📡 Testing: GET /api/parsed-events")
        response = requests.get(f'{base_url}/api/parsed-events?limit=10', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Status: {response.status_code}")
            print(f"   ✅ Source: {data.get('source', 'unknown')}")
            print(f"   ✅ Count: {len(data.get('data', []))} tweets")
            if data.get('data'):
                latest = data['data'][0]
                print(f"   ✅ Latest tweet: {latest.get('tweet_id', 'unknown')}")
                print(f"      Event: {latest.get('event_type', 'unknown')}")
                print(f"      Content: {latest.get('content', '')[:60]}...")
        else:
            print(f"   ❌ Status: {response.status_code}")
            return False
        
        # Test 2: Get review queue
        print("\n📡 Testing: GET /api/parsed-events?needs_review=true")
        response = requests.get(f'{base_url}/api/parsed-events?needs_review=true&limit=10', timeout=5)
        if response.status_code == 200:
            data = response.json()
            review_count = len(data.get('data', []))
            print(f"   ✅ Status: {response.status_code}")
            print(f"   ✅ Tweets needing review: {review_count}")
        else:
            print(f"   ❌ Status: {response.status_code}")
        
        # Test 3: Analytics endpoint
        print("\n📡 Testing: GET /api/parsed-events?analytics=true")
        response = requests.get(f'{base_url}/api/parsed-events?analytics=true', timeout=5)
        if response.status_code == 200:
            data = response.json()
            analytics = data.get('analytics', {})
            print(f"   ✅ Status: {response.status_code}")
            print(f"   ✅ Total tweets: {analytics.get('total_tweets', 0)}")
            print(f"   ✅ Event types: {len(analytics.get('event_distribution', {}))}")
            print(f"   ✅ Locations: {len(analytics.get('location_distribution', {}))}")
        else:
            print(f"   ❌ Status: {response.status_code}")
        
        return True
    except requests.exceptions.ConnectionError:
        print("   ⚠️  Next.js server not running")
        print("   💡 Start with: npm run dev")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

def test_review_screen_data():
    """Test that review screen can fetch latest parsed tweets."""
    print()
    print("=" * 80)
    print("TEST 3: Review Screen Data Check")
    print("=" * 80)
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get tweets that need review
            cur.execute("""
                SELECT 
                    pe.tweet_id,
                    pe.event_type,
                    pe.overall_confidence,
                    rt.text,
                    pe.locations
                FROM parsed_events pe
                LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
                WHERE pe.needs_review = true
                ORDER BY pe.parsed_at DESC
                LIMIT 5
            """)
            
            tweets = cur.fetchall()
            print(f"\n✅ Found {len(tweets)} tweets needing review:")
            for i, tweet in enumerate(tweets, 1):
                tweet_id, event_type, confidence, text, locations = tweet
                location_count = len(locations) if locations and isinstance(locations, list) else 0
                print(f"\n   [{i}] Tweet ID: {tweet_id}")
                print(f"       Event Type: {event_type}")
                print(f"       Confidence: {confidence}")
                print(f"       Locations: {location_count}")
                print(f"       Content: {text[:60] if text else 'N/A'}...")
            
            return len(tweets) > 0
    finally:
        conn.close()

def compare_with_static_file():
    """Compare database data with static parsed_tweets.json."""
    print()
    print("=" * 80)
    print("TEST 4: Database vs Static File Comparison")
    print("=" * 80)
    
    # Load static file
    static_tweets = load_real_tweets()
    print(f"\n📄 Static file: {len(static_tweets)} tweets")
    
    # Load from database
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) FROM parsed_events
            """)
            db_count = cur.fetchone()[0]
            print(f"💾 Database: {db_count} parsed events")
            
            # Check overlap
            static_ids = {str(t.get('id', '')) for t in static_tweets}
            cur.execute("SELECT tweet_id FROM parsed_events LIMIT 100")
            db_ids = {str(row[0]) for row in cur.fetchall()}
            
            overlap = len(static_ids & db_ids)
            print(f"🔄 Overlap: {overlap} tweet IDs in both")
            
            if overlap > 0:
                print("   ✅ Database and static file have overlapping data")
            else:
                print("   ⚠️  No overlap - may need to sync")
    finally:
        conn.close()

def main():
    """Run all tests."""
    print("=" * 80)
    print("COMPLETE PIPELINE TEST - Using Real Tweets from parsed_tweets.json")
    print("=" * 80)
    print()
    print("This test verifies:")
    print("  1. Database has raw tweets and parsed events")
    print("  2. API endpoints return data from database (primary source)")
    print("  3. Review screen can fetch latest parsed tweets")
    print("  4. Analytics endpoints work with real data")
    print()
    
    # Load real tweets for reference
    real_tweets = load_real_tweets()
    print(f"📊 Test data: {len(real_tweets)} real tweets loaded from parsed_tweets.json")
    print()
    
    results = {}
    
    # Test 1: Database state
    results['database'] = test_database_state()
    
    # Test 2: API endpoints (only if server is running)
    results['api'] = test_api_endpoint()
    
    # Test 3: Review screen data
    results['review'] = test_review_screen_data()
    
    # Test 4: Comparison
    compare_with_static_file()
    
    # Summary
    print()
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {test_name.upper():15s} {status}")
    
    all_passed = all(results.values())
    
    print()
    if all_passed:
        print("🎉 ALL TESTS PASSED - Pipeline is working!")
        print()
        print("✅ Database has tweets and parsed events")
        print("✅ API endpoints are accessible")
        print("✅ Review screen can fetch data")
        print()
        print("Next: Check dashboard at http://localhost:3000")
        sys.exit(0)
    else:
        print("⚠️  SOME TESTS FAILED")
        print()
        if not results.get('database'):
            print("❌ Database check failed - run: python scripts/parse_tweets.py")
        if not results.get('api'):
            print("❌ API check failed - ensure Next.js server is running: npm run dev")
        if not results.get('review'):
            print("❌ Review screen check failed - check parsed_events table")
        sys.exit(1)

if __name__ == '__main__':
    main()

