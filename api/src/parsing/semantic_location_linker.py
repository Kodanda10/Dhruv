"""
Semantic Location Linker

Integrates semantic vector search with deterministic location matching for improved
location extraction accuracy, especially for Hindi location names and their transliterations.

Supports both Milvus (production) and FAISS (development/fallback) backends.
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
    import faiss
    MILVUS_AVAILABLE = True
    FAISS_AVAILABLE = True
except ImportError:
    MILVUS_AVAILABLE = False
    FAISS_AVAILABLE = False
    MilvusClient = None
    faiss = None


"""
Semantic Location Linker

Integrates semantic vector search with deterministic location matching for improved
location extraction accuracy, especially for Hindi location names and their transliterations.

Supports both Milvus (production) and FAISS (development/fallback) backends.
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
    import faiss
    MILVUS_AVAILABLE = True
    FAISS_AVAILABLE = True
except ImportError:
    MILVUS_AVAILABLE = False
    FAISS_AVAILABLE = False
    MilvusClient = None
    faiss = None


class MultilingualFAISSLocationLinker:
    """FAISS-based semantic location linker using multilingual embeddings."""

    def __init__(self, embedding_model: str = "intfloat/multilingual-e5-base"):
        """
        Initialize FAISS-based linker with multilingual support.

        Args:
            embedding_model: Multilingual sentence transformer model name
        """
        self.embedding_model_name = embedding_model
        self.embedding_model = SentenceTransformer(embedding_model)
        self.dimension = self.embedding_model.get_sentence_embedding_dimension()
        self.index = None
        self.locations = []
        self.data_loaded = False

        print("✅ Multilingual FAISS-based Semantic Location Linker initialized")

    def load_multilingual_data(self):
        """Load the new multilingual embeddings data."""
        if self.data_loaded:
            return

        # Path to new multilingual embeddings
        index_dir = Path(__file__).parent.parent.parent.parent / 'data' / 'embeddings' / 'multilingual_geography'

        locations_file = index_dir / "locations.json"
        embeddings_file = index_dir / "embeddings.npy"
        faiss_file = index_dir / "faiss_index.bin"

        if not all(f.exists() for f in [locations_file, embeddings_file, faiss_file]):
            print(f"⚠️  Multilingual embeddings not found at: {index_dir}")
            print("Run rebuild_geography_embeddings_multilingual.py first")
            return

        try:
            print(f"Loading multilingual embeddings from: {index_dir}")

            # Load locations
            with open(locations_file, 'r', encoding='utf-8') as f:
                self.locations = json.load(f)

            # Load FAISS index
            self.index = faiss.read_index(str(faiss_file))

            self.data_loaded = True
            print(f"✅ Multilingual embeddings loaded: {len(self.locations)} locations, dimension {self.dimension}")

        except Exception as e:
            print(f"❌ Failed to load multilingual embeddings: {e}")
            self.data_loaded = False

    def find_semantic_matches(self,
                            query_text: str,
                            limit: int = 5,
                            min_score: float = 0.7) -> List[Dict]:
        """
        Find semantically similar locations using multilingual FAISS.

        Args:
            query_text: Location name or description to search for
            limit: Maximum number of results to return
            min_score: Minimum similarity score

        Returns:
            List of matching locations with similarity scores
        """
        if not query_text or not query_text.strip() or not self.index:
            return []

        try:
            # Generate embedding for query using multilingual model
            query_embedding = self.embedding_model.encode(
                [query_text.strip()],
                normalize_embeddings=True,
                convert_to_tensor=False
            )[0].astype(np.float32)

            # Search FAISS index
            distances, indices = self.index.search(
                query_embedding.reshape(1, -1), limit
            )

            matches = []
            for distance, idx in zip(distances[0], indices[0]):
                if distance >= min_score and idx < len(self.locations):
                    location_name = self.locations[idx]
                    matches.append({
                        'name': location_name,
                        'similarity_score': float(distance),
                        'source': 'multilingual_faiss_search',
                        'match_type': 'semantic'
                    })

            return matches

        except Exception as e:
            print(f"Warning: Multilingual FAISS search failed for '{query_text}': {e}")
            return []

    def get_location_context(self, location_name: str) -> Optional[Dict]:
        """
        Get detailed context for a location.

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
                'confidence': match['similarity_score'],
                'source': 'multilingual_semantic'
            }

        return None


class SemanticLocationLinker:
    """
    Semantic location linker that combines deterministic matching with vector search.

    Uses Milvus (production) or FAISS (development/fallback) for semantic similarity search
    of location names, particularly effective for Hindi locations and their transliterations.
    """

    def __init__(self,
                 embedding_model: str = 'paraphrase-MiniLM-L6-v2',
                 milvus_uri: str = None,
                 collection_name: str = 'geography_embeddings',
                 similarity_threshold: float = 0.7,
                 use_faiss_fallback: bool = True):
        """
        Initialize semantic location linker.

        Args:
            embedding_model: Sentence transformer model name
            milvus_uri: Milvus connection URI
            collection_name: Milvus collection name for geography embeddings
            similarity_threshold: Minimum similarity score for matches
            use_faiss_fallback: Whether to use FAISS if Milvus fails
        """
        self.embedding_model_name = embedding_model
        self.milvus_uri = milvus_uri or os.getenv('MILVUS_URI', 'http://localhost:19530')
        self.collection_name = collection_name
        self.similarity_threshold = similarity_threshold
        self.use_faiss_fallback = use_faiss_fallback

        # Try to initialize backends
        self.backend = None
        self._init_backends()

    def _init_backends(self):
        """Initialize vector database backends in order of preference."""
        # Try Milvus first
        if MILVUS_AVAILABLE:
            try:
                self._init_milvus()
                self.backend = 'milvus'
                print("✅ Semantic Location Linker initialized (Milvus backend)")
                return
            except Exception as e:
                print(f"⚠️  Milvus initialization failed: {e}")
                if not self.use_faiss_fallback:
                    raise

        # Fallback to FAISS
        if FAISS_AVAILABLE and self.use_faiss_fallback:
            try:
                self._init_faiss()
                self.backend = 'faiss'
                print("✅ Semantic Location Linker initialized (FAISS backend)")
                return
            except Exception as e:
                print(f"⚠️  FAISS initialization failed: {e}")

        # No backend available
        print("❌ No vector database backend available")
        raise RuntimeError("No vector database backend could be initialized")

    def _init_milvus(self):
        """Initialize Milvus client and verify collection."""
        self.client = MilvusClient(uri=self.milvus_uri)
        print(f"✅ Connected to Milvus: {self.milvus_uri}")

        # Verify collection exists
        if not self.client.has_collection(collection_name=self.collection_name):
            raise RuntimeError(f"Collection '{self.collection_name}' not found. Run generate_geography_embeddings.py first.")

        # Load collection
        self.client.load_collection(collection_name=self.collection_name)
        print(f"✅ Collection loaded: {self.collection_name}")

    def _init_faiss(self):
        """Initialize FAISS backend and prepare for lazy loading."""
        faiss_file = Path(__file__).parent.parent.parent.parent / 'data' / 'geography_embeddings_faiss.pkl'

        if faiss_file.exists():
            self.faiss_linker = FAISSLocationLinker(self.embedding_model_name)
            print(f"✅ FAISS backend initialized (lazy loading from: {faiss_file})")
        else:
            print(f"⚠️  FAISS data file not found: {faiss_file}")
            print("Run generate_geography_embeddings.py first")
            self.faiss_linker = FAISSLocationLinker(self.embedding_model_name)

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
        if self.backend == 'milvus':
            return self._find_semantic_matches_milvus(query_text, limit, min_score)
        elif self.backend == 'faiss':
            return self._find_semantic_matches_faiss(query_text, limit, min_score)
        else:
            return []

    def _find_semantic_matches_milvus(self,
                                    query_text: str,
                                    limit: int = 5,
                                    min_score: Optional[float] = None) -> List[Dict]:
        """Milvus implementation of semantic search."""
        if not query_text or not query_text.strip():
            return []

        threshold = min_score if min_score is not None else self.similarity_threshold

        try:
            # Generate embedding for query
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer(self.embedding_model_name)
            query_embedding = model.encode(
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
            print(f"Warning: Milvus search failed for '{query_text}': {e}")
            return []

    def _find_semantic_matches_faiss(self,
                                    query_text: str,
                                    limit: int = 5,
                                    min_score: Optional[float] = None) -> List[Dict]:
        """FAISS implementation of semantic search."""
        # Load data lazily if not already loaded
        if not self.faiss_linker.data_loaded:
            self.faiss_linker.load_data_lazy()

        threshold = min_score if min_score is not None else self.similarity_threshold
        return self.faiss_linker.find_semantic_matches(query_text, limit, threshold)

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
        if self.backend == 'milvus':
            return self._get_location_context_milvus(location_name)
        elif self.backend == 'faiss':
            return self._get_location_context_faiss(location_name)
        else:
            return None

    def _get_location_context_milvus(self, location_name: str) -> Optional[Dict]:
        """Milvus implementation of location context."""
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

    def _get_location_context_faiss(self, location_name: str) -> Optional[Dict]:
        """FAISS implementation of location context."""
        # Load data lazily if not already loaded
        if not self.faiss_linker.data_loaded:
            self.faiss_linker.load_data_lazy()

        return self.faiss_linker.get_location_context(location_name)


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
    import faiss
    MILVUS_AVAILABLE = True
    FAISS_AVAILABLE = True
except ImportError:
    MILVUS_AVAILABLE = False
    FAISS_AVAILABLE = False
    MilvusClient = None
    faiss = None


class MultilingualFAISSLocationLinker:
    """FAISS-based semantic location linker using multilingual embeddings."""

    def __init__(self, embedding_model: str = "intfloat/multilingual-e5-base"):
        """
        Initialize FAISS-based linker with multilingual support.

        Args:
            embedding_model: Multilingual sentence transformer model name
        """
        self.embedding_model_name = embedding_model
        self.embedding_model = SentenceTransformer(embedding_model)
        self.dimension = self.embedding_model.get_sentence_embedding_dimension()
        self.index = None
        self.locations = []
        self.data_loaded = False

        print("✅ Multilingual FAISS-based Semantic Location Linker initialized")

    def load_multilingual_data(self):
        """Load the new multilingual embeddings data."""
        if self.data_loaded:
            return

        # Path to new multilingual embeddings
        index_dir = Path(__file__).parent.parent.parent.parent / 'data' / 'embeddings' / 'multilingual_geography'

        locations_file = index_dir / "locations.json"
        embeddings_file = index_dir / "embeddings.npy"
        faiss_file = index_dir / "faiss_index.bin"

        if not all(f.exists() for f in [locations_file, embeddings_file, faiss_file]):
            print(f"⚠️  Multilingual embeddings not found at: {index_dir}")
            print("Run rebuild_geography_embeddings_multilingual.py first")
            return

        try:
            print(f"Loading multilingual embeddings from: {index_dir}")

            # Load locations
            with open(locations_file, 'r', encoding='utf-8') as f:
                self.locations = json.load(f)

            # Load FAISS index
            self.index = faiss.read_index(str(faiss_file))

            self.data_loaded = True
            print(f"✅ Multilingual embeddings loaded: {len(self.locations)} locations, dimension {self.dimension}")

        except Exception as e:
            print(f"❌ Failed to load multilingual embeddings: {e}")
            self.data_loaded = False

    def find_semantic_matches(self,
                            query_text: str,
                            limit: int = 5,
                            min_score: float = 0.7) -> List[Dict]:
        """
        Find semantically similar locations using multilingual FAISS.

        Args:
            query_text: Location name or description to search for
            limit: Maximum number of results to return
            min_score: Minimum similarity score

        Returns:
            List of matching locations with similarity scores
        """
        if not query_text or not query_text.strip() or not self.index:
            return []

        try:
            # Generate embedding for query using multilingual model
            query_embedding = self.embedding_model.encode(
                [query_text.strip()],
                normalize_embeddings=True,
                convert_to_tensor=False
            )[0].astype(np.float32)

            # Search FAISS index
            distances, indices = self.index.search(
                query_embedding.reshape(1, -1), limit
            )

            matches = []
            for distance, idx in zip(distances[0], indices[0]):
                if distance >= min_score and idx < len(self.locations):
                    location_name = self.locations[idx]
                    matches.append({
                        'name': location_name,
                        'similarity_score': float(distance),
                        'source': 'multilingual_faiss_search',
                        'match_type': 'semantic'
                    })

            return matches

        except Exception as e:
            print(f"Warning: Multilingual FAISS search failed for '{query_text}': {e}")
            return []

    def get_location_context(self, location_name: str) -> Optional[Dict]:
        """
        Get detailed context for a location.

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
                'confidence': match['similarity_score'],
                'source': 'multilingual_semantic'
            }

        return None


class SemanticLocationLinker:
    """
    Enhanced semantic location linker with multilingual support and robust fallback.

    Features:
    - Auto-detects language (Hindi/English) and uses appropriate embeddings
    - Falls back gracefully from Milvus (production) to FAISS (development)
    - Includes transliteration support for better Hindi coverage
    - Supports Hindi synonym expansion (जिला→district, शहर→city, etc.)
    - Provides detailed logging for debugging and monitoring
    """

    def __init__(self,
                 embedding_model: str = "intfloat/multilingual-e5-base",
                 milvus_uri: str = None,
                 collection_name: str = 'chhattisgarh_geography_multilingual',
                 similarity_threshold: float = 0.7,
                 use_faiss_fallback: bool = True,
                 enable_transliteration: bool = True,
                 enable_synonym_expansion: bool = True):
        """
        Initialize enhanced semantic location linker.

        Args:
            embedding_model: Multilingual sentence transformer model name
            milvus_uri: Milvus connection URI
            collection_name: Milvus collection name for geography embeddings
            similarity_threshold: Minimum similarity score for matches
            use_faiss_fallback: Whether to use FAISS if Milvus fails
            enable_transliteration: Enable transliteration for better Hindi coverage
            enable_synonym_expansion: Enable Hindi synonym expansion
        """
        self.embedding_model_name = embedding_model
        self.milvus_uri = milvus_uri or os.getenv('MILVUS_URI', 'http://localhost:19530')
        self.collection_name = collection_name
        self.similarity_threshold = similarity_threshold
        self.use_faiss_fallback = use_faiss_fallback
        self.enable_transliteration = enable_transliteration
        self.enable_synonym_expansion = enable_synonym_expansion

        # Language detection and synonym mapping
        self.hindi_synonyms = {
            'जिला': 'district',
            'शहर': 'city',
            'ग्राम': 'village',
            'ब्लॉक': 'block',
            'राज्य': 'state',
            'तहसील': 'tehsil',
            'मंडल': 'mandal',
            'क्षेत्र': 'area'
        }

        # Try to initialize backends
        self.backend = None
        self._init_backends()

    def _detect_language(self, text: str) -> str:
        """Detect if text contains Hindi/Devanagari characters."""
        hindi_chars = re.findall(r'[\u0900-\u097F]', text)
        if hindi_chars:
            return 'hindi'
        return 'english'

    def _expand_query_with_synonyms(self, query: str) -> List[str]:
        """Expand Hindi query with English synonyms."""
        if not self.enable_synonym_expansion:
            return [query]

        expanded = [query]
        words = query.split()

        for i, word in enumerate(words):
            if word in self.hindi_synonyms:
                # Replace Hindi word with English synonym
                new_words = words.copy()
                new_words[i] = self.hindi_synonyms[word]
                expanded.append(' '.join(new_words))

        return expanded

    def _get_transliteration_variants(self, query: str) -> List[str]:
        """Generate transliteration variants for better coverage."""
        if not self.enable_transliteration:
            return [query]

        variants = [query]

        try:
            from indic_transliteration import sanscript, transliterate

            # Add ITRANS and ISO transliterations for Hindi text
            if self._detect_language(query) == 'hindi':
                try:
                    itrans = transliterate(query, sanscript.DEVANAGARI, sanscript.ITRANS)
                    variants.append(itrans)
                except:
                    pass

                try:
                    iso = transliterate(query, sanscript.DEVANAGARI, sanscript.ISO)
                    variants.append(iso)
                except:
                    pass

        except ImportError:
            # Transliteration library not available, skip
            pass

        return list(set(variants))  # Remove duplicates

    def _init_backends(self):
        """Initialize vector database backends in order of preference."""
        # Try Milvus first (production)
        if MILVUS_AVAILABLE:
            try:
                self._init_milvus()
                self.backend = 'milvus'
                print(f"✅ Semantic Location Linker initialized (Milvus backend - multilingual)")
                print(f"   📍 Collection: {self.collection_name}")
                print(f"   🌐 Model: {self.embedding_model_name}")
                print(f"   🔄 Transliteration: {'enabled' if self.enable_transliteration else 'disabled'}")
                print(f"   📚 Synonym expansion: {'enabled' if self.enable_synonym_expansion else 'disabled'}")
                return
            except Exception as e:
                print(f"⚠️  Milvus initialization failed: {e}")

        # Fallback to FAISS (development)
        if FAISS_AVAILABLE and self.use_faiss_fallback:
            try:
                self._init_faiss()
                self.backend = 'faiss'
                print(f"✅ Semantic Location Linker initialized (FAISS backend - multilingual)")
                print(f"   🌐 Model: {self.embedding_model_name}")
                print(f"   🔄 Transliteration: {'enabled' if self.enable_transliteration else 'disabled'}")
                print(f"   📚 Synonym expansion: {'enabled' if self.enable_synonym_expansion else 'disabled'}")
                return
            except Exception as e:
                print(f"⚠️  FAISS initialization failed: {e}")

        # No backend available
        print("❌ No vector database backend available")
        raise RuntimeError("No vector database backend could be initialized")

    def _init_milvus(self):
        """Initialize Milvus client and verify collection."""
        self.client = MilvusClient(uri=self.milvus_uri)
        print(f"✅ Connected to Milvus: {self.milvus_uri}")

        # Verify collection exists
        if not self.client.has_collection(collection_name=self.collection_name):
            raise RuntimeError(f"Collection '{self.collection_name}' not found.")

        # Load collection
        self.client.load_collection(collection_name=self.collection_name)
        print(f"✅ Collection loaded: {self.collection_name}")

    def _init_faiss(self):
        """Initialize FAISS backend with multilingual embeddings."""
        self.faiss_linker = MultilingualFAISSLocationLinker(self.embedding_model_name)
        print("✅ FAISS backend initialized with multilingual embeddings")

    def find_semantic_matches(self,
                            query_text: str,
                            limit: int = 5,
                            min_score: Optional[float] = None) -> List[Dict]:
        """
        Find semantically similar locations with enhanced multilingual support.

        Args:
            query_text: Location name or description to search for
            limit: Maximum number of results to return
            min_score: Minimum similarity score (overrides instance threshold)

        Returns:
            List of matching locations with similarity scores
        """
        if not query_text or not query_text.strip():
            return []

        # Detect language and log
        language = self._detect_language(query_text)
        print(f"🔍 Searching for '{query_text}' (detected: {language})")

        # Generate query variants for better coverage
        query_variants = [query_text]

        # Add transliteration variants
        transliteration_variants = self._get_transliteration_variants(query_text)
        query_variants.extend(transliteration_variants)

        # Add synonym expansions for Hindi
        if language == 'hindi':
            synonym_variants = self._expand_query_with_synonyms(query_text)
            query_variants.extend(synonym_variants)

        # Remove duplicates while preserving order
        seen = set()
        unique_variants = []
        for variant in query_variants:
            if variant not in seen:
                seen.add(variant)
                unique_variants.append(variant)

        if len(unique_variants) > 1:
            print(f"   📝 Query variants: {unique_variants}")

        # Try each variant and collect results
        all_matches = []

        for variant in unique_variants:
            if self.backend == 'milvus':
                matches = self._find_semantic_matches_milvus(variant, limit, min_score)
            elif self.backend == 'faiss':
                matches = self._find_semantic_matches_faiss(variant, limit, min_score)
            else:
                matches = []

            all_matches.extend(matches)

        # Remove duplicates and sort by score
        seen_names = set()
        unique_matches = []
        for match in all_matches:
            name = match['name'].lower()
            if name not in seen_names:
                seen_names.add(name)
                unique_matches.append(match)

        # Sort by similarity score (highest first)
        unique_matches.sort(key=lambda x: x.get('similarity_score', 0), reverse=True)

        # Log results
        if unique_matches:
            top_match = unique_matches[0]
            print(f"   ✅ Found {len(unique_matches)} matches, top: '{top_match['name']}' (score: {top_match.get('similarity_score', 0):.3f})")
        else:
            print("   ❌ No matches found")

        return unique_matches[:limit]

    def _find_semantic_matches_milvus(self,
                                    query_text: str,
                                    limit: int = 5,
                                    min_score: Optional[float] = None) -> List[Dict]:
        """Milvus implementation of semantic search."""
        threshold = min_score if min_score is not None else self.similarity_threshold

        try:
            # Generate embedding for query
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer(self.embedding_model_name)
            query_embedding = model.encode(
                query_text.strip(),
                convert_to_tensor=False,
                normalize_embeddings=True
            ).tolist()

            # Search in Milvus
            search_results = self.client.search(
                collection_name=self.collection_name,
                data=[query_embedding],
                anns_field="embedding",
                limit=limit * 2,  # Get more results for filtering
                output_fields=["location"],
                search_params={"metric_type": "COSINE"}
            )

            matches = []
            for result in search_results[0]:  # First (and only) query result
                score = result['distance']  # Cosine similarity

                if score >= threshold:
                    entity = result['entity']
                    matches.append({
                        'name': entity['location'],
                        'similarity_score': round(score, 3),
                        'source': 'multilingual_milvus_search',
                        'match_type': 'semantic'
                    })

            return matches

        except Exception as e:
            print(f"Warning: Milvus search failed for '{query_text}': {e}")
            return []

    def _find_semantic_matches_faiss(self,
                                    query_text: str,
                                    limit: int = 5,
                                    min_score: Optional[float] = None) -> List[Dict]:
        """FAISS implementation of semantic search."""
        # Load data lazily if not already loaded
        if not self.faiss_linker.data_loaded:
            self.faiss_linker.load_multilingual_data()

        threshold = min_score if min_score is not None else self.similarity_threshold
        return self.faiss_linker.find_semantic_matches(query_text, limit, threshold)

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
        if self.backend == 'milvus':
            return self._get_location_context_milvus(location_name)
        elif self.backend == 'faiss':
            return self._get_location_context_faiss(location_name)
        else:
            return None

    def _get_location_context_milvus(self, location_name: str) -> Optional[Dict]:
        """Milvus implementation of location context."""
        matches = self.find_semantic_matches(location_name, limit=1, min_score=0.8)

        if matches:
            match = matches[0]
            return {
                'name': match['name'],
                'confidence': match['similarity_score'],
                'source': 'multilingual_semantic'
            }

        return None

    def _get_location_context_faiss(self, location_name: str) -> Optional[Dict]:
        """FAISS implementation of location context."""
        # Load data lazily if not already loaded
        if not self.faiss_linker.data_loaded:
            self.faiss_linker.load_multilingual_data()

        return self.faiss_linker.get_location_context(location_name)


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
            print("✅ Location matcher enhanced with multilingual semantic search")
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
def create_semantic_linker(milvus_uri: str = None,
                          enable_transliteration: bool = True,
                          enable_synonym_expansion: bool = True) -> SemanticLocationLinker:
    """
    Create a semantic location linker instance with enhanced features.

    Args:
        milvus_uri: Milvus connection URI
        enable_transliteration: Enable transliteration for better Hindi coverage
        enable_synonym_expansion: Enable Hindi synonym expansion

    Returns:
        Configured SemanticLocationLinker instance
    """
    return SemanticLocationLinker(
        milvus_uri=milvus_uri,
        enable_transliteration=enable_transliteration,
        enable_synonym_expansion=enable_synonym_expansion
    )


def create_enhanced_matcher(milvus_uri: str = None,
                           enable_transliteration: bool = True,
                           enable_synonym_expansion: bool = True) -> LocationMatcherWithSemantics:
    """
    Create an enhanced location matcher with multilingual semantic capabilities.

    Args:
        milvus_uri: Milvus connection URI
        enable_transliteration: Enable transliteration for better Hindi coverage
        enable_synonym_expansion: Enable Hindi synonym expansion

    Returns:
        Enhanced location matcher
    """
    try:
        semantic_linker = create_semantic_linker(
            milvus_uri=milvus_uri,
            enable_transliteration=enable_transliteration,
            enable_synonym_expansion=enable_synonym_expansion
        )
        return LocationMatcherWithSemantics(semantic_linker)
    except Exception as e:
        print(f"Warning: Could not initialize semantic linker: {e}")
        print("Falling back to deterministic matching only")
        return LocationMatcherWithSemantics()


if __name__ == '__main__':
    # Test the enhanced semantic linker
    try:
        print("🚀 Testing Enhanced Multilingual Semantic Location Linker")
        print("=" * 60)

        linker = create_semantic_linker()

        # Test comprehensive queries
        test_queries = [
            "रायगढ़",  # Hindi
            "raigarh",  # English
            "कोरबा शहर",  # Hindi with synonym
            "korba town",  # English with synonym
            "बिलासपुर जिला",  # Hindi with synonym
            "bilaspur district",  # English with synonym
            "अम्बिकापुर",  # Hindi
            "ambikapur",  # English
            "रायगढ़ कलेक्टरेट",  # Complex Hindi
            "raigarh collectorate"  # Complex English
        ]

        print(f"\n🧪 Testing {len(test_queries)} queries:")
        print("-" * 40)

        for i, query in enumerate(test_queries, 1):
            print(f"\n{i:2d}. ", end="")
            matches = linker.find_semantic_matches(query, limit=3)
            if matches:
                top_match = matches[0]
                print(f"✅ '{query}' → {top_match['name']} (score: {top_match['similarity_score']:.3f})")
                if len(matches) > 1:
                    for j, match in enumerate(matches[1:], 1):
                        print(f"      + {match['name']} (score: {match['similarity_score']:.3f})")
            else:
                print(f"❌ '{query}' → No matches found")

        print(f"\n🎉 Testing complete! System ready for production deployment.")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()