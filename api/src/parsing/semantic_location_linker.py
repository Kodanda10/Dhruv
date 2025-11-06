"""
Semantic Location Linker

Integrates semantic vector search with deterministic location matching for improved
location extraction accuracy, especially for Hindi location names and transliterations.
"""

import json
import os
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Set
import numpy as np

# Add parent directory to path for imports
import sys
sys.path.append(str(Path(__file__).parent.parent / 'api'))

try:
    from sentence_transformers import SentenceTransformer
    from pymilvus import MilvusClient
except ImportError as e:
    print(f"Missing required packages: {e}")
    print("Install with: pip install sentence-transformers pymilvus numpy")
    sys.exit(1)


class SemanticLocationLinker:
    """
    Semantic location linker that combines deterministic matching with vector search.

    Uses Milvus vector database for semantic similarity search of location names,
    particularly effective for Hindi locations and their various transliterations.
    """

    def __init__(self,
                 embedding_model: str = 'paraphrase-MiniLM-L6-v2',
                 milvus_uri: str = None,
                 collection_name: str = 'geography_embeddings',
                 similarity_threshold: float = 0.7):
        """
        Initialize semantic location linker.

        Args:
            embedding_model: Sentence transformer model name
            milvus_uri: Milvus connection URI
            collection_name: Milvus collection name for geography embeddings
            similarity_threshold: Minimum similarity score for matches
        """
        self.embedding_model_name = embedding_model
        self.milvus_uri = milvus_uri or os.getenv('MILVUS_URI', 'http://localhost:19530')
        self.collection_name = collection_name
        self.similarity_threshold = similarity_threshold

        # Initialize components
        self._init_embedding_model()
        self._init_milvus_client()

        print("✅ Semantic Location Linker initialized")

    def _init_embedding_model(self):
        """Initialize sentence transformer model."""
        try:
            self.embedding_model = SentenceTransformer(self.embedding_model_name)
            print(f"✅ Embedding model loaded: {self.embedding_model_name}")
        except Exception as e:
            raise RuntimeError(f"Failed to load embedding model: {e}")

    def _init_milvus_client(self):
        """Initialize Milvus client and verify collection."""
        try:
            self.client = MilvusClient(uri=self.milvus_uri)
            print(f"✅ Connected to Milvus: {self.milvus_uri}")

            # Verify collection exists
            if not self.client.has_collection(collection_name=self.collection_name):
                raise RuntimeError(f"Collection '{self.collection_name}' not found. Run generate_geography_embeddings.py first.")

            # Load collection
            self.client.load_collection(collection_name=self.collection_name)
            print(f"✅ Collection loaded: {self.collection_name}")

        except Exception as e:
            raise RuntimeError(f"Failed to initialize Milvus client: {e}")

    def find_semantic_matches(self,
                            query_text: str,
                            limit: int = 5,
                            min_score: Optional[float] = None) -> List[Dict]:
        """
        Find semantically similar locations using vector search.

        Args:
            query_text: Location name or description to search for
            limit: Maximum number of results to return
            min_score: Minimum similarity score (overrides instance threshold)

        Returns:
            List of matching locations with similarity scores
        """
        if not query_text or not query_text.strip():
            return []

        threshold = min_score if min_score is not None else self.similarity_threshold

        try:
            # Generate embedding for query
            query_embedding = self.embedding_model.encode(
                query_text.strip(),
                convert_to_tensor=False
            ).tolist()

            # Search in Milvus
            search_results = self.client.search(
                collection_name=self.collection_name,
                data=[query_embedding],
                anns_field="embedding",
                limit=limit * 2,  # Get more results for filtering
                output_fields=["location_name", "location_type", "district", "block", "state", "variants"],
                search_params={"metric_type": "COSINE"}
            )

            matches = []
            for result in search_results[0]:  # First (and only) query result
                score = result['distance']  # Cosine similarity

                if score >= threshold:
                    entity = result['entity']

                    # Parse variants
                    variants = []
                    if entity.get('variants'):
                        try:
                            variants = json.loads(entity['variants'])
                        except:
                            variants = []

                    matches.append({
                        'name': entity['location_name'],
                        'type': entity['location_type'],
                        'district': entity.get('district', ''),
                        'block': entity.get('block', ''),
                        'state': entity.get('state', ''),
                        'similarity_score': round(score, 3),
                        'variants': variants,
                        'source': 'semantic_search'
                    })

            # Sort by similarity score
            matches.sort(key=lambda x: x['similarity_score'], reverse=True)
            return matches[:limit]

        except Exception as e:
            print(f"Warning: Semantic search failed for '{query_text}': {e}")
            return []

    def enhance_location_matches(self,
                               text: str,
                               deterministic_matches: List[Dict],
                               semantic_boost: float = 0.1) -> List[Dict]:
        """
        Enhance deterministic location matches with semantic search results.

        Args:
            text: Original text being analyzed
            deterministic_matches: Matches from deterministic location matcher
            semantic_boost: Boost factor for semantic matches

        Returns:
            Enhanced list of location matches
        """
        if not text or not text.strip():
            return deterministic_matches

        enhanced_matches = list(deterministic_matches)  # Copy
        existing_names = {match['name'].lower() for match in deterministic_matches}

        # Extract potential location phrases from text
        location_phrases = self._extract_location_phrases(text)

        for phrase in location_phrases:
            if len(phrase.split()) > 3:  # Skip very long phrases
                continue

            # Skip if we already have a deterministic match for this phrase
            if phrase.lower() in existing_names:
                continue

            # Find semantic matches
            semantic_matches = self.find_semantic_matches(phrase, limit=3)

            for match in semantic_matches:
                # Boost confidence for semantic matches
                boosted_match = dict(match)
                boosted_match['confidence'] = min(1.0, match.get('similarity_score', 0) + semantic_boost)
                boosted_match['match_type'] = 'semantic'

                # Avoid duplicates
                if not any(m['name'].lower() == match['name'].lower() for m in enhanced_matches):
                    enhanced_matches.append(boosted_match)

        # Sort by confidence
        enhanced_matches.sort(key=lambda x: x.get('confidence', 0), reverse=True)

        return enhanced_matches

    def _extract_location_phrases(self, text: str) -> List[str]:
        """
        Extract potential location phrases from text.

        Args:
            text: Input text

        Returns:
            List of potential location phrases
        """
        if not text:
            return []

        # Tokenize and find word sequences
        words = re.findall(r'[\w\u0900-\u097F]+', text)

        phrases = set()

        # Generate phrases of different lengths
        for length in [1, 2, 3]:
            for i in range(len(words) - length + 1):
                phrase = ' '.join(words[i:i+length])
                if len(phrase) > 2:  # Skip very short phrases
                    phrases.add(phrase)

        return list(phrases)

    def get_location_context(self, location_name: str) -> Optional[Dict]:
        """
        Get detailed context information for a location.

        Args:
            location_name: Name of the location

        Returns:
            Location context information or None if not found
        """
        matches = self.find_semantic_matches(location_name, limit=1, min_score=0.8)

        if matches:
            match = matches[0]
            return {
                'name': match['name'],
                'type': match['type'],
                'district': match['district'],
                'block': match['block'],
                'state': match['state'],
                'variants': match['variants'],
                'confidence': match['similarity_score']
            }

        return None


class LocationMatcherWithSemantics:
    """
    Enhanced location matcher that combines deterministic and semantic approaches.
    """

    def __init__(self, semantic_linker: Optional[SemanticLocationLinker] = None):
        """
        Initialize enhanced location matcher.

        Args:
            semantic_linker: Optional semantic location linker instance
        """
        # Import here to avoid circular imports
        from .location_matcher import LocationMatcher

        self.deterministic_matcher = LocationMatcher()
        self.semantic_linker = semantic_linker

        if semantic_linker:
            print("✅ Location matcher enhanced with semantic search")
        else:
            print("⚠️  Location matcher running in deterministic mode only")

    def extract_locations(self, text: str, min_confidence: float = 0.5) -> List[Dict]:
        """
        Extract locations using both deterministic and semantic matching.

        Args:
            text: Input text
            min_confidence: Minimum confidence threshold

        Returns:
            List of matched locations
        """
        # Get deterministic matches
        deterministic_matches = self.deterministic_matcher.extract_locations(text, min_confidence)

        # Enhance with semantic search if available
        if self.semantic_linker:
            enhanced_matches = self.semantic_linker.enhance_location_matches(
                text, deterministic_matches
            )

            # Filter by confidence
            final_matches = [m for m in enhanced_matches if m.get('confidence', 0) >= min_confidence]
            return final_matches

        return deterministic_matches


# Convenience functions
def create_semantic_linker(milvus_uri: str = None) -> SemanticLocationLinker:
    """
    Create a semantic location linker instance.

    Args:
        milvus_uri: Milvus connection URI

    Returns:
        Configured SemanticLocationLinker instance
    """
    return SemanticLocationLinker(milvus_uri=milvus_uri)


def create_enhanced_matcher(milvus_uri: str = None) -> LocationMatcherWithSemantics:
    """
    Create an enhanced location matcher with semantic capabilities.

    Args:
        milvus_uri: Milvus connection URI

    Returns:
        Enhanced location matcher
    """
    try:
        semantic_linker = create_semantic_linker(milvus_uri)
        return LocationMatcherWithSemantics(semantic_linker)
    except Exception as e:
        print(f"Warning: Could not initialize semantic linker: {e}")
        print("Falling back to deterministic matching only")
        return LocationMatcherWithSemantics()


if __name__ == '__main__':
    # Test the semantic linker
    try:
        linker = create_semantic_linker()

        # Test semantic search
        test_queries = [
            "रायगढ़",
            "raigarh",
            "बिलासपुर",
            "korba",
            "अमबिकापुर"
        ]

        print("\n🧪 Testing Semantic Location Search:")
        for query in test_queries:
            matches = linker.find_semantic_matches(query, limit=2)
            if matches:
                top_match = matches[0]
                print(f"✅ '{query}' → {top_match['name']} (score: {top_match['similarity_score']})")
            else:
                print(f"❌ '{query}' → No matches found")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        print("Make sure Milvus is running and embeddings are generated")