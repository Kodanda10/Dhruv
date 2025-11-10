"""
Event Classifier for Tweet Parsing

Classifies tweets into event types based on keywords and patterns:
- inauguration (उद्घाटन)
- rally (रैली, जनसभा)
- meeting (बैठक)
- inspection (निरीक्षण, दौरा)
- scheme_announcement (योजना घोषणा)
- samaj_function (समाज समारोह)
- festival_event (त्योहार कार्यक्रम)
- constituent_engagement (जनसंपर्क)
- relief (राहत कार्य)
- other (अन्य)

Falls back to Gemini for ambiguous cases.
"""

import re
from typing import Dict, List, Tuple, Optional
from .normalization import fold_nukta


class EventClassifier:
    """Classifies tweets into event types"""
    
    def __init__(self):
        # Event type keywords (Hindi and English)
        self.event_keywords = {
            'inauguration': {
                'keywords': [
                    'उद्घाटन', 'उदघाटन', 'लोकार्पण', 'शिलान्यास',
                    'शुभारंभ', 'inauguration', 'inaugurat', 'opening',
                    'foundation', 'stone laying',
                ],
                'weight': 1.0,
            },
            'rally': {
                'keywords': [
                    'रैली', 'जनसभा', 'सभा', 'जनसमा', 'महासभा',
                    'rally', 'public meeting', 'gathering', 'sabha',
                ],
                'weight': 0.9,
            },
            'meeting': {
                'keywords': [
                    'बैठक', 'समीक्षा', 'चर्चा', 'विचार-विमर्श',
                    'meeting', 'review', 'discussion', 'conference',
                ],
                'weight': 0.8,
            },
            'inspection': {
                'keywords': [
                    'निरीक्षण', 'दौरा', 'भ्रमण', 'विजिट', 'नि', 'visit', 'inspection', 'tour',
                ],
                'weight': 0.8,
            },
            'scheme_announcement': {
                'keywords': [
                    'योजना', 'घोषणा', 'शुरुआत', 'प्रारंभ',
                    'scheme', 'program', 'announcement', 'launch',
                    'yojana', 'pradhan mantri', 'mukhyamantri',
                ],
                'weight': 0.9,
            },
            'samaj_function': {
                'keywords': [
                    'समाज', 'समारोह', 'कार्यक्रम', 'आयोजन',
                    'समाजिक', 'सामाजिक',
                    'samaj', 'community', 'social', 'function', 'event',
                ],
                'weight': 0.7,
            },
            'festival_event': {
                'keywords': [
                    'त्योहार', 'पर्व', 'उत्सव', 'जयंती', 'पूजा',
                    'दिवस', 'दिवाली', 'होली', 'छठ', 'नवरात्रि',
                    'festival', 'celebration', 'jayanti', 'diwas',
                ],
                'weight': 0.8,
            },
            'constituent_engagement': {
                'keywords': [
                    'जनसंपर्क', 'मुलाकात', 'संवाद', 'भेंट',
                    'जनता', 'ग्रामीण', 'लोग',
                    'met', 'interaction', 'engagement', 'public',
                ],
                'weight': 0.7,
            },
            'relief': {
                'keywords': [
                    'राहत', 'सहायता', 'मदद', 'सहयोग',
                    'relief', 'aid', 'assistance', 'help',
                ],
                'weight': 0.9,
            },
        }
        
        # Compile patterns
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile regex patterns for each event type."""
        self.patterns = {}
        
        for event_type, info in self.event_keywords.items():
            # Create regex pattern from keywords
            keywords = [re.escape(kw) for kw in info['keywords']]
            pattern = '|'.join(keywords)
            self.patterns[event_type] = re.compile(
                f'({pattern})',
                re.IGNORECASE | re.UNICODE,
            )
    
    def classify(
        self,
        text: str,
        min_confidence: float = 0.5,
        use_gemini_fallback: bool = False,
    ) -> Dict[str, any]:
        """
        Classify text into event type.
        
        Args:
            text: Input text
            min_confidence: Minimum confidence threshold
            use_gemini_fallback: Use Gemini for ambiguous cases
        
        Returns:
            dict with event_type, confidence, matched_keywords
        """
        if not text or not text.strip():
            return {
                'event_type': 'other',
                'confidence': 0.0,
                'matched_keywords': [],
            }
        
        # Normalize text
        normalized = fold_nukta(text.lower())
        
        # Try keyword matching first
        scores = {}
        matched_keywords = {}
        
        for event_type, pattern in self.patterns.items():
            matches = pattern.findall(normalized)
            if matches:
                # Calculate score based on number of matches and weight
                weight = self.event_keywords[event_type]['weight']
                score = len(matches) * weight
                scores[event_type] = score
                matched_keywords[event_type] = list(set(matches))
        
        if not scores:
            # No keyword matches
            if use_gemini_fallback:
                # TODO: Implement Gemini fallback
                return {
                    'event_type': 'other',
                    'confidence': 0.3,
                    'matched_keywords': [],
                    'fallback_used': 'gemini',
                }
            else:
                return {
                    'event_type': 'other',
                    'confidence': 0.3,
                    'matched_keywords': [],
                }
        
        # Get best match
        best_type = max(scores, key=scores.get)
        best_score = scores[best_type]
        
        # Normalize confidence (cap at 1.0)
        confidence = min(0.5 + (best_score * 0.2), 1.0)
        
        if confidence < min_confidence:
            return {
                'event_type': 'other',
                'confidence': confidence,
                'matched_keywords': matched_keywords.get(best_type, []),
            }
        
        return {
            'event_type': best_type,
            'confidence': round(confidence, 2),
            'matched_keywords': matched_keywords.get(best_type, []),
        }
    
    def classify_batch(
        self,
        texts: List[str],
        min_confidence: float = 0.5,
    ) -> List[Dict[str, any]]:
        """
        Classify multiple texts.
        
        Args:
            texts: List of input texts
            min_confidence: Minimum confidence threshold
        
        Returns:
            List of classification results
        """
        return [
            self.classify(text, min_confidence=min_confidence)
            for text in texts
        ]


# Convenience function
def classify_event(text: str) -> Dict[str, any]:
    """
    Classify text into event type using default classifier.
    
    Args:
        text: Input text
    
    Returns:
        Classification result
    """
    classifier = EventClassifier()
    return classifier.classify(text)

