#!/usr/bin/env python3
"""
Populate Milvus collection with multilingual embeddings in batches to avoid gRPC size limits.
"""

import json
import pickle
import numpy as np
from pathlib import Path
import logging
from pymilvus import connections, Collection

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def load_multilingual_embeddings():
    """Load the multilingual embeddings data."""
    embeddings_dir = Path("../data/embeddings/multilingual_geography")

    # Load locations
    with open(embeddings_dir / "locations.json", "r", encoding="utf-8") as f:
        locations = json.load(f)

    # Load embeddings
    embeddings = np.load(embeddings_dir / "embeddings.npy")

    logger.info(f"Loaded {len(locations)} locations with {embeddings.shape[0]} embeddings")
    return locations, embeddings

def insert_in_batches(collection_name: str, locations: list, embeddings: np.ndarray, batch_size: int = 1000):
    """Insert embeddings into Milvus collection in batches."""
    connections.connect(uri="http://localhost:19530")
    collection = Collection(collection_name)

    total_inserted = 0
    for i in range(0, len(locations), batch_size):
        end_idx = min(i + batch_size, len(locations))

        batch_locations = locations[i:end_idx]
        batch_embeddings = embeddings[i:end_idx]

        # Prepare data for insertion
        data = [batch_locations, batch_embeddings.tolist()]

        try:
            result = collection.insert(data)
            total_inserted += len(batch_locations)
            logger.info(f"Inserted batch {i//batch_size + 1}: {len(batch_locations)} entities (total: {total_inserted})")
        except Exception as e:
            logger.error(f"Failed to insert batch {i//batch_size + 1}: {e}")
            break

    # Build index after insertion
    try:
        logger.info("Building index...")
        index_params = {
            "metric_type": "COSINE",
            "index_type": "IVF_FLAT",
            "params": {"nlist": 1024}
        }
        collection.create_index(field_name="embedding", index_params=index_params)
        logger.info("Index built successfully")
    except Exception as e:
        logger.error(f"Failed to build index: {e}")

    # Load collection for search
    collection.load()

    logger.info(f"Total entities inserted: {total_inserted}")
    return total_inserted

def main():
    logger.info("Loading multilingual embeddings...")
    locations, embeddings = load_multilingual_embeddings()

    logger.info("Inserting embeddings into Milvus in batches...")
    total_inserted = insert_in_batches("chhattisgarh_geography_multilingual", locations, embeddings, batch_size=500)

    logger.info(f"✅ Successfully inserted {total_inserted} entities into Milvus")

if __name__ == "__main__":
    main()