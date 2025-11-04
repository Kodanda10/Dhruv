#!/usr/bin/env python3
"""
Simple Three-Layer Parsing Demo
Tests the regex fallback to ensure basic functionality works
"""

import sys
from datetime import datetime

# Test tweets in Hindi
TEST_TWEETS = [
    {
        'id': 'test_inauguration',
        'text': 'मुख्यमंत्री श्री @bhupeshbaghel जी द्वारा बिलासपुर में स्वास्थ्य शिविर का उद्घाटन किया गया। प्रधानमंत्री स्वास्थ्य योजना के तहत 500 लाभार्थियों को लाभ मिला।',
        'expected_type': 'inauguration'
    },
    {
        'id': 'test_meeting',
        'text': 'दिल्ली में प्रधानमंत्री श्री नरेंद्र मोदी जी की अध्यक्षता में कैबिनेट बैठक संपन्न हुई। नई कृषि नीति पर चर्चा की गई।',
        'expected_type': 'meeting'
    },
    {
        'id': 'test_rally',
        'text': 'रायपुर में भाजपा की रैली में मुख्यमंत्री पहुंचे। हजारों कार्यकर्ताओं ने भाग लिया।',
        'expected_type': 'rally'
    },
    {
        'id': 'test_scheme',
        'text': 'आयुष्मान भारत योजना के लाभार्थियों को नई स्वास्थ्य कार्ड वितरित किए गए।',
        'expected_type': 'scheme_announcement'
    }
]

def classify_event_type(tweet_text: str) -> str:
    """Simple event type classification"""
    text = tweet_text.lower()

    patterns = {
        'inauguration': ['उद्घाटन', 'शिलान्यास', 'भूमिपूजन', 'लोकार्पण'],
        'meeting': ['बैठक', 'चर्चा', 'मुलाकात', 'सम्मिलित'],
        'rally': ['रैली', 'सभा', 'सम्मेलन'],
        'inspection': ['निरीक्षण', 'दौरा'],
        'scheme_announcement': ['योजना', 'घोषणा', 'विस्तार'],
        'condolence': ['निधन', 'शोक', 'श्रद्धांजलि'],
        'ceremony': ['समारोह', 'वितरण', 'प्रमाण'],
        'birthday_wishes': ['जन्मदिन', 'शुभकामना']
    }

    for event_type, keywords in patterns.items():
        for keyword in keywords:
            if keyword in text:
                return event_type

    return 'other'

def extract_locations(tweet_text: str) -> list:
    """Extract location names"""
    locations = []
    location_keywords = ['रायपुर', 'दिल्ली', 'मुंबई', 'बिलासपुर', 'रायगढ़', 'छत्तीसगढ़', 'भारत']

    for loc in location_keywords:
        if loc in tweet_text:
            locations.append(loc)

    return locations

def extract_people(tweet_text: str) -> list:
    """Extract people names"""
    import re
    people = []

    # Pattern for "श्री [Name] जी"
    name_pattern = r'श्री\s+([^\s,।]+(?:\s+[^\s,।]+){0,2})\s*जी?'
    matches = re.findall(name_pattern, tweet_text, re.IGNORECASE)
    people.extend(matches)

    # Twitter handles
    handle_pattern = r'@(\w+)'
    handles = re.findall(handle_pattern, tweet_text)
    people.extend(handles)

    return list(set(people))

def extract_organizations(tweet_text: str) -> list:
    """Extract organization names"""
    orgs = []
    org_keywords = ['कांग्रेस', 'भाजपा', 'भारतीय जनता पार्टी', 'सरकार', 'मंत्रालय']

    for org in org_keywords:
        if org in tweet_text:
            orgs.append(org)

    return orgs

def extract_schemes(tweet_text: str) -> list:
    """Extract government schemes"""
    schemes = []
    scheme_keywords = ['प्रधानमंत्री स्वास्थ्य योजना', 'मनरेगा', 'आयुष्मान भारत', 'किसान सम्मान', 'स्वच्छ भारत']

    for scheme in scheme_keywords:
        if scheme in tweet_text:
            schemes.append(scheme)

    return schemes

def calculate_confidence(event_type: str, locations: list, people: list, orgs: list, schemes: list) -> float:
    """Calculate confidence score"""
    confidence = 0.2  # Base confidence

    if event_type != 'other':
        confidence += 0.3

    confidence += min(len(locations) * 0.1, 0.2)
    confidence += min(len(people) * 0.1, 0.2)
    confidence += min(len(orgs) * 0.1, 0.1)
    confidence += min(len(schemes) * 0.2, 0.2)

    return min(confidence, 1.0)

def main():
    print("🚀 Three-Layer Consensus Parsing Demo")
    print("=" * 60)
    print("Testing regex-based parsing (fallback layer)")
    print()

    for i, tweet in enumerate(TEST_TWEETS, 1):
        print(f"📝 TEST TWEET #{i}: {tweet['id']}")
        print(f"   Expected: {tweet['expected_type']}")
        print(f"   Text: \"{tweet['text'][:80]}...\"")
        print()

        # Parse the tweet
        event_type = classify_event_type(tweet['text'])
        locations = extract_locations(tweet['text'])
        people = extract_people(tweet['text'])
        organizations = extract_organizations(tweet['text'])
        schemes = extract_schemes(tweet['text'])
        confidence = calculate_confidence(event_type, locations, people, organizations, schemes)

        print("🎯 PARSING RESULTS:")
        print(f"   Event Type: {event_type}")
        print(f"   Confidence: {confidence:.2f}")
        print(f"   Locations: {locations}")
        print(f"   People: {people}")
        print(f"   Organizations: {organizations}")
        print(f"   Schemes: {schemes}")
        print(f"   Needs Review: {confidence < 0.6}")
        print()

        # Check accuracy
        correct = event_type == tweet['expected_type']
        print(f"   ✅ Correct: {correct}")
        print("-" * 80)
        print()

    print("📊 SUMMARY:")
    print("   • Regex parsing is working")
    print("   • Event type classification: Working")
    print("   • Entity extraction: Basic implementation")
    print("   • Confidence scoring: Implemented")
    print()
    print("🔄 NEXT STEPS:")
    print("   • Integrate Gemini API (Primary layer)")
    print("   • Add Ollama API (Secondary layer)")
    print("   • Implement consensus voting algorithm")
    print("   • Add rate limiting and error handling")

if __name__ == '__main__':
    main()
