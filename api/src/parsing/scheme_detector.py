"""
Scheme Detector for Tweet Parsing

Detects mentions of government schemes in tweets:
- Central schemes (PM schemes)
- State schemes (CM schemes, Chhattisgarh-specific)
- Custom scheme patterns

Returns detected schemes with confidence scores.
"""

import re
from typing import List, Dict, Tuple, Optional
from .normalization import fold_nukta


class SchemeDetector:
    """Detects government scheme mentions in text"""
    
    def __init__(self):
        # Government scheme patterns
        self.scheme_patterns = {
            # Central schemes (PM schemes)
            'pm_awas_yojana': {
                'keywords': [
                    'प्रधानमंत्री आवास योजना', 'pmay', 'pm awas', 'आवास योजना',
                    'pradhan mantri awas yojana',
                ],
                'type': 'central',
                'weight': 1.0,
            },
            'pm_kisan': {
                'keywords': [
                    'पीएम किसान', 'pm kisan', 'pm-kisan', 'किसान सम्मान निधि',
                    'pradhan mantri kisan samman nidhi',
                ],
                'type': 'central',
                'weight': 1.0,
            },
            'pm_ujjwala': {
                'keywords': [
                    'उज्ज्वला', 'ujjwala', 'pm ujjwala', 'प्रधानमंत्री उज्ज्वला',
                ],
                'type': 'central',
                'weight': 1.0,
            },
            'pm_jandhan': {
                'keywords': [
                    'जन धन', 'jan dhan', 'pm jan dhan', 'प्रधानमंत्री जन धन',
                ],
                'type': 'central',
                'weight': 1.0,
            },
            'ayushman_bharat': {
                'keywords': [
                    'आयुष्मान भारत', 'ayushman bharat', 'ayushman',
                ],
                'type': 'central',
                'weight': 1.0,
            },
            
            # State schemes (Chhattisgarh)
            'cm_kisan_samman': {
                'keywords': [
                    'मुख्यमंत्री किसान सम्मान', 'cm kisan', 'राज्य किसान सम्मान',
                ],
                'type': 'state',
                'weight': 0.9,
            },
            'godhan_nyay': {
                'keywords': [
                    'गोधन न्याय', 'godhan nyay', 'गोधन',
                ],
                'type': 'state',
                'weight': 0.9,
            },
            'rajiv_gandhi_kisan': {
                'keywords': [
                    'राजीव गांधी किसान', 'rajiv gandhi kisan',
                ],
                'type': 'state',
                'weight': 0.9,
            },
            
            # Generic patterns
            'generic_pm_scheme': {
                'keywords': [
                    'प्रधानमंत्री योजना', 'pm scheme', 'pradhan mantri yojana',
                ],
                'type': 'central',
                'weight': 0.7,
            },
            'generic_cm_scheme': {
                'keywords': [
                    'मुख्यमंत्री योजना', 'cm scheme', 'mukhyamantri yojana',
                ],
                'type': 'state',
                'weight': 0.7,
            },
        }
        
        # Compile patterns
        self._compile_patterns()
    
    def _compile_patterns(self):
        """Compile regex patterns for each scheme."""
        self.patterns = {}
        
        for scheme_name, info in self.scheme_patterns.items():
            # Create regex pattern from keywords
            keywords = [re.escape(kw) for kw in info['keywords']]
            pattern = '|'.join(keywords)
            self.patterns[scheme_name] = {
                'pattern': re.compile(
                    f'({pattern})',
                    re.IGNORECASE | re.UNICODE,
                ),
                'type': info['type'],
                'weight': info['weight'],
            }
    
    def detect(
        self,
        text: str,
        min_confidence: float = 0.6,
    ) -> List[Dict[str, any]]:
        """
        Detect government schemes mentioned in text.
        
        Args:
            text: Input text
            min_confidence: Minimum confidence threshold
        
        Returns:
            List of detected schemes with confidence scores
        """
        if not text or not text.strip():
            return []
        
        # Normalize text
        normalized = fold_nukta(text.lower())
        
        detected = []
        
        for scheme_name, info in self.patterns.items():
            pattern = info['pattern']
            matches = pattern.findall(normalized)
            
            if matches:
                # Calculate confidence
                confidence = info['weight']
                
                # Boost confidence if multiple mentions
                if len(matches) > 1:
                    confidence = min(confidence + 0.1, 1.0)
                
                if confidence >= min_confidence:
                    detected.append({
                        'scheme_name': scheme_name,
                        'scheme_type': info['type'],
                        'confidence': round(confidence, 2),
                        'mentions': len(matches),
                        'matched_text': list(set(matches)),
                    })
        
        # Sort by confidence
        detected.sort(key=lambda x: x['confidence'], reverse=True)
        
        return detected
    
    def detect_batch(
        self,
        texts: List[str],
        min_confidence: float = 0.6,
    ) -> List[List[Dict[str, any]]]:
        """
        Detect schemes in multiple texts.
        
        Args:
            texts: List of input texts
            min_confidence: Minimum confidence threshold
        
        Returns:
            List of detection results (one per text)
        """
        return [
            self.detect(text, min_confidence=min_confidence)
            for text in texts
        ]


# Convenience function
def detect_schemes(text: str) -> List[Dict[str, any]]:
    """
    Detect government schemes in text using default detector.
    
    Args:
        text: Input text
    
    Returns:
        List of detected schemes
    """
    detector = SchemeDetector()
    return detector.detect(text)

