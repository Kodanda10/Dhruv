"""
Text Preprocessor for Tweet Parsing

Handles:
- Language detection (Hindi, English, Mixed)
- Text cleaning (remove URLs, mentions, hashtags if needed)
- Transliteration (Hindi ↔ Roman)
- Normalization (nukta folding, variant handling)
"""

import re
from typing import Dict, List, Tuple, Optional
from .normalization import fold_nukta, translit_basic


class TextPreprocessor:
    """Preprocesses tweet text for parsing"""
    
    def __init__(self):
        self.url_pattern = re.compile(r'https?://\S+|www\.\S+')
        self.mention_pattern = re.compile(r'@\w+')
        self.hashtag_pattern = re.compile(r'#\w+')
        
        # Hindi Unicode range
        self.hindi_pattern = re.compile(r'[\u0900-\u097F]+')
        # English pattern
        self.english_pattern = re.compile(r'[a-zA-Z]+')
    
    def detect_language(self, text: str) -> Dict[str, any]:
        """
        Detect language composition of text.
        
        Returns:
            dict with language, hindi_ratio, english_ratio, mixed
        """
        if not text or not text.strip():
            return {
                'language': 'unknown',
                'hindi_ratio': 0.0,
                'english_ratio': 0.0,
                'mixed': False,
                'confidence': 0.0,
            }
        
        # Count characters
        total_chars = len(text.strip())
        
        # Count Hindi characters
        hindi_chars = sum(len(match.group()) for match in self.hindi_pattern.finditer(text))
        hindi_ratio = hindi_chars / total_chars if total_chars > 0 else 0.0
        
        # Count English characters
        english_chars = sum(len(match.group()) for match in self.english_pattern.finditer(text))
        english_ratio = english_chars / total_chars if total_chars > 0 else 0.0
        
        # Determine language
        if hindi_ratio > 0.6:
            language = 'hindi'
            confidence = hindi_ratio
        elif english_ratio > 0.6:
            language = 'english'
            confidence = english_ratio
        elif hindi_ratio > 0.2 and english_ratio > 0.2:
            language = 'mixed'
            confidence = min(hindi_ratio + english_ratio, 1.0)
        else:
            language = 'unknown'
            confidence = 0.5
        
        return {
            'language': language,
            'hindi_ratio': round(hindi_ratio, 2),
            'english_ratio': round(english_ratio, 2),
            'mixed': hindi_ratio > 0.1 and english_ratio > 0.1,
            'confidence': round(confidence, 2),
        }
    
    def clean_text(
        self,
        text: str,
        remove_urls: bool = False,
        remove_mentions: bool = False,
        remove_hashtags: bool = False,
    ) -> str:
        """
        Clean text by removing URLs, mentions, hashtags.
        
        Args:
            text: Input text
            remove_urls: Remove URLs if True
            remove_mentions: Remove @mentions if True
            remove_hashtags: Remove #hashtags if True
        
        Returns:
            Cleaned text
        """
        cleaned = text
        
        if remove_urls:
            cleaned = self.url_pattern.sub('', cleaned)
        
        if remove_mentions:
            cleaned = self.mention_pattern.sub('', cleaned)
        
        if remove_hashtags:
            cleaned = self.hashtag_pattern.sub('', cleaned)
        
        # Normalize whitespace
        cleaned = ' '.join(cleaned.split())
        
        return cleaned.strip()
    
    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extract URLs, mentions, hashtags from text.
        
        Returns:
            dict with urls, mentions, hashtags lists
        """
        return {
            'urls': self.url_pattern.findall(text),
            'mentions': [m.strip('@') for m in self.mention_pattern.findall(text)],
            'hashtags': [h.strip('#') for h in self.hashtag_pattern.findall(text)],
        }
    
    def normalize_hindi(self, text: str) -> str:
        """
        Normalize Hindi text (nukta folding).
        
        Args:
            text: Hindi text
        
        Returns:
            Normalized text
        """
        return fold_nukta(text)
    
    def transliterate_to_roman(self, text: str) -> str:
        """
        Transliterate Hindi text to Roman script.
        
        Args:
            text: Hindi text
        
        Returns:
            Transliterated Roman text
        """
        return translit_basic(text).lower()
    
    def preprocess(
        self,
        text: str,
        clean: bool = True,
        normalize: bool = True,
    ) -> Dict[str, any]:
        """
        Complete preprocessing pipeline.
        
        Args:
            text: Input text
            clean: Apply cleaning if True
            normalize: Apply normalization if True
        
        Returns:
            dict with:
                - original: Original text
                - cleaned: Cleaned text
                - normalized: Normalized text
                - language: Language detection result
                - entities: Extracted entities
                - transliterated: Transliterated version
        """
        if not text or not text.strip():
            return {
                'original': text,
                'cleaned': '',
                'normalized': '',
                'language': self.detect_language(''),
                'entities': {'urls': [], 'mentions': [], 'hashtags': []},
                'transliterated': '',
            }
        
        # Extract entities first (before cleaning)
        entities = self.extract_entities(text)
        
        # Clean text (keep hashtags and mentions for now, remove URLs)
        cleaned = self.clean_text(text, remove_urls=True) if clean else text
        
        # Detect language
        language = self.detect_language(cleaned)
        
        # Normalize if Hindi
        normalized = cleaned
        if normalize and language['language'] in ['hindi', 'mixed']:
            normalized = self.normalize_hindi(cleaned)
        
        # Transliterate Hindi portions
        transliterated = ''
        if language['language'] in ['hindi', 'mixed']:
            # Extract Hindi parts and transliterate
            hindi_parts = self.hindi_pattern.findall(normalized)
            if hindi_parts:
                transliterated = ' '.join(self.transliterate_to_roman(part) for part in hindi_parts)
        
        return {
            'original': text,
            'cleaned': cleaned,
            'normalized': normalized,
            'language': language,
            'entities': entities,
            'transliterated': transliterated,
        }


# Convenience function
def preprocess_tweet(text: str) -> Dict[str, any]:
    """
    Preprocess a single tweet.
    
    Args:
        text: Tweet text
    
    Returns:
        Preprocessing result dict
    """
    preprocessor = TextPreprocessor()
    return preprocessor.preprocess(text)

