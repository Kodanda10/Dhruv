from datetime import datetime
from api.src.parsing.enhanced_parser import EnhancedParser


def make_parser_with_topics():
    p = EnhancedParser()
    # Define tags and aliases (Hindi)
    tags = ['स्वच्छ भारत मिशन', 'जल जीवन मिशन']
    aliases = {
        'स्वच्छ भारत मिशन': ['स्वच्छ भारत', 'स्वच्छता अभियान'],
        'जल जीवन मिशन': ['जल जीवन'],
    }
    p.set_topics(tags, aliases)
    return p


def test_extract_topics_exact_alias_match_scores_high():
    parser = make_parser_with_topics()
    text = 'आज स्वच्छ भारत अभियान के अंतर्गत विशेष कार्यक्रम आयोजित किया।'
    out = parser.parse_tweet(tweet_id='1', text=text, created_at=datetime.utcnow())
    topics = out.get('topics', [])
    assert any(t['label_hi'] == 'स्वच्छ भारत मिशन' for t in topics)
    # exact/alias match should be high confidence
    conf = next(t['confidence'] for t in topics if t['label_hi'] == 'स्वच्छ भारत मिशन')
    assert conf >= 0.85


def test_extract_topics_substring_match_scores_medium():
    parser = make_parser_with_topics()
    text = 'गाँव में जल जीवन के कार्यों की समीक्षा की गई।'
    out = parser.parse_tweet(tweet_id='2', text=text, created_at=datetime.utcnow())
    topics = out.get('topics', [])
    assert any(t['label_hi'] == 'जल जीवन मिशन' for t in topics)
    conf = next(t['confidence'] for t in topics if t['label_hi'] == 'जल जीवन मिशन')
    assert 0.6 <= conf < 0.85


