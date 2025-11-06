#!/usr/bin/env python3
"""
Geography Embedding Generator

Generates vector embeddings for Chhattisgarh geography data to enable semantic location search.
Processes Hindi location names and their variants for improved location matching accuracy.

Usage:
    python generate_geography_embeddings.py [--collection COLLECTION_NAME] [--uri MILVUS_URI]

Environment Variables:
    MILVUS_URI: Milvus connection URI (default: http://localhost:19530)
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Optional
import argparse

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent / 'api'))

try:
    from sentence_transformers import SentenceTransformer
    from pymilvus import MilvusClient, DataType
    import numpy as np
except ImportError as e:
    print(f"Missing required packages: {e}")
    print("Install with: pip install sentence-transformers pymilvus numpy")
    sys.exit(1)


class GeographyEmbeddingGenerator:
    """Generates embeddings for geography data using sentence transformers."""

    def __init__(self, model_name: str = 'paraphrase-MiniLM-L6-v2', uri: str = None):
        """
        Initialize the embedding generator.

        Args:
            model_name: Sentence transformer model name
            uri: Milvus connection URI
        """
        self.model_name = model_name
        self.uri = uri or os.getenv('MILVUS_URI', 'http://localhost:19530')
        self.collection_name = 'geography_embeddings'
        self.embedding_dim = 384  # Dimension for paraphrase-MiniLM-L6-v2

        print(f"Initializing embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        print("✅ Embedding model loaded")

        print(f"Connecting to Milvus at: {self.uri}")
        self.client = MilvusClient(uri=self.uri)
        print("✅ Connected to Milvus")

    def create_collection(self):
        """Create Milvus collection for geography embeddings."""
        if self.client.has_collection(collection_name=self.collection_name):
            print(f"Collection '{self.collection_name}' already exists")
            return

        print(f"Creating collection: {self.collection_name}")
        schema = self.client.create_schema(auto_id=False, enable_dynamic_field=False)

        # Define schema fields
        schema.add_field(field_name="id", datatype=DataType.VARCHAR, max_length=100, is_primary=True)
        schema.add_field(field_name="location_name", datatype=DataType.VARCHAR, max_length=500)
        schema.add_field(field_name="location_type", datatype=DataType.VARCHAR, max_length=50)
        schema.add_field(field_name="district", datatype=DataType.VARCHAR, max_length=100)
        schema.add_field(field_name="block", datatype=DataType.VARCHAR, max_length=100)
        schema.add_field(field_name="state", datatype=DataType.VARCHAR, max_length=50)
        schema.add_field(field_name="embedding", datatype=DataType.FLOAT_VECTOR, dim=self.embedding_dim)
        schema.add_field(field_name="variants", datatype=DataType.VARCHAR, max_length=2000)  # JSON string of variants

        self.client.create_collection(collection_name=self.collection_name, schema=schema)

        # Create vector index
        print("Creating vector index...")
        index_params = self.client.prepare_index_params()
        index_params.add_index(field_name="embedding", index_type="AUTOINDEX", metric_type="COSINE")
        self.client.create_index(collection_name=self.collection_name, index_params=index_params)

        print("✅ Collection and index created")

    def load_geography_data(self, data_file: Path) -> List[Dict]:
        """
        Load geography data from NDJSON file.

        Args:
            data_file: Path to NDJSON file

        Returns:
            List of geography records
        """
        if not data_file.exists():
            raise FileNotFoundError(f"Geography data file not found: {data_file}")

        locations = []
        print(f"Loading geography data from: {data_file}")

        with open(data_file, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if line.strip():
                    try:
                        record = json.loads(line)
                        locations.append(record)
                    except json.JSONDecodeError as e:
                        print(f"Warning: Failed to parse line {i+1}: {e}")
                        continue

        print(f"✅ Loaded {len(locations)} geography records")
        return locations

    def generate_variants(self, name: str) -> List[str]:
        """
        Generate text variants for a location name to improve matching.

        Args:
            name: Location name

        Returns:
            List of text variants for embedding
        """
        if not name or not name.strip():
            return []

        variants = [name.strip()]

        # Add common location prefixes/suffixes
        prefixes = ['ग्राम', 'गाँव', 'नगर', 'शहर', 'ब्लॉक', 'जिला', 'राज्य']
        suffixes = ['गाँव', 'नगर', 'पंचायत', 'ब्लॉक', 'तहसील']

        for prefix in prefixes:
            variants.append(f"{prefix} {name}")
        for suffix in suffixes:
            variants.append(f"{name} {suffix}")

        # Add transliteration hints for Hindi text
        if any('\u0900' <= c <= '\u097F' for c in name):
            variants.append(f"Location: {name}")
            variants.append(f"Place: {name}")

        return list(set(variants))  # Remove duplicates

    def generate_embedding_record(self, location: Dict, location_id: str) -> Optional[Dict]:
        """
        Generate embedding record for a location.

        Args:
            location: Location data
            location_id: Unique identifier

        Returns:
            Embedding record for Milvus insertion
        """
        name = location.get('name', '').strip()
        if not name:
            return None

        # For the actual data structure, extract the appropriate name
        # The data has village, gram_panchayat, block, district fields
        actual_name = (location.get('village') or 
                      location.get('gram_panchayat') or 
                      location.get('block') or 
                      location.get('district') or 
                      name)
        
        if not actual_name or not actual_name.strip():
            return None

        # Determine location type
        if location.get('village'):
            location_type = 'village'
        elif location.get('gram_panchayat'):
            location_type = 'gram_panchayat'
        elif location.get('block'):
            location_type = 'block'
        elif location.get('district'):
            location_type = 'district'
        else:
            location_type = 'unknown'

        # Generate text variants for embedding
        variants = self.generate_variants(actual_name)
        if not variants:
            return None

        # Create combined text for embedding (primary name + key variants)
        embedding_text = f"{actual_name}. {' '.join(variants[:3])}"  # Limit to avoid too long text

        try:
            # Generate embedding
            embedding = self.model.encode(embedding_text, convert_to_tensor=False).tolist()

            return {
                'id': location_id,
                'location_name': actual_name,
                'location_type': location_type,
                'district': location.get('district', ''),
                'block': location.get('block', ''),
                'state': 'Chhattisgarh',
                'embedding': embedding,
                'variants': json.dumps(variants, ensure_ascii=False)
            }

        except Exception as e:
            print(f"Warning: Failed to generate embedding for {name}: {e}")
            return None

    def generate_embeddings(self, data_file: Path, batch_size: int = 100):
        """
        Generate and store embeddings for all geography data.

        Args:
            data_file: Path to geography NDJSON file
            batch_size: Batch size for insertion
        """
        # Load geography data
        locations = self.load_geography_data(data_file)

        # Create collection if needed
        self.create_collection()

        # Generate embeddings in batches
        records = []
        processed = 0
        inserted = 0

        for i, location in enumerate(locations):
            location_id = f"loc_{i:06d}"

            record = self.generate_embedding_record(location, location_id)
            if record:
                records.append(record)
                processed += 1

            # Insert in batches
            if len(records) >= batch_size:
                try:
                    self.client.insert(collection_name=self.collection_name, data=records)
                    inserted += len(records)
                    print(f"✅ Inserted batch: {len(records)} records (total: {inserted})")
                    records = []
                except Exception as e:
                    print(f"❌ Failed to insert batch: {e}")
                    records = []

        # Insert remaining records
        if records:
            try:
                self.client.insert(collection_name=self.collection_name, data=records)
                inserted += len(records)
                print(f"✅ Inserted final batch: {len(records)} records (total: {inserted})")
            except Exception as e:
                print(f"❌ Failed to insert final batch: {e}")

        print(f"🎉 Embedding generation complete!")
        print(f"   Processed: {processed} locations")
        print(f"   Inserted: {inserted} embeddings")

    def load_collection(self):
        """Load collection into memory for search."""
        print("Loading collection into memory...")
        self.client.load_collection(collection_name=self.collection_name)
        print("✅ Collection loaded")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Generate geography embeddings for semantic location search')
    parser.add_argument('--data-file', type=str, default='data/datasets/chhattisgarh_geography.ndjson',
                       help='Path to geography NDJSON file')
    parser.add_argument('--collection', type=str, default='geography_embeddings',
                       help='Milvus collection name')
    parser.add_argument('--uri', type=str, help='Milvus connection URI')
    parser.add_argument('--model', type=str, default='paraphrase-MiniLM-L6-v2',
                       help='Sentence transformer model name')
    parser.add_argument('--batch-size', type=int, default=100,
                       help='Batch size for insertion')

    args = parser.parse_args()

    # Find data file
    data_file = Path(args.data_file)
    if not data_file.exists():
        # Try relative to script location
        script_dir = Path(__file__).parent
        data_file = script_dir.parent / args.data_file
        if not data_file.exists():
            print(f"❌ Geography data file not found: {args.data_file}")
            sys.exit(1)

    try:
        # Initialize generator
        generator = GeographyEmbeddingGenerator(
            model_name=args.model,
            uri=args.uri
        )

        # Generate embeddings
        generator.generate_embeddings(data_file, args.batch_size)

        # Load collection for immediate use
        generator.load_collection()

        print("\n🎯 Next Steps:")
        print("1. Test semantic location search with: python test_semantic_location.py")
        print("2. Integrate with location matcher in: api/src/parsing/location_matcher.py")
        print("3. Run integration tests with real tweet data")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()