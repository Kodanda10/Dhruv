#!/usr/bin/env python3
"""
Detailed Village-Level Analysis for OP Choudhary visits
Extracts and analyzes specific villages mentioned in tweets
"""

import re
import json
from collections import Counter, defaultdict
from datetime import datetime

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

def parse_rtf_tweets(rtf_content):
    """Parse tweets from RTF content"""
    tweets = []

    # Split by tweet sections
    tweet_sections = re.split(r'Tweet #\d+', rtf_content)[1:]  # Skip header

    for i, section in enumerate(tweet_sections, 1):
        tweet = {}

        # Extract ID
        id_match = re.search(r'ID: (\d+)', section)
        tweet['id'] = id_match.group(1) if id_match else f'unknown_{i}'

        # Extract date
        date_match = re.search(r'Date: ([^\n]+)', section)
        tweet['date'] = date_match.group(1).strip() if date_match else 'unknown'

        # Extract author
        author_match = re.search(r'Author: (@[^\n]+)', section)
        tweet['author'] = author_match.group(1).strip() if author_match else 'unknown'

        # Extract status
        status_match = re.search(r'Status: ([^\n]+)', section)
        tweet['status'] = status_match.group(1).strip() if status_match else 'unknown'

        # Extract text (between "Text:" and "Metrics:")
        text_match = re.search(r'Text:([\s\S]*?)(?=Metrics:)', section)
        if text_match:
            text = text_match.group(1).strip()
            # Remove RTF braces and control codes first
            text = re.sub(r'[{}]', '', text)
            text = decode_unicode_escapes(text)
            # Clean up extra whitespace and line breaks
            text = re.sub(r'\s+', ' ', text)
            text = text.strip()
            tweet['text'] = text
        else:
            tweet['text'] = ''

        # Extract metrics
        likes_match = re.search(r'Likes: (\d+)', section)
        tweet['likes'] = int(likes_match.group(1)) if likes_match else 0

        replies_match = re.search(r'Replies: (\d+)', section)
        tweet['replies'] = int(replies_match.group(1)) if replies_match else 0

        retweets_match = re.search(r'Retweets: (\d+)', section)
        tweet['retweets'] = int(retweets_match.group(1)) if retweets_match else 0

        quotes_match = re.search(r'Quotes: (\d+)', section)
        tweet['quotes'] = int(quotes_match.group(1)) if quotes_match else 0

        tweet['engagement'] = tweet['likes'] + tweet['replies'] + tweet['retweets'] + tweet['quotes']

        tweets.append(tweet)

    return tweets

def extract_villages_detailed(text):
    """Extract village names with more sophisticated pattern matching"""
    villages = []

    # Look for specific village names that are commonly mentioned in Chhattisgarh
    known_villages = [
        'तुरंगा', 'पंचधार', 'कुकुर्दा', 'बासनपाली', 'पुसौर', 'कलमी',
        'खरसिया', 'धरमजयगढ़', 'गौरेला', 'मनेंद्रगढ़', 'अंतागढ़',
        'पंडरिया', 'लैलूंगा', 'बरमकला', 'कोरबा', 'कटघोरा', 'पाली',
        'मस्तूरी', 'तखतपुर', 'रतनपुर', 'कोतमा', 'बेलतरा', 'वैशाली नगर',
        'अभनपुर', 'अरंग', 'धरसीवाँ', 'गईबंद', 'भिलाई', 'पाटन', 'धमधा',
        'नवागढ़', 'गुंडरदेही', 'छुरीया', 'अंबागढ़ चौकी', 'मोहला-मानपुर',
        'कोरिया', 'बाईखर', 'जांजगीर', 'अकलतरा', 'पामगढ़', 'बलौदा',
        'सकती', 'दाभरा', 'कवर्धा', 'बोड़ला', 'कुंडी', 'महासमुंद',
        'बागबाहरा', 'सर्जा', 'पिथौरा', 'कुरूद', 'मगरलोड', 'भोथली',
        'ओरछा', 'कोयलीबेड़ा', 'भानुप्रतापपुर', 'अंतागढ़', 'भानुप्रतापपुर',
        'कोयलीबेड़ा', 'अंतागढ़', 'भानुप्रतापपुर', 'कोयलीबेड़ा'
    ]

    # Check for known villages first
    for village in known_villages:
        if village in text:
            villages.append({
                'name': village,
                'indicator': 'known_village',
                'confidence': 'high'
            })

    # Look for patterns with village indicators
    village_patterns = [
        r'ग्राम\s+([अ-ह\s]{2,25})(?:\s|$|[,।])',  # ग्राम followed by Hindi name
        r'गाँव\s+([अ-ह\s]{2,25})(?:\s|$|[,।])',   # गाँव followed by Hindi name
        r'बस्ती\s+([अ-ह\s]{2,25})(?:\s|$|[,।])',  # बस्ती followed by Hindi name
        r'([अ-ह\s]{3,20})\s*ग्राम',  # Name before ग्राम
        r'([अ-ह\s]{3,20})\s*गाँव',   # Name before गाँव
        r'([अ-ह\s]{3,20})\s*बस्ती',  # Name before बस्ती
    ]

    for pattern in village_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            village_name = match.strip()
            # Clean up the name - remove non-Hindi characters except spaces
            village_name = re.sub(r'[^\u0900-\u097F\s]', '', village_name)
            village_name = re.sub(r'\s+', ' ', village_name).strip()

            # Skip if too short or too long
            if len(village_name) < 2 or len(village_name) > 25:
                continue

            # Skip common words that might be false positives
            skip_words = ['के', 'की', 'का', 'को', 'से', 'में', 'पर', 'ने', 'है', 'था', 'थी', 'हो', 'कर', 'करके']
            if village_name.lower() in skip_words:
                continue

            # Determine indicator
            indicator = 'unknown'
            if 'ग्राम' in text[max(0, text.find(village_name)-5):text.find(village_name)+len(village_name)+5]:
                indicator = 'ग्राम'
            elif 'गाँव' in text[max(0, text.find(village_name)-5):text.find(village_name)+len(village_name)+5]:
                indicator = 'गाँव'
            elif 'बस्ती' in text[max(0, text.find(village_name)-5):text.find(village_name)+len(village_name)+5]:
                indicator = 'बस्ती'

            villages.append({
                'name': village_name,
                'indicator': indicator,
                'confidence': 'medium'
            })

    # Remove duplicates while preserving order and preferring higher confidence
    seen = {}
    for village in villages:
        key = village['name'].lower()
        if key not in seen or (seen[key]['confidence'] == 'medium' and village['confidence'] == 'high'):
            seen[key] = village

    return list(seen.values())

def analyze_village_visits(tweets):
    """Analyze village visits from tweets"""
    village_visits = []
    village_counter = Counter()
    village_details = defaultdict(lambda: {
        'visits': 0,
        'tweets': [],
        'total_engagement': 0,
        'dates': [],
        'indicators': set()
    })

    for tweet in tweets:
        if not tweet['text']:
            continue

        villages = extract_villages_detailed(tweet['text'])

        if villages:
            for village in villages:
                village_name = village['name']
                village_counter[village_name] += 1

                # Store detailed information
                village_details[village_name]['visits'] += 1
                village_details[village_name]['total_engagement'] += tweet['engagement']
                village_details[village_name]['dates'].append(tweet['date'])
                village_details[village_name]['indicators'].add(village['indicator'])

                # Store tweet preview
                preview = tweet['text'][:150] + '...' if len(tweet['text']) > 150 else tweet['text']
                village_details[village_name]['tweets'].append({
                    'id': tweet['id'],
                    'date': tweet['date'],
                    'text': preview,
                    'engagement': tweet['engagement']
                })

                village_visits.append({
                    'village': village_name,
                    'indicator': village['indicator'],
                    'confidence': village['confidence'],
                    'tweet_id': tweet['id'],
                    'date': tweet['date'],
                    'engagement': tweet['engagement'],
                    'text_preview': preview
                })

    return village_visits, village_counter, village_details

def create_village_mindmap(village_details):
    """Create mindmap structure for villages"""
    mindmap = {
        'name': 'रायगढ़ जिला ग्राम',
        'type': 'district',
        'children': []
    }

    # Sort villages by visit frequency
    sorted_villages = sorted(village_details.items(), key=lambda x: x[1]['visits'], reverse=True)

    for village_name, details in sorted_villages:
        village_node = {
            'name': village_name,
            'type': 'village',
            'visits': details['visits'],
            'total_engagement': details['total_engagement'],
            'indicators': list(details['indicators']),
            'children': []
        }

        # Add visit events as children
        for tweet in details['tweets'][:3]:  # Top 3 tweets per village
            event_node = {
                'name': f"विज़िट {tweet['date'][:10]}",
                'type': 'visit',
                'engagement': tweet['engagement'],
                'tweet_id': tweet['id'],
                'children': []
            }
            village_node['children'].append(event_node)

        mindmap['children'].append(village_node)

    return mindmap

def main():
    # Read RTF file
    with open('fetched_tweets_readable.rtf', 'r', encoding='utf-8', errors='ignore') as f:
        rtf_content = f.read()

    # Parse tweets
    tweets = parse_rtf_tweets(rtf_content)
    print(f"✅ Parsed {len(tweets)} tweets successfully")

    # Analyze village visits
    village_visits, village_counter, village_details = analyze_village_visits(tweets)

    # Create mindmap
    mindmap_data = create_village_mindmap(village_details)

    print("\n" + "="*80)
    print("🏘️ ग्राम/गाँव विज़िट विश्लेषण - OP CHOUDHARY")
    print("VILLAGE VISITS ANALYSIS - MINDMAP VIEW")
    print("="*80)

    print(f"\n📊 ग्राम कवरेज आँकड़े (Village Coverage Statistics)")
    total_tweets = len(tweets)
    tweets_with_villages = len(set(visit['tweet_id'] for visit in village_visits))
    unique_villages = len(village_counter)

    print(f"कुल ट्वीट्स: {total_tweets:,}")
    print(f"ग्राम उल्लेख ट्वीट्स: {tweets_with_villages:,}")
    print(f"ग्राम कवरेज प्रतिशत: {(tweets_with_villages/total_tweets*100):.1f}%")
    print(f"अद्वितीय ग्राम: {unique_villages:,}")

    print(f"\n🏘️ शीर्ष 20 ग्राम विज़िट (Top 20 Village Visits)")
    print("-" * 60)
    print(f"{'ग्राम नाम':<25} {'विज़िट':<8} {'एंगेजमेंट':<12} {'इंडिकेटर'}")
    print("-" * 60)

    for village, count in village_counter.most_common(20):
        details = village_details[village]
        total_engagement = details['total_engagement']
        indicators = ', '.join(list(details['indicators'])[:2])  # Show top 2 indicators
        print(f"{village:<25} {count:<8} {total_engagement:<12} {indicators}")

    print(f"\n🌳 माइंडमैप संरचना (Mindmap Structure)")
    print(f"रायगढ़ जिला ग्राम ({len(mindmap_data['children'])} ग्राम)")
    for i, village in enumerate(mindmap_data['children'][:10], 1):  # Show top 10
        print(f"  ├── {village['name']} ({village['visits']} विज़िट)")
        for j, visit in enumerate(village['children'][:2], 1):  # Show 2 visits per village
            print(f"      ├── {visit['name']} (एंगेजमेंट: {visit['engagement']})")

    print(f"\n📅 ग्रामवार विज़िट टाइमलाइन (Village Visit Timeline)")
    # Group by month
    monthly_visits = defaultdict(lambda: defaultdict(int))
    for visit in village_visits:
        try:
            date = datetime.strptime(visit['date'], '%Y-%m-%d %H:%M:%S')
            month_key = f"{date.year}-{date.month:02d}"
            monthly_visits[month_key][visit['village']] += 1
        except:
            pass

    if monthly_visits:
        print("मासिक ग्राम विज़िट सारांश:")
        for month in sorted(monthly_visits.keys(), reverse=True)[:6]:  # Last 6 months
            villages_in_month = monthly_visits[month]
            total_visits = sum(villages_in_month.values())
            top_village = max(villages_in_month.items(), key=lambda x: x[1])
            print(f"  {month}: {total_visits} विज़िट, शीर्ष ग्राम: {top_village[0]} ({top_village[1]}x)")

    print(f"\n🎯 ग्राम विज़िट अंतर्दृष्टि (Village Visit Insights)")
    if village_counter:
        most_visited = village_counter.most_common(1)[0]
        print(f"सबसे अधिक विज़िट ग्राम: {most_visited[0]} ({most_visited[1]} बार)")

        avg_visits_per_village = sum(village_counter.values()) / len(village_counter)
        print(f"प्रति ग्राम औसत विज़िट: {avg_visits_per_village:.1f}")

        # Engagement analysis
        high_engagement_villages = [(v, d['total_engagement']) for v, d in village_details.items()]
        high_engagement_villages.sort(key=lambda x: x[1], reverse=True)

        if high_engagement_villages:
            top_engagement = high_engagement_villages[0]
            print(f"सर्वाधिक एंगेजमेंट ग्राम: {top_engagement[0]} ({top_engagement[1]} एंगेजमेंट)")

    print(f"\n📋 ग्राम प्रकार वितरण (Village Type Distribution)")
    indicator_counts = Counter()
    for visit in village_visits:
        indicator_counts[visit['indicator']] += 1

    for indicator, count in indicator_counts.most_common():
        pct = (count / len(village_visits)) * 100
        print(f"{indicator}: {count} ({pct:.1f}%)")

    print(f"\n🏘️ विस्तृत ग्राम सूची (Detailed Village List)")
    print("-" * 80)
    for village, count in village_counter.most_common(15):
        details = village_details[village]
        recent_visit = max(details['dates']) if details['dates'] else 'unknown'
        total_engagement = details['total_engagement']
        indicators = list(details['indicators'])

        print(f"🏘️ {village}")
        print(f"   विज़िट: {count} | एंगेजमेंट: {total_engagement} | अंतिम विज़िट: {recent_visit[:10]}")
        print(f"   इंडिकेटर: {', '.join(indicators)}")
        try:
            # Handle Unicode encoding issues
            tweet_text = details['tweets'][0]['text'][:100]
            # Replace problematic characters
            tweet_text = tweet_text.encode('utf-8', errors='replace').decode('utf-8')
            print(f"   हालिया ट्वीट: {tweet_text}...")
        except (UnicodeEncodeError, UnicodeDecodeError):
            print(f"   हालिया ट्वीट: [Unicode text - {len(details['tweets'][0]['text'])} chars]...")
        print()

    # Save detailed data
    output_data = {
        'village_visits': village_visits,
        'village_counter': dict(village_counter),
        'village_details': dict(village_details),
        'mindmap': mindmap_data,
        'summary_stats': {
            'total_tweets': len(tweets),
            'tweets_with_villages': tweets_with_villages,
            'unique_villages': unique_villages,
            'total_visits': len(village_visits)
        }
    }

    try:
        with open('village_visits_analysis.json', 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2, default=str)
    except UnicodeEncodeError:
        with open('village_visits_analysis.json', 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=True, indent=2, default=str)

    print(f"\n💾 विस्तृत ग्राम डेटा 'village_visits_analysis.json' में सहेजा गया")
    print("="*80)
    print("✅ ग्राम विज़िट विश्लेषण पूरा - माइंडमैप के लिए तैयार")
    print("="*80)

if __name__ == "__main__":
    main()