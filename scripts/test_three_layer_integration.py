#!/usr/bin/env python3
"""
Test Three-Layer Consensus Integration
Verify Gemini, Ollama, and Regex layers work together with rate limiting
"""

import os
import sys
import json
from datetime import datetime

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

def test_api_integration():
    """Test the three-layer API endpoint with actual AI calls"""
    print("🧪 Testing Three-Layer Consensus API Integration")
    print("=" * 60)

    try:
        import requests

        # Test status endpoint
        print("📊 Checking API status...")
        status_response = requests.get('http://localhost:3000/api/parsing/three-layer-consensus')
        if status_response.status_code == 200:
            status_data = status_response.json()
            print("✅ API Status: Operational")
            print(f"   Gemini available: {status_data['config']['gemini_available']}")
            print(f"   Rate limits: Gemini {status_data['rate_limits']['gemini']['used']}/{status_data['rate_limits']['gemini']['limit']} RPM")
            print(f"   Rate limits: Ollama {status_data['rate_limits']['ollama']['used']}/{status_data['rate_limits']['ollama']['limit']} RPM")
        else:
            print(f"❌ API status check failed: {status_response.status_code}")
            print("   Make sure Next.js server is running: npm run dev")
            return

        # Test simple tweet parsing (should use all three layers)
        test_tweet = "मुख्यमंत्री श्री @bhupeshbaghel जी द्वारा रायपुर में स्वास्थ्य शिविर का उद्घाटन किया गया। प्रधानमंत्री स्वास्थ्य योजना के लाभार्थियों को फायदा मिला।"

        print(f"\n🧪 Testing full three-layer parsing...")
        print(f"Tweet: \"{test_tweet[:80]}...\"")

        response = requests.post(
            'http://localhost:3000/api/parsing/three-layer-consensus',
            json={
                'text': test_tweet,
                'tweetId': 'integration-test-1',
                'tweetDate': datetime.now().isoformat()
            },
            timeout=60  # Allow more time for AI calls
        )

        if response.status_code == 200:
            result = response.json()
            if result['success']:
                parsed = result['result']
                metadata = result['metadata']

                print("✅ Three-layer parsing successful!"                print(f"   Event Type: {parsed['event_type']} (confidence: {(parsed['overall_confidence'] * 100):.1f}%)")
                print(f"   Layers used: {parsed['layers_used']}")
                print(f"   Consensus score: {parsed['consensus_score']}/3")
                print(f"   Needs review: {parsed['needs_review']}")
                print(f"   Locations: {parsed['locations']}")
                print(f"   People: {parsed['people_mentioned']}")
                print(f"   Organizations: {parsed['organizations']}")
                print(f"   Schemes: {parsed['schemes_mentioned']}")
                print(f"   Reasoning: {parsed['reasoning']}")

                # Check if Gemini was actually used
                if 'gemini' in parsed['layers_used']:
                    print("🎉 GEMINI AI WAS USED! (Free tier limits respected)")
                else:
                    print("⚠️  Gemini not used - check API key or rate limits")

                # Check if Ollama was used
                if 'ollama' in parsed['layers_used']:
                    print("🤖 OLLAMA AI WAS USED!")
                else:
                    print("⚠️  Ollama not used - check if service is running")

                # Verify regex fallback
                if 'regex' in parsed['layers_used']:
                    print("🔍 REGEX FALLBACK WAS USED!")
                else:
                    print("❌ Regex layer missing")

            else:
                print(f"❌ Parsing failed: {result.get('error', 'Unknown error')}")
        else:
            print(f"❌ HTTP error: {response.status_code} - {response.text}")

    except ImportError:
        print("❌ requests module not available. Install with: pip install requests")
    except Exception as e:
        print(f"❌ Test failed: {e}")

def test_rate_limiting():
    """Test that rate limiting prevents excessive API calls"""
    print("\n⏱️  Testing Rate Limiting (Free Tier Safety)")
    print("=" * 60)

    try:
        import requests
        import time

        print("Making multiple rapid requests to test rate limiting...")

        start_time = time.time()
        responses = []

        # Make 10 rapid requests (should be limited to ~5/minute for Gemini)
        for i in range(10):
            try:
                response = requests.post(
                    'http://localhost:3000/api/parsing/three-layer-consensus',
                    json={
                        'text': f'Test tweet {i}',
                        'tweetId': f'rate-test-{i}',
                        'tweetDate': datetime.now().isoformat()
                    },
                    timeout=30
                )
                responses.append(response.status_code)
                print(f"   Request {i+1}: {response.status_code}")

                # Small delay to not overwhelm completely
                time.sleep(0.1)

            except Exception as e:
                print(f"   Request {i+1}: ERROR - {e}")
                responses.append('ERROR')

        end_time = time.time()
        total_time = end_time - start_time

        print(".2f"        print(f"   Requests made: {len(responses)}")
        print(f"   Successful: {responses.count(200)}")
        print(f"   Rate limited: {responses.count(429) if 429 in responses else 0}")

        if total_time > 10:  # Should take time due to rate limiting
            print("✅ Rate limiting is working! Requests were properly throttled.")
        else:
            print("⚠️  Rate limiting may not be working properly.")

    except Exception as e:
        print(f"❌ Rate limiting test failed: {e}")

def test_error_handling():
    """Test error handling and fallbacks"""
    print("\n🛡️  Testing Error Handling & Fallbacks")
    print("=" * 60)

    try:
        import requests

        # Test with empty tweet
        print("Testing empty tweet handling...")
        response = requests.post(
            'http://localhost:3000/api/parsing/three-layer-consensus',
            json={
                'text': '',
                'tweetId': 'error-test-empty',
                'tweetDate': datetime.now().isoformat()
            },
            timeout=10
        )

        if response.status_code == 200:
            result = response.json()
            if result['success'] and not result['result']['needs_review']:
                print("✅ Empty tweet handled correctly")
            else:
                print("⚠️  Empty tweet handling could be improved")
        else:
            print(f"❌ Empty tweet test failed: {response.status_code}")

        # Test with very short tweet
        print("Testing very short tweet...")
        response = requests.post(
            'http://localhost:3000/api/parsing/three-layer-consensus',
            json={
                'text': 'Hi',
                'tweetId': 'error-test-short',
                'tweetDate': datetime.now().isoformat()
            },
            timeout=10
        )

        if response.status_code == 200:
            result = response.json()
            print("✅ Short tweet handled correctly")
        else:
            print(f"❌ Short tweet test failed: {response.status_code}")

    except Exception as e:
        print(f"❌ Error handling test failed: {e}")

def main():
    print("🚀 Three-Layer Consensus Integration Test Suite")
    print("=" * 60)
    print("⚠️  FREE TIER SAFETY: Gemini limited to 5 RPM max")
    print("🤖 Testing: Gemini AI + Ollama + Regex with consensus voting")
    print()

    # Environment check
    print("🔍 Environment Check:")
    gemini_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    print(f"   Gemini API Key: {'✅ Set' if gemini_key else '❌ Not set'}")
    print(f"   Ollama Base URL: {os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}")
    print()

    # Run tests
    test_api_integration()
    test_rate_limiting()
    test_error_handling()

    print("\n🎯 SUMMARY:")    print("   • Three-layer consensus should be working")
    print("   • Rate limiting should prevent API quota exhaustion")
    print("   • Error handling should provide graceful fallbacks")
    print("   • Free tier limits should be strictly enforced")
    print()
    print("📊 EXPECTED BEHAVIOR:")
    print("   • High confidence scores (>0.8) when AI agrees")
    print("   • Automatic approval for confident results")
    print("   • Human review only for low-confidence cases")
    print("   • Fallback to regex when AI fails")

if __name__ == '__main__':
    main()
