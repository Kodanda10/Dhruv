"""
Parsing Orchestrator

Orchestrates the complete tweet parsing pipeline:
1. Text preprocessing (language detection, cleaning, normalization)
2. Event classification (type + confidence)
3. Location extraction (geography matching)
4. Date extraction (event date)
5. Entity extraction (people, organizations)
6. Scheme detection
7. Confidence calculation
8. Review flagging (low confidence → needs review)

Returns structured ParsedEvent ready for database insertion.
"""

import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from .preprocessor import TextPreprocessor
from .location_matcher import LocationMatcher
from .event_classifier import EventClassifier
from .scheme_detector import SchemeDetector


class ParsingOrchestrator:
    """Orchestrates the complete parsing pipeline"""
    
    def __init__(self):
        self.preprocessor = TextPreprocessor()
        self.location_matcher = LocationMatcher()
        self.event_classifier = EventClassifier()
        self.scheme_detector = SchemeDetector()
        
        # Date patterns (Hindi and English)
        self.date_patterns = [
            # DD/MM/YYYY or DD-MM-YYYY
            r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})',
            # आज, कल, etc.
            r'(आज|कल|परसों)',
            r'(today|tomorrow|yesterday)',
        ]
        
        # Compile patterns
        self.compiled_date_patterns = [
            re.compile(p, re.IGNORECASE | re.UNICODE)
            for p in self.date_patterns
        ]
    
    def parse_tweet(
        self,
        tweet_id: str,
        text: str,
        created_at: datetime,
        tweet_date: datetime,
    ) -> Dict[str, any]:
        """
        Parse a single tweet through the complete pipeline.
        
        Args:
            tweet_id: Tweet ID
            text: Tweet text
            created_at: Tweet creation timestamp
            tweet_date: Tweet posting date
        
        Returns:
            Parsed event dict ready for database insertion
        """
        if not text or not text.strip():
            return self._create_empty_result(tweet_id)
        
        # Step 1: Preprocessing
        preprocessed = self.preprocessor.preprocess(text)
        
        # Step 2: Event classification
        classification = self.event_classifier.classify(
            preprocessed['normalized']
        )
        
        # Step 3: Location extraction
        locations = self.location_matcher.extract_locations(
            preprocessed['normalized']
        )
        
        # Step 4: Date extraction
        event_date, date_confidence = self._extract_event_date(
            preprocessed['normalized'],
            tweet_date,
        )
        
        # Step 5: Entity extraction (people, organizations)
        entities = self._extract_entities(
            preprocessed['normalized'],
            preprocessed['entities']
        )
        
        # Step 6: Scheme detection
        schemes = self.scheme_detector.detect(
            preprocessed['normalized']
        )
        
        # Step 7: Calculate overall confidence
        overall_confidence = self._calculate_overall_confidence(
            classification_conf=classification['confidence'],
            date_conf=date_confidence,
            location_conf=max([loc['confidence'] for loc in locations], default=0.0),
            has_entities=len(entities['people']) > 0 or len(entities['organizations']) > 0,
        )
        
        # Step 8: Determine if review is needed
        needs_review = overall_confidence < 0.7
        
        # Build result
        return {
            'tweet_id': tweet_id,
            'event_type': classification['event_type'],
            'event_type_confidence': classification['confidence'],
            'event_date': event_date.isoformat() if event_date else None,
            'date_confidence': date_confidence,
            'locations': self._format_locations(locations),
            'people_mentioned': entities['people'],
            'organizations': entities['organizations'],
            'schemes_mentioned': [s['scheme_name'] for s in schemes],
            'overall_confidence': overall_confidence,
            'needs_review': needs_review,
            'review_status': 'pending',
            'parsed_by': 'orchestrator_v1',
            
            # Metadata for debugging
            '_metadata': {
                'language': preprocessed['language'],
                'classification_keywords': classification.get('matched_keywords', []),
                'scheme_details': schemes,
                'hashtags': preprocessed['entities']['hashtags'],
                'mentions': preprocessed['entities']['mentions'],
            },
        }
    
    def _extract_event_date(
        self,
        text: str,
        tweet_date: datetime,
    ) -> Tuple[Optional[datetime], float]:
        """
        Extract event date from text.
        
        Args:
            text: Normalized text
            tweet_date: Tweet posting date (fallback)
        
        Returns:
            (event_date, confidence) tuple
        """
        # Try pattern matching
        for pattern in self.compiled_date_patterns:
            match = pattern.search(text)
            if match:
                try:
                    # Handle relative dates
                    relative = match.group(1).lower()
                    if relative in ['आज', 'today']:
                        return (tweet_date, 0.9)
                    elif relative in ['कल', 'tomorrow']:
                        return (tweet_date + timedelta(days=1), 0.8)
                    elif relative in ['yesterday']:
                        return (tweet_date - timedelta(days=1), 0.8)
                    elif relative in ['परसों']:
                        return (tweet_date - timedelta(days=2), 0.7)
                    
                    # Handle explicit dates (DD/MM/YYYY)
                    if len(match.groups()) >= 3:
                        day = int(match.group(1))
                        month = int(match.group(2))
                        year = int(match.group(3))
                        
                        # Handle 2-digit years
                        if year < 100:
                            year += 2000
                        
                        event_date = datetime(year, month, day)
                        return (event_date, 0.95)
                        
                except (ValueError, IndexError):
                    continue
        
        # Default: assume same day as tweet
        return (tweet_date, 0.6)
    
    def _extract_entities(
        self,
        text: str,
        preprocessed_entities: Dict[str, List[str]],
    ) -> Dict[str, List[str]]:
        """
        Extract people and organizations mentioned.
        
        Args:
            text: Normalized text
            preprocessed_entities: Entities from preprocessing
        
        Returns:
            dict with people and organizations lists
        """
        people = []
        organizations = []
        
        # Use mentions as people (remove @ prefix)
        mentions = preprocessed_entities.get('mentions', [])
        people.extend(mentions)
        
        # Common organization patterns
        org_patterns = [
            r'(भाजपा|bjp)',
            r'(कांग्रेस|congress)',
            r'(सरकार|government)',
            r'(निगम|corporation)',
            r'(समिति|committee)',
            r'(संस्था|organisation|organization)',
        ]
        
        for pattern in org_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE | re.UNICODE)
            organizations.extend(matches)
        
        # Deduplicate
        people = list(set(people))
        organizations = list(set(organizations))
        
        return {
            'people': people,
            'organizations': organizations,
        }
    
    def _calculate_overall_confidence(
        self,
        classification_conf: float,
        date_conf: float,
        location_conf: float,
        has_entities: bool,
    ) -> float:
        """
        Calculate overall parsing confidence.
        
        Args:
            classification_conf: Event classification confidence
            date_conf: Date extraction confidence
            location_conf: Location matching confidence
            has_entities: Whether entities were found
        
        Returns:
            Overall confidence score (0.0 to 1.0)
        """
        # Weighted average
        weights = {
            'classification': 0.4,
            'date': 0.2,
            'location': 0.3,
            'entities': 0.1,
        }
        
        entity_conf = 0.8 if has_entities else 0.4
        
        overall = (
            classification_conf * weights['classification'] +
            date_conf * weights['date'] +
            location_conf * weights['location'] +
            entity_conf * weights['entities']
        )
        
        return round(overall, 2)
    
    def _format_locations(self, locations: List[Dict]) -> List[Dict]:
        """
        Format locations for JSON storage.
        
        Args:
            locations: Raw location matches
        
        Returns:
            Formatted locations list
        """
        return [
            {
                'name': loc['name'],
                'name_en': loc.get('name_en', ''),
                'type': loc['type'],
                'confidence': loc['confidence'],
                'state': loc.get('state', ''),
                'district': loc.get('district', ''),
                'block': loc.get('block', ''),
                'assembly_constituency': loc.get('assembly_constituency', ''),
            }
            for loc in locations
        ]
    
    def _create_empty_result(self, tweet_id: str) -> Dict[str, any]:
        """Create empty result for invalid input."""
        return {
            'tweet_id': tweet_id,
            'event_type': 'other',
            'event_type_confidence': 0.0,
            'event_date': None,
            'date_confidence': 0.0,
            'locations': [],
            'people_mentioned': [],
            'organizations': [],
            'schemes_mentioned': [],
            'overall_confidence': 0.0,
            'needs_review': True,
            'review_status': 'pending',
            'parsed_by': 'orchestrator_v1',
        }
    
    def parse_batch(
        self,
        tweets: List[Dict[str, any]],
    ) -> List[Dict[str, any]]:
        """
        Parse multiple tweets.
        
        Args:
            tweets: List of tweet dicts with id, text, created_at
        
        Returns:
            List of parsed events
        """
        results = []
        
        for tweet in tweets:
            try:
                result = self.parse_tweet(
                    tweet_id=tweet['id'],
                    text=tweet['text'],
                    created_at=tweet['created_at'],
                    tweet_date=tweet.get('tweet_date', tweet['created_at']),
                )
                results.append(result)
            except Exception as e:
                print(f"Error parsing tweet {tweet.get('id', 'unknown')}: {e}")
                results.append(self._create_empty_result(tweet.get('id', 'unknown')))
        
        return results


# Convenience function
def parse_tweet_text(tweet_id: str, text: str, created_at: datetime) -> Dict[str, any]:
    """
    Parse a single tweet using default orchestrator.
    
    Args:
        tweet_id: Tweet ID
        text: Tweet text
        created_at: Tweet timestamp
    
    Returns:
        Parsed event dict
    """
    orchestrator = ParsingOrchestrator()
    return orchestrator.parse_tweet(tweet_id, text, created_at, created_at)

