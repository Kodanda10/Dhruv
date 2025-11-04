#!/usr/bin/env python3
"""Simple test for three-layer parsing"""

import requests
import json

def main():
    print("Testing three-layer parsing...")

    # Test data
    test_tweet = "मुख्यमंत्री श्री @bhupeshbaghel जी द्वारा रायपुर में स्वास्थ्य शिविर का उद्घाटन किया गया।"

    try:
        response = requests.post(
            'http://localhost:3000/api/parsing/three-layer-consensus',
            json={
                'text': test_tweet,
                'tweetId': 'simple-test-1',
                'tweetDate': '2024-01-01T10:00:00Z'
            },
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            print("SUCCESS!")
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f"FAILED: {response.status_code}")
            print(response.text)

    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    main()
