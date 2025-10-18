"""
Enhanced Parser - Combines old regex-based parsing with new AI parsing.

This parser merges the best of both worlds:
1. OLD LOGIC (parse.ts): Fast regex patterns for Hindi keywords
2. NEW LOGIC (orchestrator.py): AI-powered extraction

The result is more accurate parsing with better coverage.
"""

import re
from typing import List, Dict, Any, Optional
from datetime import datetime


class EnhancedParser:
    """Enhanced parser combining regex patterns with AI extraction."""
    
    # From old parse.ts - These work well!
    PLACE_REGEX = re.compile(
        r'(नई दिल्ली|नयी दिल्ली|रायगढ़|दिल्ली|रायपुर|भारत|छत्तीसगढ़|'
        r'खरसिया|गढ़ उमरिया|बस्तर|सरगुजा|जशपुर|बगीचा|अंतागढ़|चपले|'
        r'धर्मजयगढ़|सारंगढ़|खुजी|महाराष्ट्र|मध्य प्रदेश)',
        re.UNICODE
    )
    
    ACTION_KEYWORDS = [
        'बैठक', 'समापन', 'शिलान्यास', 'निरीक्षण', 'भूमिपूजन',
        'उद्घाटन', 'संवाद', 'जन्मदिन', 'स्वागत', 'नमन',
        'प्रार्थना', 'शुभकामनायें', 'लोकार्पण', 'समीक्षा', 'समारोह',
        'सम्मिलित', 'रैली', 'सभा', 'सम्मेलन', 'निधन', 'शोक',
        'श्रद्धांजलि', 'योजना', 'घोषणा', 'मुलाकात', 'चर्चा'
    ]
    
    # Event type mapping (Hindi keyword -> English event_type)
    EVENT_TYPE_MAP = {
        'जन्मदिन': 'birthday_wishes',
        'निधन': 'condolence',
        'शोक': 'condolence',
        'श्रद्धांजलि': 'condolence',
        'रैली': 'rally',
        'सभा': 'rally',
        'सम्मेलन': 'rally',
        'बैठक': 'meeting',
        'चर्चा': 'meeting',
        'उद्घाटन': 'inauguration',
        'शिलान्यास': 'inauguration',
        'भूमिपूजन': 'inauguration',
        'निरीक्षण': 'inspection',
        'समीक्षा': 'inspection',
        'योजना': 'scheme_announcement',
        'घोषणा': 'announcement',
        'समारोह': 'ceremony',
    }
    
    # People name patterns
    PEOPLE_PATTERN = re.compile(
        r'(?:माननीय\s+)?(?:श्री|श्रीमती|डॉ\.?|प्रो\.?)\s+([^\s,।]+(?:\s+[^\s,।]+){0,3})\s*जी?',
        re.UNICODE
    )
    
    # Organization patterns
    ORG_PATTERN = re.compile(
        r'(भारतीय जनता पार्टी|भाजपा|कांग्रेस|राज्य शासन|केंद्र सरकार|'
        r'निगम|मंडल|आयोग|बोर्ड|सरकार)',
        re.UNICODE
    )
    
    # Scheme patterns
    SCHEME_PATTERN = re.compile(
        r'(प्रधानमंत्री [^\s,।]+\s+योजना|आवास योजना|स्वास्थ्य योजना|'
        r'शिक्षा योजना|किसान योजना|उज्ज्वला योजना|आयुष्मान भारत)',
        re.UNICODE
    )
    
    # Location context pattern (e.g., "रायगढ़ में")
    # Note: Python re doesn't support \p{L}, use \w or explicit Unicode ranges
    LOCATION_CONTEXT_PATTERN = re.compile(
        r'([\u0900-\u097F\u0600-\u06FF\u0020-\u007E\s]{2,}?)\s+में',
        re.UNICODE
    )
    
    def parse_tweet(
        self,
        tweet_id: str,
        text: str,
        created_at: datetime,
        tweet_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Parse tweet using enhanced hybrid approach.
        
        Combines:
        1. Fast regex extraction (locations, people, orgs, schemes)
        2. Confidence scoring
        3. Event classification
        
        Args:
            tweet_id: Tweet ID
            text: Tweet content
            created_at: When tweet was created
            tweet_date: Date of event mentioned in tweet (optional)
        
        Returns:
            Parsed event dict matching parsed_events schema
        """
        # Extract locations
        locations = self._extract_locations(text)
        
        # Extract people
        people = self._extract_people(text)
        
        # Extract organizations
        organizations = self._extract_organizations(text)
        
        # Extract schemes
        schemes = self._extract_schemes(text)
        
        # Classify event type
        event_type, event_confidence = self._classify_event(text)
        
        # Extract date (use tweet_date if provided, else created_at)
        event_date = tweet_date if tweet_date else created_at
        date_confidence = 0.9 if tweet_date else 0.6
        
        # Calculate overall confidence
        overall_confidence = self._calculate_confidence(
            locations, people, organizations, event_type, event_confidence
        )
        
        # Determine if needs review
        needs_review = overall_confidence < 0.7
        
        # Extract topics if configured
        topics = self._extract_topics(text)

        return {
            'tweet_id': tweet_id,
            'event_type': event_type,
            'event_type_confidence': event_confidence,
            'event_date': event_date.date() if hasattr(event_date, 'date') else event_date,
            'date_confidence': date_confidence,
            'locations': [{'name': loc, 'confidence': 0.8} for loc in locations],
            'people_mentioned': people,
            'organizations': organizations,
            'schemes_mentioned': schemes,
            'topics': topics,
            'overall_confidence': overall_confidence,
            'needs_review': needs_review,
            'review_status': 'pending',
            'parsed_by': 'enhanced_parser_v1',
        }

    # ---- Topics support ----
    def set_topics(self, labels_hi: list[str], alias_map: dict[str, list[str]] | None = None) -> None:
        """Configure topic vocabulary and aliases (Hindi labels)."""
        self._topic_labels = labels_hi
        self._topic_aliases = alias_map or {}

    def _extract_topics(self, text: str) -> list[dict[str, Any]]:
        labels: list[str] = getattr(self, '_topic_labels', [])
        aliases: dict[str, list[str]] = getattr(self, '_topic_aliases', {})
        if not labels and not aliases:
            return []

        results: list[dict[str, Any]] = []
        # exact/alias match → high confidence
        suffix_keywords = ['मिशन', 'योजना', 'अभियान']
        for label in labels:
            found = False
            alias_list = aliases.get(label, [])
            for alias in alias_list:
                if not alias:
                    continue
                idx = text.find(alias)
                if idx != -1:
                    # If a suffix keyword appears shortly after alias in text, boost confidence
                    window = text[idx: idx + len(alias) + 12]
                    if any(k in window for k in suffix_keywords):
                        results.append({'label_hi': label, 'confidence': 0.9, 'source': 'alias'})
                    else:
                        results.append({'label_hi': label, 'confidence': 0.7, 'source': 'alias-partial'})
                    found = True
                    break
            if found:
                continue
            # substring/partial → medium
            tokens = label.split()
            partial = [t for t in tokens if t and t in text]
            if partial:
                results.append({'label_hi': label, 'confidence': 0.7, 'source': 'substring'})

        # dedupe by label, keep highest confidence
        best: dict[str, dict[str, Any]] = {}
        for r in results:
            cur = best.get(r['label_hi'])
            if cur is None or r['confidence'] > cur['confidence']:
                best[r['label_hi']] = r
        return list(best.values())
    
    def _extract_locations(self, text: str) -> List[str]:
        """Extract location names from text."""
        locations = set()
        
        # Direct matches from known places
        for match in self.PLACE_REGEX.finditer(text):
            locations.add(match.group(1))
        
        # Context-based extraction (e.g., "X में")
        for match in self.LOCATION_CONTEXT_PATTERN.finditer(text):
            token = match.group(1).strip()
            if len(token) >= 2:
                # Check if contains a known place
                place_match = self.PLACE_REGEX.search(token)
                if place_match:
                    locations.add(place_match.group(1))
        
        return list(locations)
    
    def _extract_people(self, text: str) -> List[str]:
        """Extract people names from text."""
        people = []
        
        for match in self.PEOPLE_PATTERN.finditer(text):
            name = match.group(1).strip()
            if name and len(name) > 2:
                people.append(name)
        
        return people
    
    def _extract_organizations(self, text: str) -> List[str]:
        """Extract organization names from text."""
        organizations = set()
        
        for match in self.ORG_PATTERN.finditer(text):
            org = match.group(1)
            organizations.add(org)
        
        return list(organizations)
    
    def _extract_schemes(self, text: str) -> List[str]:
        """Extract government scheme names from text."""
        schemes = []
        
        for match in self.SCHEME_PATTERN.finditer(text):
            scheme = match.group(1)
            schemes.append(scheme)
        
        return schemes
    
    def _classify_event(self, text: str) -> tuple[str, float]:
        """
        Classify event type based on keywords.
        
        Returns:
            (event_type, confidence)
        """
        # Check for keywords
        for keyword, event_type in self.EVENT_TYPE_MAP.items():
            if keyword in text:
                return event_type, 0.85
        
        # Check for action keywords not in map
        for keyword in self.ACTION_KEYWORDS:
            if keyword in text:
                # Generic but still useful
                return 'event', 0.60
        
        # Default fallback
        return 'other', 0.30
    
    def _calculate_confidence(
        self,
        locations: List[str],
        people: List[str],
        organizations: List[str],
        event_type: str,
        event_confidence: float,
    ) -> float:
        """Calculate overall confidence score."""
        scores = []
        
        # Event type confidence
        scores.append(event_confidence)
        
        # Location confidence (0.8 if found)
        if locations:
            scores.append(0.8)
        else:
            scores.append(0.3)
        
        # People confidence (0.7 if found)
        if people:
            scores.append(0.7)
        else:
            scores.append(0.4)
        
        # Organization confidence (0.6 if found)
        if organizations:
            scores.append(0.6)
        else:
            scores.append(0.4)
        
        # Calculate weighted average (event_type is most important)
        weights = [0.4, 0.3, 0.2, 0.1]  # Event > Location > People > Org
        weighted_sum = sum(s * w for s, w in zip(scores, weights))
        
        return round(weighted_sum, 2)


# Singleton instance
_parser_instance: Optional[EnhancedParser] = None


def get_enhanced_parser() -> EnhancedParser:
    """Get or create singleton parser instance."""
    global _parser_instance
    if _parser_instance is None:
        _parser_instance = EnhancedParser()
    return _parser_instance

