"""
Location Matcher for Tweet Parsing

Matches location mentions in tweets against geography datasets:
- Districts, blocks, villages in Chhattisgarh
- Major cities across India
- Assembly constituencies and parliamentary constituencies

Returns matched locations with confidence scores.
"""

import re
import json
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from .normalization import fold_nukta, translit_basic, expand_hinglish_variants

# Optional semantic enhancement
try:
    from .semantic_location_linker import SemanticLocationLinker
    SEMANTIC_AVAILABLE = True
except ImportError:
    SEMANTIC_AVAILABLE = False
    SemanticLocationLinker = None


class LocationMatcher:
    """Matches location mentions against geography datasets"""
    
    def __init__(self, data_dir: Optional[Path] = None, enable_semantic: bool = True):
        """
        Initialize location matcher with geography data.
        
        Args:
            data_dir: Path to data directory (defaults to project data/)
            enable_semantic: Whether to enable semantic search enhancement
        """
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent.parent / 'data'
        
        self.data_dir = Path(data_dir)
        
        # Load geography datasets
        self.cg_geography = self._load_cg_geography()
        self.cities = self._load_cities()
        self.constituencies = self._load_constituencies()
        
        # Build location index for fast matching
        self.location_index = self._build_location_index()
        
        # Initialize semantic linker if available and enabled
        self.semantic_linker = None
        if enable_semantic and SEMANTIC_AVAILABLE:
            try:
                self.semantic_linker = SemanticLocationLinker()
                print("✅ Semantic location search enabled")
            except Exception as e:
                print(f"⚠️  Semantic search unavailable: {e}")
        elif enable_semantic and not SEMANTIC_AVAILABLE:
            print("⚠️  Semantic search libraries not available")
    
    def _load_cg_geography(self) -> List[Dict]:
        """Load Chhattisgarh geography dataset."""
        cg_file = self.data_dir / 'chhattisgarh_geography_enhanced.ndjson'
        
        if not cg_file.exists():
            return []
        
        locations = []
        with open(cg_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    locations.append(json.loads(line))
        
        return locations
    
    def _load_cities(self) -> List[Dict]:
        """Load major cities dataset."""
        # For now, hardcode major cities
        # TODO: Load from dataset file
        return [
            {'name': 'दिल्ली', 'name_en': 'Delhi', 'type': 'city', 'state': 'Delhi'},
            {'name': 'मुंबई', 'name_en': 'Mumbai', 'type': 'city', 'state': 'Maharashtra'},
            {'name': 'रायपुर', 'name_en': 'Raipur', 'type': 'city', 'state': 'Chhattisgarh'},
            {'name': 'रायगढ़', 'name_en': 'Raigarh', 'type': 'city', 'state': 'Chhattisgarh'},
            {'name': 'बिलासपुर', 'name_en': 'Bilaspur', 'type': 'city', 'state': 'Chhattisgarh'},
            {'name': 'दुर्ग', 'name_en': 'Durg', 'type': 'city', 'state': 'Chhattisgarh'},
            {'name': 'भिलाई', 'name_en': 'Bhilai', 'type': 'city', 'state': 'Chhattisgarh'},
        ]
    
    def _load_constituencies(self) -> List[Dict]:
        """Load constituency dataset."""
        const_file = self.data_dir / 'constituencies.json'
        
        if not const_file.exists():
            return []
        
        try:
            with open(const_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    # Extract constituencies from nested structure
                    constituencies = []
                    for district, info in data.items():
                        if isinstance(info, dict) and 'constituencies' in info:
                            for const in info['constituencies']:
                                constituencies.append({
                                    'name': const,
                                    'district': district,
                                    'type': 'assembly_constituency',
                                    'state': 'Chhattisgarh',
                                })
                    return constituencies
        except Exception as e:
            print(f"Error loading constituencies: {e}")
            return []
        
        return []
    
    def _build_location_index(self) -> Dict[str, List[Dict]]:
        """
        Build searchable index of locations with variants.
        
        Returns:
            dict mapping normalized names to location records
        """
        index = {}
        
        # Index CG geography
        for loc in self.cg_geography:
            variants = self._generate_variants(loc.get('name', ''))
            for variant in variants:
                if variant not in index:
                    index[variant] = []
                index[variant].append({
                    **loc,
                    'source': 'cg_geography',
                })
        
        # Index cities
        for city in self.cities:
            # Hindi name variants
            if 'name' in city:
                variants = self._generate_variants(city['name'])
                for variant in variants:
                    if variant not in index:
                        index[variant] = []
                    index[variant].append({
                        **city,
                        'source': 'cities',
                    })
            
            # English name variants
            if 'name_en' in city:
                en_variants = self._generate_variants(city['name_en'])
                for variant in en_variants:
                    if variant not in index:
                        index[variant] = []
                    index[variant].append({
                        **city,
                        'source': 'cities',
                    })
        
        # Index constituencies
        for const in self.constituencies:
            variants = self._generate_variants(const.get('name', ''))
            for variant in variants:
                if variant not in index:
                    index[variant] = []
                index[variant].append({
                    **const,
                    'source': 'constituencies',
                })
        
        return index
    
    def _generate_variants(self, name: str) -> List[str]:
        """
        Generate all possible variants of a location name.
        
        Args:
            name: Location name
        
        Returns:
            List of normalized variants
        """
        if not name or not name.strip():
            return []
        
        variants = set()
        
        # Original
        variants.add(name.lower().strip())
        
        # Nukta-folded
        folded = fold_nukta(name).lower().strip()
        variants.add(folded)
        
        # Transliterated
        if any('\u0900' <= c <= '\u097F' for c in name):  # Contains Hindi
            translit = translit_basic(folded).lower().strip()
            variants.add(translit)
            
            # Hinglish variants
            hinglish = expand_hinglish_variants(translit)
            variants.update(v.lower().strip() for v in hinglish)
        
        # Remove empty strings
        variants.discard('')
        
        return list(variants)
    
    def extract_locations(self, text: str, min_confidence: float = 0.5) -> List[Dict]:
        """
        Extract all location mentions from text.
        
        Args:
            text: Input text
            min_confidence: Minimum confidence threshold
        
        Returns:
            List of matched locations with confidence scores
        """
        if not text or not text.strip():
            return []
        
        # Get deterministic matches
        deterministic_matches = self._extract_locations_deterministic(text, min_confidence)
        
        # Enhance with semantic search if available
        if self.semantic_linker:
            enhanced_matches = self.semantic_linker.enhance_location_matches(
                text, deterministic_matches
            )
            # Filter by confidence again after enhancement
            final_matches = [m for m in enhanced_matches if m.get('confidence', 0) >= min_confidence]
            return final_matches
        
        return deterministic_matches
    
    def _extract_locations_deterministic(self, text: str, min_confidence: float = 0.5) -> List[Dict]:
        """
        Extract locations using deterministic matching only.
        
        Args:
            text: Input text
            min_confidence: Minimum confidence threshold
        
        Returns:
            List of matched locations
        """
        # Tokenize text (simple word-based)
        words = re.findall(r'[\w\u0900-\u097F]+', text)
        
        matches = []
        matched_positions = set()
        
        # Try matching word sequences (up to 3 words)
        for length in [3, 2, 1]:
            for i in range(len(words) - length + 1):
                # Skip if this position was already matched
                if any(i + j in matched_positions for j in range(length)):
                    continue
                
                phrase = ' '.join(words[i:i+length])
                phrase_variants = self._generate_variants(phrase)
                
                for variant in phrase_variants:
                    if variant in self.location_index:
                        for loc in self.location_index[variant]:
                            # Calculate confidence based on match quality
                            confidence = self._calculate_confidence(
                                phrase, variant, loc
                            )
                            
                            if confidence >= min_confidence:
                                matches.append({
                                    'name': loc.get('name', phrase),
                                    'name_en': loc.get('name_en', ''),
                                    'type': loc.get('type', 'unknown'),
                                    'confidence': round(confidence, 2),
                                    'state': loc.get('state', ''),
                                    'district': loc.get('district', ''),
                                    'block': loc.get('block', ''),
                                    'assembly_constituency': loc.get('assembly_constituency', ''),
                                })
                                
                                # Mark positions as matched
                                for j in range(length):
                                    matched_positions.add(i + j)
                                
                                break  # Stop after first match for this phrase
        
        # Deduplicate matches
        unique_matches = []
        seen = set()
        
        for match in matches:
            key = (match['name'], match['type'])
            if key not in seen:
                seen.add(key)
                unique_matches.append(match)
        
        # Sort by confidence
        unique_matches.sort(key=lambda x: x['confidence'], reverse=True)
        
        return unique_matches
    
    def _calculate_confidence(
        self,
        original_phrase: str,
        matched_variant: str,
        location_record: Dict,
    ) -> float:
        """
        Calculate confidence score for a location match.
        
        Args:
            original_phrase: Original phrase from text
            matched_variant: Variant that matched
            location_record: Location record from index
        
        Returns:
            Confidence score (0.0 to 1.0)
        """
        confidence = 0.7  # Base confidence
        
        # Exact match boost
        if original_phrase.lower() == location_record.get('name', '').lower():
            confidence += 0.2
        
        # Source boost (prefer official datasets)
        if location_record.get('source') == 'cg_geography':
            confidence += 0.1
        
        # Cap at 1.0
        return min(confidence, 1.0)


# Convenience function
def extract_locations_from_text(text: str) -> List[Dict]:
    """
    Extract locations from text using default matcher.
    
    Args:
        text: Input text
    
    Returns:
        List of matched locations
    """
    matcher = LocationMatcher()
    return matcher.extract_locations(text)

