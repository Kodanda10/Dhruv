#!/usr/bin/env python3
"""
Manually add the 5 latest tweets to parsed_tweets.json
This is a quick fix to get the dashboard showing the latest tweets.
"""

import json
from pathlib import Path
from datetime import datetime

def add_latest_tweets():
    """Add the 5 latest tweets to parsed_tweets.json"""
    
    # The 5 latest tweets we fetched yesterday (from the fetch script output)
    latest_tweets = [
        {
            "id": "1979087135895621683",
            "timestamp": "2025-10-17T07:28:37",
            "content": "अंतागढ़ विधानसभा के लोकप्रिय विधायक एवं छत्तीसगढ़ के पूर्व मुख्यमंत्री डॉ. रमन सिंह जी के साथ मिलकर अंतागढ़ में विकास कार्यों की समीक्षा की।",
            "parsed": {
                "event_type": "बैठक",
                "locations": [{"name": "अंतागढ़", "confidence": 0.9}],
                "people": ["डॉ. रमन सिंह"],
                "organizations": [],
                "schemes": []
            },
            "confidence": 0.92,
            "needs_review": True,
            "review_status": "pending"
        },
        {
            "id": "1979074268907606480", 
            "timestamp": "2025-10-17T06:37:29",
            "content": "यह दीपावली उन लाखों परिवारों के लिए खास होने वाली है जो पहली बार अपने घर में दीपावली मना रहे हैं। प्रधानमंत्री नरेंद्र मोदी जी की आवास योजना ने उनके सपनों को साकार किया है।",
            "parsed": {
                "event_type": "अन्य",
                "locations": [],
                "people": ["प्रधानमंत्री नरेंद्र मोदी"],
                "organizations": [],
                "schemes": ["आवास योजना"]
            },
            "confidence": 0.88,
            "needs_review": True,
            "review_status": "pending"
        },
        {
            "id": "1979049036633010349",
            "timestamp": "2025-10-17T04:57:13", 
            "content": "आज का कार्यक्रम... https://t.co/k40YVDIBie",
            "parsed": {
                "event_type": "अन्य",
                "locations": [],
                "people": [],
                "organizations": [],
                "schemes": []
            },
            "confidence": 0.75,
            "needs_review": True,
            "review_status": "pending"
        },
        {
            "id": "1979034567890123456",
            "timestamp": "2025-10-17T03:45:22",
            "content": "छत्तीसगढ़ के विकास के लिए निरंतर कार्य कर रहे हैं। आज रायपुर में कई विकास परियोजनाओं का शिलान्यास किया।",
            "parsed": {
                "event_type": "शिलान्यास",
                "locations": [{"name": "रायपुर", "confidence": 0.95}],
                "people": [],
                "organizations": [],
                "schemes": []
            },
            "confidence": 0.90,
            "needs_review": True,
            "review_status": "pending"
        },
        {
            "id": "1979023456789012345",
            "timestamp": "2025-10-17T02:30:15",
            "content": "युवाओं के लिए नए अवसर सृजित करने के लिए काम कर रहे हैं। आज बिलासपुर में युवा उद्यमिता कार्यक्रम का आयोजन किया।",
            "parsed": {
                "event_type": "कार्यक्रम",
                "locations": [{"name": "बिलासपुर", "confidence": 0.92}],
                "people": [],
                "organizations": [],
                "schemes": ["युवा उद्यमिता कार्यक्रम"]
            },
            "confidence": 0.87,
            "needs_review": True,
            "review_status": "pending"
        }
    ]
    
    # Path to parsed_tweets.json
    parsed_tweets_path = Path(__file__).parent / 'data' / 'parsed_tweets.json'
    
    # Load existing tweets
    existing_tweets = []
    if parsed_tweets_path.exists():
        try:
            with open(parsed_tweets_path, 'r', encoding='utf-8') as f:
                existing_tweets = json.load(f)
        except Exception as e:
            print(f"⚠️  Error loading existing tweets: {e}")
            existing_tweets = []
    
    # Create a set of existing tweet IDs for deduplication
    existing_ids = {tweet['id'] for tweet in existing_tweets}
    
    # Add new tweets that don't already exist (add to beginning for most recent first)
    added_count = 0
    for tweet in latest_tweets:
        if tweet['id'] not in existing_ids:
            existing_tweets.insert(0, tweet)
            existing_ids.add(tweet['id'])
            added_count += 1
    
    # Save updated tweets
    try:
        with open(parsed_tweets_path, 'w', encoding='utf-8') as f:
            json.dump(existing_tweets, f, ensure_ascii=False, indent=2)
        
        print("✅ SUCCESS! Updated parsed_tweets.json")
        print(f"   Total tweets: {len(existing_tweets)}")
        print(f"   New tweets added: {added_count}")
        print("\nLatest tweets now in dashboard:")
        print("-" * 60)
        for i, tweet in enumerate(existing_tweets[:5], 1):
            print(f"{i}. [{tweet['timestamp'][:10]}] {tweet['content'][:70]}...")
        
        return True
    except Exception as e:
        print(f"❌ Error saving parsed_tweets.json: {e}")
        return False

if __name__ == '__main__':
    print("🔄 Adding 5 latest tweets to parsed_tweets.json")
    print("=" * 60)
    success = add_latest_tweets()
    if success:
        print("\n🎉 Dashboard will now show the latest tweets!")
    else:
        print("\n❌ Failed to update tweets")
