#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
समाज संदर्भ और कार्यक्रम विश्लेषण (Social Context & Event Analysis)
Analytics Dashboard - Section C

Analyzes tweets for social/community context, society names, and event instances.
"""

import json
import re
from collections import defaultdict, Counter
from datetime import datetime
import os

def decode_unicode_escapes(text):
    """Convert RTF Unicode escapes to actual characters"""
    def replace_unicode(match):
        code = int(match.group(1))
        try:
            return chr(code)
        except ValueError:
            return match.group(0)  # Keep original if invalid

    # Handle \uXXXX patterns with spaces (RTF format)
    text = re.sub(r'\\u(\d{4,5})\s*', replace_unicode, text)

    # Handle consecutive Unicode escapes
    text = re.sub(r'\\u(\d{4,5})\\u(\d{4,5})', lambda m: chr(int(m.group(1))) + chr(int(m.group(2))), text)

    # Clean up RTF control codes
    text = re.sub(r'\\[a-z]+\d*', '', text)
    text = re.sub(r'\\uc\d+', '', text)

    return text

def load_tweets_from_rtf(rtf_file_path):
    """Load and parse tweets from RTF file"""
    tweets = []

    try:
        with open(rtf_file_path, 'r', encoding='utf-8') as file:
            content = file.read()

        # Split content into individual tweets using the same approach as other scripts
        tweet_sections = re.split(r'Tweet #\d+', content)[1:]  # Skip header

        for section in tweet_sections:
            if not section.strip():
                continue

            # Add back the "Tweet #" prefix for parsing
            tweet_block = "Tweet #" + section.strip()
            tweet = parse_tweet_block(tweet_block)
            if tweet:
                tweets.append(tweet)

    except FileNotFoundError:
        print(f"RTF file not found: {rtf_file_path}")
        return []
    except Exception as e:
        print(f"Error parsing RTF file: {e}")
        return []

    return tweets

def parse_tweet_block(block):
    """Parse a single tweet block to extract structured data"""
    tweet = {}

    try:
        # The block now starts with "Tweet #" so we need to find the actual content
        # Look for the ID line which comes after the separator
        lines = block.split('\n')

        # Find the ID line
        id_line = None
        for line in lines:
            if line.startswith('ID:'):
                id_line = line
                break

        if not id_line:
            return None

        # Extract ID
        id_match = re.search(r'ID:\s*(\d+)', block)
        if id_match:
            tweet['id'] = id_match.group(1)

        # Extract Date
        date_match = re.search(r'Date:\s*([^\n]+)', block)
        if date_match:
            tweet['date'] = date_match.group(1).strip()

        # Extract Author
        author_match = re.search(r'Author:\s*([^\n]+)', block)
        if author_match:
            tweet['author'] = author_match.group(1).strip()

        # Extract Status
        status_match = re.search(r'Status:\s*([^\n]+)', block)
        if status_match:
            tweet['status'] = status_match.group(1).strip()

        # Extract Text (between "Text:" and "Metrics:")
        text_start = block.find('Text:')
        metrics_start = block.find('Metrics:')

        if text_start != -1 and metrics_start != -1:
            text_content = block[text_start + 5:metrics_start].strip()
            # Debug: Show raw text before processing
            print(f"DEBUG Raw text: {repr(text_content[:100])}")
            # Clean up RTF Unicode escapes using proper decoding function
            text_content = decode_unicode_escapes(text_content)
            # Clean up extra whitespace and line breaks
            text_content = re.sub(r'\s+', ' ', text_content)
            text_content = text_content.strip()
            print(f"DEBUG Processed text: {repr(text_content[:100])}")
            tweet['text'] = text_content

        # Extract Metrics
        metrics = {}
        metrics_match = re.search(r'Metrics:\s*\n(.*?)(?=\n\n|\nURLs:|\nMentions:|\nHashtags:|$)', block, re.DOTALL)
        if metrics_match:
            metrics_text = metrics_match.group(1)
            for line in metrics_text.split('\n'):
                line = line.strip()
                if ': ' in line:
                    key, value = line.split(': ', 1)
                    try:
                        metrics[key.lower()] = int(value)
                    except ValueError:
                        metrics[key.lower()] = value

        tweet['metrics'] = metrics
        tweet['engagement'] = metrics.get('likes', 0) + metrics.get('retweets', 0) + metrics.get('replies', 0)

        # Extract URLs
        urls = []
        urls_match = re.search(r'URLs:\s*\n(.*?)(?=\n\n|\nMentions:|\nHashtags:|$)', block, re.DOTALL)
        if urls_match:
            urls_text = urls_match.group(1)
            for line in urls_text.split('\n'):
                line = line.strip()
                if line.startswith('https://'):
                    urls.append(line)

        tweet['urls'] = urls

        # Extract Mentions
        mentions = []
        mentions_match = re.search(r'Mentions:\s*([^\n]+)', block)
        if mentions_match:
            mentions_text = mentions_match.group(1)
            mentions = [m.strip() for m in mentions_text.split(',') if m.strip()]

        tweet['mentions'] = mentions

        # Extract Hashtags
        hashtags = []
        hashtags_match = re.search(r'Hashtags:\s*([^\n]+)', block)
        if hashtags_match:
            hashtags_text = hashtags_match.group(1)
            hashtags = [h.strip() for h in hashtags_text.split(',') if h.strip()]

        tweet['hashtags'] = hashtags

        # Only return tweet if it has text
        if 'text' in tweet and tweet['text']:
            return tweet

    except Exception as e:
        print(f"Error parsing tweet block: {e}")
        return None

    return None

def detect_social_context(text):
    """Step 1: Detect social context keywords in text"""
    social_keywords = [
        'समाज', 'संगठन', 'संघ', 'समिति', 'महासभा', 'सम्मेलन',
        'मिलन', 'सम्मान', 'जयंती', 'उत्सव', 'कार्यक्रम', 'समारोह',
        'अधिवेशन', 'सभा', 'मंच', 'परिषद', 'सभा', 'जलसा',
        'महोत्सव', 'मेला', 'त्योहार', 'उद्घाटन', 'शुभारंभ'
    ]

    found_keywords = []
    for keyword in social_keywords:
        if keyword in text:
            found_keywords.append(keyword)

    return found_keywords

def extract_society_names(text):
    """Step 2: Extract society/community names from text"""
    society_names = []

    # Common society name patterns in Hindi
    society_patterns = [
        r'([अ-ह]+)\s*समाज',  # Name + समाज
        r'([अ-ह]+)\s*संगठन',  # Name + संगठन
        r'([अ-ह]+)\s*संघ',    # Name + संघ
        r'([अ-ह]+)\s*समिति',  # Name + समिति
        r'([अ-ह]+)\s*महासभा', # Name + महासभा
        r'([अ-ह]+)\s*परिषद',  # Name + परिषद
        r'([अ-ह]+)\s*सभा',    # Name + सभा
    ]

    # Known society names in Chhattisgarh context
    known_societies = [
        'साहू समाज', 'यादव समाज', 'तेली समाज', 'गोंड समाज', 'बंजारा समाज',
        'कुर्मी समाज', 'सोनवानी समाज', 'धोबी समाज', 'नाई समाज', 'लोहार समाज',
        'ताम्रकार समाज', 'सुनार समाज', 'गुरू समाज', 'पंडित समाज', 'महंत समाज',
        'रावत समाज', 'सिंह समाज', 'बघेल समाज', 'सिंहदेव समाज', 'खरे समाज',
        'पवार समाज', 'देशमुख समाज', 'पाटिल समाज', 'गायकवाड समाज', 'जाधव समाज'
    ]

    # Check for known societies first
    for society in known_societies:
        if society in text:
            society_names.append({
                'name': society,
                'type': 'known_society',
                'confidence': 'high'
            })

    # Extract using patterns
    for pattern in society_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            society_name = match.strip() + ' समाज'  # Add समाज suffix for consistency

            # Clean up the name
            society_name = re.sub(r'[^\u0900-\u097F\s]', '', society_name)
            society_name = re.sub(r'\s+', ' ', society_name).strip()

            # Skip if too short or common words
            if len(society_name) < 3 or society_name in ['के समाज', 'की समाज', 'का समाज']:
                continue

            # Check if not already found
            if not any(s['name'] == society_name for s in society_names):
                society_names.append({
                    'name': society_name,
                    'type': 'pattern_extracted',
                    'confidence': 'medium'
                })

    return society_names

def identify_event_instances(tweets):
    """Step 3: Identify unique event instances from tweets"""
    events = []
    event_counter = Counter()

    for tweet in tweets:
        text = tweet['text']
        date = tweet.get('date', '2025-01-01')

        # Detect social context
        social_keywords = detect_social_context(text)
        if not social_keywords:
            continue

        # Extract society names
        societies = extract_society_names(text)

        # Create event signature (combination of societies, date, and key context)
        event_signature = {
            'societies': [s['name'] for s in societies],
            'date': date,
            'keywords': social_keywords,
            'location': extract_location_from_text(text),
            'main_activity': extract_main_activity(text)
        }

        # Create a unique key for this event
        event_key = f"{','.join(sorted(event_signature['societies']))}_{date}_{event_signature.get('location', '')}"

        # Check if this event already exists
        existing_event = None
        for event in events:
            if event['signature_key'] == event_key:
                existing_event = event
                break

        if existing_event:
            # Add tweet to existing event
            existing_event['tweets'].append(tweet)
            existing_event['total_engagement'] += tweet.get('engagement', 0)
        else:
            # Create new event
            new_event = {
                'id': len(events) + 1,
                'signature_key': event_key,
                'societies': societies,
                'date': date,
                'location': event_signature.get('location'),
                'main_activity': event_signature.get('main_activity'),
                'keywords_found': social_keywords,
                'tweets': [tweet],
                'total_engagement': tweet.get('engagement', 0),
                'tweet_count': 1
            }
            events.append(new_event)

        # Count event types
        for society in societies:
            event_counter[society['name']] += 1

    return events, event_counter

def extract_location_from_text(text):
    """Extract location information from tweet text"""
    # Simple location extraction - can be enhanced
    location_keywords = ['रायगढ़', 'रायपुर', 'बिलासपुर', 'जांजगीर', 'कोरबा', 'अंबिकापुर']
    for location in location_keywords:
        if location in text:
            return location
    return None

def extract_main_activity(text):
    """Extract main activity from tweet text"""
    activities = ['सम्मेलन', 'मिलन', 'सम्मान', 'जयंती', 'उत्सव', 'कार्यक्रम', 'समारोह']
    for activity in activities:
        if activity in text:
            return activity
    return 'सामान्य कार्यक्रम'

def analyze_social_context(tweets):
    """Main analysis function for social context"""
    print("🔍 समाज संदर्भ विश्लेषण शुरू...")
    print("="*80)

    # Step 1: Context Detection
    print("\n1️⃣ समाज संदर्भ पहचान (Context Detection)")
    context_tweets = []
    keyword_counter = Counter()

    for tweet in tweets:
        keywords = detect_social_context(tweet['text'])
        if keywords:
            context_tweets.append({
                'tweet': tweet,
                'keywords': keywords
            })
            for keyword in keywords:
                keyword_counter[keyword] += 1

    print(f"सामाजिक संदर्भ वाले ट्वीट्स: {len(context_tweets)}")
    print(f"कुल कीवर्ड उल्लेख: {sum(keyword_counter.values())}")

    print("\nशीर्ष समाज संदर्भ कीवर्ड:")
    for keyword, count in keyword_counter.most_common(10):
        print(f"  {keyword}: {count}")

    # Step 2: Entity Extraction
    print("\n2️⃣ समाज नाम पहचान (Entity Extraction)")
    all_societies = []
    society_counter = Counter()

    for item in context_tweets:
        societies = extract_society_names(item['tweet']['text'])
        if societies:
            all_societies.extend(societies)
            for society in societies:
                society_counter[society['name']] += 1

    print(f"पहचाने गए समाज: {len(set(s['name'] for s in all_societies))}")
    print(f"कुल समाज उल्लेख: {len(all_societies)}")

    print("\nशीर्ष समाज:")
    for society, count in society_counter.most_common(10):
        print(f"  {society}: {count}")

    # Step 3: Event Instance Extraction
    print("\n3️⃣ कार्यक्रम पहचान (Event Instance Extraction)")
    events, event_counter = identify_event_instances(tweets)

    print(f"अद्वितीय कार्यक्रम: {len(events)}")
    print(f"कार्यक्रम सहित ट्वीट्स: {sum(len(event['tweets']) for event in events)}")

    print("\nकार्यक्रम प्रकार वितरण:")
    activity_counter = Counter()
    for event in events:
        activity_counter[event['main_activity']] += 1

    for activity, count in activity_counter.most_common():
        print(f"  {activity}: {count}")

    return {
        'context_tweets': context_tweets,
        'societies': all_societies,
        'events': events,
        'keyword_counter': dict(keyword_counter),
        'society_counter': dict(society_counter),
        'event_counter': dict(event_counter),
        'summary_stats': {
            'total_tweets': len(tweets),
            'context_tweets': len(context_tweets),
            'unique_societies': len(set(s['name'] for s in all_societies)),
            'total_society_mentions': len(all_societies),
            'unique_events': len(events),
            'event_tweets': sum(len(event['tweets']) for event in events)
        }
    }

def print_detailed_analysis(results):
    """Print detailed analysis results"""
    print("\n" + "="*80)
    print("📊 विस्तृत समाज विश्लेषण रिपोर्ट")
    print("="*80)

    # Summary statistics
    stats = results['summary_stats']
    print(f"\n📈 सारांश आँकड़े:")
    print(f"कुल ट्वीट्स: {stats['total_tweets']}")
    print(f"सामाजिक संदर्भ ट्वीट्स: {stats['context_tweets']} ({stats['context_tweets']/stats['total_tweets']*100:.1f}%)")
    print(f"अद्वितीय समाज: {stats['unique_societies']}")
    print(f"समाज उल्लेख: {stats['total_society_mentions']}")
    print(f"अद्वितीय कार्यक्रम: {stats['unique_events']}")
    print(f"कार्यक्रम ट्वीट्स: {stats['event_tweets']}")

    # Top societies
    print(f"\n🏛️ शीर्ष 10 समाज:")
    for i, (society, count) in enumerate(results['society_counter'].items(), 1):
        if i > 10:
            break
        print(f"{i:2d}. {society}: {count}")

    # Event details
    print(f"\n🎪 कार्यक्रम विवरण:")
    for event in results['events'][:10]:  # Show first 10 events
        societies = [s['name'] for s in event['societies']]
        print(f"कार्यक्रम {event['id']}: {', '.join(societies)} - {event['main_activity']} ({event['tweet_count']} ट्वीट्स)")

def save_analysis_results(results, output_file='social_context_analysis.json'):
    """Save analysis results to JSON file"""
    # Convert to JSON-serializable format
    serializable_results = {
        'summary_stats': results['summary_stats'],
        'keyword_counter': results['keyword_counter'],
        'society_counter': results['society_counter'],
        'event_counter': results['event_counter'],
        'events': [{
            'id': event['id'],
            'societies': [s['name'] for s in event['societies']],
            'date': event['date'],
            'location': event['location'],
            'main_activity': event['main_activity'],
            'keywords_found': event['keywords_found'],
            'tweet_count': event['tweet_count'],
            'total_engagement': event['total_engagement']
        } for event in results['events']],
        'societies': [{
            'name': s['name'],
            'type': s['type'],
            'confidence': s['confidence']
        } for s in results['societies']]
    }

    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(serializable_results, f, ensure_ascii=False, indent=2)
        print(f"\n💾 विश्लेषण सहेजा गया: {output_file}")
    except UnicodeEncodeError:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(serializable_results, f, ensure_ascii=True, indent=2)
        print(f"\n💾 विश्लेषण सहेजा गया (ASCII): {output_file}")

def main():
    """Main execution function"""
    print("🧱 समाज संदर्भ और कार्यक्रम विश्लेषण")
    print("Analytics Dashboard - Section C")
    print("="*80)

    # Find RTF file
    rtf_files = [f for f in os.listdir('.') if f.endswith('.rtf')]
    if not rtf_files:
        print("❌ कोई RTF फाइल नहीं मिली")
        return

    rtf_file = rtf_files[0]  # Use first RTF file
    print(f"📄 ट्वीट फाइल: {rtf_file}")

    # Load tweets
    tweets = load_tweets_from_rtf(rtf_file)
    print(f"✅ लोड किए गए ट्वीट्स: {len(tweets)}")

    if not tweets:
        print("❌ कोई ट्वीट नहीं मिला")
        return

    # Debug: Print first few tweets to check text extraction
    print("\n🔍 डिबग: पहले 3 ट्वीट्स की जांच")
    for i, tweet in enumerate(tweets[:3]):
        print(f"\nट्वीट {i+1}:")
        print(f"  ID: {tweet.get('id', 'N/A')}")
        print(f"  Text: {tweet.get('text', 'N/A')[:200]}...")
        print(f"  Has text: {'text' in tweet}")

    # Perform analysis
    results = analyze_social_context(tweets)

    # Print detailed results
    print_detailed_analysis(results)

    # Save results
    save_analysis_results(results)

    print("\n" + "="*80)
    print("✅ समाज संदर्भ विश्लेषण पूरा - डैशबोर्ड के लिए तैयार")
    print("="*80)

if __name__ == "__main__":
    main()