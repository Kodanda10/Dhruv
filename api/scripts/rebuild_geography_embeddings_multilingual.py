#!/usr/bin/env python3
"""
Rebuild geography embeddings with multilingual support for Hindi location matching.

This script addresses the language mismatch issue where Hindi queries failed to match
because embeddings were generated with English-only models. It uses the multilingual
intfloat/multilingual-e5-base model to support both Hindi and English queries.

The script:
1. Loads the Chhattisgarh geography NDJSON data
2. Extracts all location variants (Hindi, English, transliteration)
3. Generates multilingual embeddings for all variants
4. Creates synchronized FAISS and Milvus indexes
5. Tests the embeddings with sample Hindi queries
"""

import json
import os
import sys
import numpy as np
from typing import List, Dict, Any, Set
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the api directory to the path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from sentence_transformers import SentenceTransformer
    import faiss
    from pymilvus import connections, Collection, FieldSchema, CollectionSchema, DataType
except ImportError as e:
    logger.error(f"Missing required packages: {e}")
    logger.error("Please install: pip install sentence-transformers faiss-cpu pymilvus")
    sys.exit(1)

class MultilingualGeographyEmbedder:
    """Handles multilingual embedding generation for Chhattisgarh geography data."""

    def __init__(self, model_name: str = "intfloat/multilingual-e5-base"):
        """Initialize with multilingual embedding model."""
        logger.info(f"Loading multilingual model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        logger.info(f"Model loaded. Embedding dimension: {self.dimension}")

    def extract_location_variants(self, record: Dict[str, Any]) -> Set[str]:
        """Extract all unique location name variants from a geography record."""
        variants = set()

        # Add main location names
        for field in ['district', 'block', 'gram_panchayat', 'village']:
            if field in record and record[field]:
                variants.add(record[field])

        # Add English versions
        for field in ['gram_panchayat_english', 'village_english']:
            if field in record and record[field]:
                variants.add(record[field])

        # Add variants from the variants object
        if 'variants' in record:
            variants_obj = record['variants']
            for level_variants in variants_obj.values():
                if isinstance(level_variants, dict):
                    for variant in level_variants.values():
                        if variant and isinstance(variant, str):
                            variants.add(variant)

        return variants

    def load_geography_data(self, ndjson_path: str) -> List[Dict[str, Any]]:
        """Load geography data from NDJSON file."""
        logger.info(f"Loading geography data from: {ndjson_path}")
        records = []

        with open(ndjson_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    records.append(record)
                except json.JSONDecodeError as e:
                    logger.warning(f"Skipping invalid JSON at line {line_num}: {e}")
                    continue

        logger.info(f"Loaded {len(records)} geography records")
        return records

    def generate_embeddings(self, records: List[Dict[str, Any]]) -> tuple:
        """Generate embeddings for all location variants."""
        logger.info("Extracting location variants...")

        # Collect all unique location variants
        all_variants = set()
        for record in records:
            variants = self.extract_location_variants(record)
            all_variants.update(variants)

        location_list = list(all_variants)
        logger.info(f"Found {len(location_list)} unique location variants")

        # Sample some variants for logging
        sample_variants = list(location_list)[:10]
        logger.info(f"Sample variants: {sample_variants}")

        # Generate embeddings
        logger.info("Generating multilingual embeddings...")
        embeddings = self.model.encode(location_list, normalize_embeddings=True, show_progress_bar=True)

        logger.info(f"Generated embeddings with shape: {embeddings.shape}")
        return location_list, embeddings

class VectorIndexManager:
    """Manages FAISS and Milvus vector indexes."""

    def __init__(self, dimension: int):
        self.dimension = dimension

    def create_faiss_index(self, embeddings: np.ndarray, locations: List[str]) -> faiss.Index:
        """Create FAISS index for embeddings."""
        logger.info("Creating FAISS index...")

        # Create L2 index (suitable for normalized embeddings)
        index = faiss.IndexFlatIP(self.dimension)  # Inner product for cosine similarity

        # Add embeddings to index
        index.add(embeddings.astype('float32'))

        logger.info(f"FAISS index created with {index.ntotal} vectors")
        return index

    def create_milvus_collection(self, collection_name: str, embeddings: np.ndarray,
                               locations: List[str], host: str = "localhost", port: str = "19530"):
        """Create Milvus collection and insert data."""
        logger.info(f"Creating Milvus collection: {collection_name}")

        try:
            # Connect to Milvus
            connections.connect("default", host=host, port=port)

            # Drop existing collection if it exists
            try:
                collection = Collection(collection_name)
                collection.drop()
                logger.info(f"Dropped existing collection: {collection_name}")
            except:
                pass

            # Define schema
            fields = [
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
                FieldSchema(name="location", dtype=DataType.VARCHAR, max_length=255),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=self.dimension)
            ]
            schema = CollectionSchema(fields, description="Chhattisgarh geography embeddings")

            # Create collection
            collection = Collection(collection_name, schema)

            # Create index on embedding field
            index_params = {
                "metric_type": "COSINE",  # Cosine similarity for normalized embeddings
                "index_type": "IVF_FLAT",
                "params": {"nlist": 128}
            }
            collection.create_index("embedding", index_params)

            # Prepare data for insertion
            entities = [locations, embeddings.tolist()]

            # Insert data
            collection.insert(entities)
            collection.flush()

            logger.info(f"Milvus collection created with {len(locations)} entities")

            return collection

        except Exception as e:
            logger.error(f"Failed to create Milvus collection: {e}")
            raise

def save_index_data(index_dir: str, locations: List[str], embeddings: np.ndarray,
                   faiss_index: faiss.Index):
    """Save index data to disk."""
    os.makedirs(index_dir, exist_ok=True)

    # Save locations
    locations_path = os.path.join(index_dir, "locations.json")
    with open(locations_path, 'w', encoding='utf-8') as f:
        json.dump(locations, f, ensure_ascii=False, indent=2)

    # Save embeddings
    embeddings_path = os.path.join(index_dir, "embeddings.npy")
    np.save(embeddings_path, embeddings)

    # Save FAISS index
    faiss_path = os.path.join(index_dir, "faiss_index.bin")
    faiss.write_index(faiss_index, faiss_path)

    logger.info(f"Saved index data to: {index_dir}")

def test_embeddings(embedder: MultilingualGeographyEmbedder, locations: List[str],
                   embeddings: np.ndarray, faiss_index: faiss.Index):
    """Test the embeddings with sample Hindi queries."""
    logger.info("Testing embeddings with sample queries...")

    test_queries = [
        "रायगढ़",  # Raigarh in Hindi
        "कोरबा",   # Korba in Hindi
        "बिलासपुर", # Bilaspur in Hindi
        "raigarh", # English transliteration
        "korba",   # English transliteration
        "bilaspur" # English transliteration
    ]

    for query in test_queries:
        logger.info(f"\nTesting query: '{query}'")

        # Generate query embedding
        query_embedding = embedder.model.encode([query], normalize_embeddings=True)[0]

        # Search FAISS index
        k = 5  # Number of nearest neighbors
        distances, indices = faiss_index.search(
            query_embedding.reshape(1, -1).astype('float32'), k
        )

        # Display results
        logger.info("Top matches:")
        for i, (dist, idx) in enumerate(zip(distances[0], indices[0])):
            if idx < len(locations):  # Valid index
                location = locations[idx]
                similarity = dist  # Cosine similarity (higher is better)
                logger.info(".3f")

def main():
    """Main execution function."""
    # Configuration
    NDJSON_PATH = "../data/datasets/chhattisgarh_geography.ndjson"
    INDEX_DIR = "data/embeddings/multilingual_geography"
    MILVUS_COLLECTION = "chhattisgarh_geography_multilingual"
    MODEL_NAME = "intfloat/multilingual-e5-base"

    # Initialize embedder
    embedder = MultilingualGeographyEmbedder(MODEL_NAME)

    # Load geography data
    records = embedder.load_geography_data(NDJSON_PATH)

    # Generate embeddings
    locations, embeddings = embedder.generate_embeddings(records)

    # Create indexes
    index_manager = VectorIndexManager(embedder.dimension)

    # Create FAISS index
    faiss_index = index_manager.create_faiss_index(embeddings, locations)

    # Create Milvus collection
    try:
        milvus_collection = index_manager.create_milvus_collection(
            MILVUS_COLLECTION, embeddings, locations
        )
    except Exception as e:
        logger.warning(f"Milvus collection creation failed: {e}")
        logger.warning("Continuing with FAISS index only")
        milvus_collection = None

    # Save index data
    save_index_data(INDEX_DIR, locations, embeddings, faiss_index)

    # Test embeddings
    test_embeddings(embedder, locations, embeddings, faiss_index)

    logger.info("\n✅ Multilingual geography embeddings rebuilt successfully!")
    logger.info(f"📁 Index data saved to: {INDEX_DIR}")
    logger.info(f"🗂️ FAISS index: {os.path.join(INDEX_DIR, 'faiss_index.bin')}")
    if milvus_collection:
        logger.info(f"🗂️ Milvus collection: {MILVUS_COLLECTION}")
    logger.info(f"📊 Total locations indexed: {len(locations)}")
    logger.info(f"📏 Embedding dimension: {embedder.dimension}")

if __name__ == "__main__":
    main()