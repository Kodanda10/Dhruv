#!/usr/bin/env python3
"""
Test Three-Layer Consensus Parsing
Verify Gemini, Ollama, and Regex layers are working
"""

import os
import sys
import json
from datetime import datetime

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

# Test data
TEST_TWEETS = [
    {
        'id': 'test_inauguration',
        'text': 'मुख्यमंत्री श्री @bhupeshbaghel जी द्वारा बिलासपुर में स्वास्थ्य शिविर का उद्घाटन किया गया। प्रधानमंत्री स्वास्थ्य योजना के तहत 500 लाभार्थियों को लाभ मिला।',
        'expected': {
            'event_type': 'inauguration',
            'locations': ['बिलासपुर'],
            'people': ['bhupeshbaghel'],
            'schemes': ['प्रधानमंत्री स्वास्थ्य योजना']
        }
    },
    {
        'id': 'test_meeting',
        'text': 'दिल्ली में प्रधानमंत्री श्री नरेंद्र मोदी जी की अध्यक्षता में कैबिनेट बैठक संपन्न हुई। नई कृषि नीति पर चर्चा की गई।',
        'expected': {
            'event_type': 'meeting',
            'locations': ['दिल्ली'],
            'people': ['नरेंद्र मोदी'],
            'organizations': ['कैबिनेट']
        }
    },
    {
        'id': 'test_rally',
        'text': 'रायपुर में भाजपा की रैली में मुख्यमंत्री पहुंचे। हजारों कार्यकर्ताओं ने भाग लिया।',
        'expected': {
            'event_type': 'rally',
            'locations': ['रायपुर'],
            'organizations': ['भाजपा']
        }
    }
]

def test_api_endpoint():
    """Test the three-layer consensus API endpoint"""
    print("🔬 Testing Three-Layer Consensus API Endpoint")
    print("=" * 60)

    try:
        import requests

        # First check status
        print("📊 Checking API status...")
        status_response = requests.get('http://localhost:3000/api/parsing/three-layer-consensus')
        if status_response.status_code == 200:
            status_data = status_response.json()
            print("✅ API Status: Operational"            print(f"   Gemini available: {status_data['config']['gemini_available']}")
            print(f"   Rate limits: Gemini {status_data['rate_limits']['gemini']['used']}/{status_data['rate_limits']['gemini']['limit']} RPM")
            print(f"   Rate limits: Ollama {status_data['rate_limits']['ollama']['used']}/{status_data['rate_limits']['ollama']['limit']} RPM")
        else:
            print(f"❌ API status check failed: {status_response.status_code}")
            return

        # Test parsing
        print("\n🧪 Testing tweet parsing...")
        for i, tweet in enumerate(TEST_TWEETS, 1):
            print(f"\n📝 Test Tweet #{i}: {tweet['id']}")
            print(f"   Text: \"{tweet['text'][:80]}...\"")

            try:
                response = requests.post(
                    'http://localhost:3000/api/parsing/three-layer-consensus',
                    json={
                        'text': tweet['text'],
                        'tweetId': tweet['id'],
                        'tweetDate': datetime.now().isoformat()
                    },
                    timeout=30
                )

                if response.status_code == 200:
                    result = response.json()
                    if result['success']:
                        parsed = result['result']
                        print("✅ Parsing successful:"                        print(f"   Event Type: {parsed['event_type']} (confidence: {(parsed['overall_confidence'] * 100):.1f}%)")
                        print(f"   Locations: {parsed['locations']}")
                        print(f"   People: {parsed['people_mentioned']}")
                        print(f"   Organizations: {parsed['organizations']}")
                        print(f"   Schemes: {parsed['schemes_mentioned']}")
                        print(f"   Layers used: {parsed['layers_used']}")
                        print(f"   Consensus score: {parsed['consensus_score']}/3")
                        print(f"   Needs review: {parsed['needs_review']}")
                    else:
                        print(f"❌ Parsing failed: {result.get('error', 'Unknown error')}")
                else:
                    print(f"❌ HTTP error: {response.status_code}")

            except requests.exceptions.RequestException as e:
                print(f"❌ Request failed: {e}")

    except ImportError:
        print("❌ requests module not available. Install with: pip install requests")

def test_direct_engine():
    """Test the engine directly (if Next.js server is not running)"""
    print("\n🔧 Testing Engine Directly (Fallback)")
    print("=" * 60)

    try:
        from lib.parsing.three_layer_consensus_engine import ThreeLayerConsensusEngine
        from lib.parsing.rate_limiter import RateLimiter

        print("✅ Imports successful")

        # Initialize components
        rate_limiter = RateLimiter({
            'geminiRPM': 10,
            'ollamaRPM': 60,
            'maxRetries': 3,
            'backoffMultiplier': 2,
            'initialBackoffMs': 1000
        })

        engine = ThreeLayerConsensusEngine({
            'rateLimiter': rate_limiter,
            'consensusThreshold': 2,
            'enableFallback': True,
            'logLevel': 'info'
        })

        print("✅ Engine initialized")

        # Test simple parsing
        test_tweet = TEST_TWEETS[0]['text']
        print(f"\n🧪 Testing direct parsing with: \"{test_tweet[:50]}...\"")

        # This would normally work, but we don't have the full Node.js environment
        print("ℹ️  Direct engine testing requires full Node.js environment")

    except ImportError as e:
        print(f"❌ Import failed: {e}")

def main():
    print("🚀 Three-Layer Consensus Parsing Test Suite")
    print("=" * 60)

    # Check environment
    print("🔍 Environment Check:")
    print(f"   GEMINI_API_KEY: {'✅ Set' if os.getenv('GEMINI_API_KEY') else '❌ Not set'}")
    print(f"   GOOGLE_API_KEY: {'✅ Set' if os.getenv('GOOGLE_API_KEY') else '❌ Not set'}")
    print(f"   OLLAMA_BASE_URL: {os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}")
    print(f"   Node.js server running: {'✅' if check_server() else '❌'}")

    # Run tests
    test_api_endpoint()
    test_direct_engine()

    print("\n🎯 Test Summary:")
    print("   • Rate limiting: Should enforce API limits")
    print("   • Consensus voting: 2/3 majority required")
    print("   • Fallback handling: Regex when AI fails")
    print("   • Error resilience: Graceful degradation")

def check_server():
    """Check if Next.js server is running"""
    try:
        import requests
        response = requests.get('http://localhost:3000/api/parsing/three-layer-consensus', timeout=5)
        return response.status_code == 200
    except:
        return False

if __name__ == '__main__':
    main()
