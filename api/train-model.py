import os
import json
import uuid
import sys
from sentence_transformers import SentenceTransformer
from src.parsing.milvus_engine import MilvusEngine
from src.parsing.parser import LangExtractParser

# --- Configuration ---
EMBEDDING_MODEL = 'paraphrase-MiniLM-L6-v2'
COLLECTION_NAME = "project_dhruv"
DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'posts_new.json')

def main():
    """Main function to run the data processing and insertion pipeline."""
    
    # 1. Initialize Milvus Engine and create collection
    print("\n1. Setting up Milvus collection...")
    milvus_engine = MilvusEngine(collection_name=COLLECTION_NAME)
    milvus_engine.create_collection_if_not_exists()

    # 2. Load data
    print(f"\n2. Loading data from {DATA_PATH}...")
    with open(DATA_PATH, 'r') as f:
        documents = json.load(f)

    # 3. Initialize Parser and Embedding Model
    print("Initializing models...")
    parser = LangExtractParser()
    embedding_model = SentenceTransformer(EMBEDDING_MODEL)

    # 4. Process and insert data
    print("\n3. Processing documents and inserting into Milvus...")
    processed_data = []
    for doc in documents:
        content = doc.get("content", "")
        if not content:
            continue

        # a. Extract structured data
        try:
            sentiment = parser.parse(content, "sentiment")
            theme = parser.parse(content, "theme")
            location = parser.parse(content, "location")
            print(f"Successfully parsed doc id: {doc.get('id', 'N/A')}")
        except Exception as e:
            print(f"Error parsing document {doc.get('id')}: {e}")
            continue

        # b. Generate embedding
        try:
            embedding = embedding_model.encode(content, convert_to_tensor=False).tolist()
        except Exception as e:
            print(f"Error generating embedding for document {doc.get('id')}: {e}")
            continue

        # c. Flatten and structure data
        data_entry = {
            "id": str(doc.get("id", uuid.uuid4())),
            "document_text": content,
            "embedding": embedding,
            "genre": theme,
            "primary_genre": theme,
            "secondary_genre": "unknown",
            "character_role": "unknown",
            "character_type": "unknown",
            "theme_type": theme,
            "theme_setting": location,
        }
        processed_data.append(data_entry)

    # d. Insert batch into Milvus
    if processed_data:
        milvus_engine.insert(processed_data)
    else:
        print("No data to insert.")

    print("\n--- Pipeline Complete ---")

if __name__ == "__main__":
    # The sys.path modification is no longer needed if we run as a module
    # but we keep it for robustness in case the script is run directly.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()