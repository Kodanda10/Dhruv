import os
import json
import uuid
import sys
import time
from sentence_transformers import SentenceTransformer
from src.parsing.milvus_engine import MilvusEngine
from src.parsing.parser import create_parser, GeminiParser

# --- Configuration ---
EMBEDDING_MODEL = 'paraphrase-MiniLM-L6-v2'
COLLECTION_NAME = "project_dhruv"
DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'posts.json')
CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'posts_checkpoint.json')
PROCESSED_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'posts_processed.json')

def load_checkpoint():
    """Load processing checkpoint"""
    if os.path.exists(CHECKPOINT_PATH):
        with open(CHECKPOINT_PATH, 'r') as f:
            return json.load(f)
    return {"last_processed_index": -1, "total_processed": 0}

def save_checkpoint(checkpoint):
    """Save processing checkpoint"""
    with open(CHECKPOINT_PATH, 'w') as f:
        json.dump(checkpoint, f, indent=2)

def save_processed_posts(processed_posts):
    """Save processed posts to file"""
    with open(PROCESSED_PATH, 'w', encoding='utf-8') as f:
        json.dump(processed_posts, f, ensure_ascii=False, indent=2)

def main():
    """Main function to run the data processing and insertion pipeline."""

    # 1. Load checkpoint and data
    print("\n1. Loading checkpoint and data...")
    checkpoint = load_checkpoint()
    last_processed = checkpoint.get("last_processed_index", -1)

    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        all_documents = json.load(f)

    print(f"Total documents: {len(all_documents)}")
    print(f"Last processed index: {last_processed}")
    print(f"Remaining to process: {len(all_documents) - last_processed - 1}")

    # 2. Initialize Milvus Engine and create collection
    print("\n2. Setting up Milvus collection...")
    # milvus_engine = MilvusEngine(collection_name=COLLECTION_NAME)
    # milvus_engine.create_collection_if_not_exists()
    print("Skipping Milvus setup (not available)")

    # 3. Initialize Parser and Embedding Model
    print("\n3. Initializing models...")
    try:
        parser = create_parser("gemini")  # Use Gemini with rate limiting
        print("Using Gemini parser with rate limiting")
    except ValueError as e:
        print(f"Gemini not available ({e}), falling back to LangExtract")
        parser = create_parser("langextract")

    embedding_model = SentenceTransformer(EMBEDDING_MODEL)

    # 4. Process and insert data with checkpointing
    print("\n4. Processing documents and inserting into Milvus...")
    processed_data = []
    processed_posts = []
    batch_size = 10  # Process in batches to manage rate limits
    start_time = time.time()

    for i in range(last_processed + 1, len(all_documents), batch_size):
        batch_end = min(i + batch_size, len(all_documents))
        batch = all_documents[i:batch_end]

        print(f"\nProcessing batch {i//batch_size + 1}: documents {i} to {batch_end-1}")

        for j, doc in enumerate(batch):
            doc_index = i + j
            content = doc.get("content", "")
            if not content:
                continue

            # Rate limiting status
            if isinstance(parser, GeminiParser):
                status = parser.get_rate_limit_status()
                print(f"Rate limit status: {status['tokens_available']:.1f} tokens, queue: {status['queue_size']}")

            # a. Extract structured data with error handling
            try:
                sentiment = parser.parse(content, "sentiment")
                theme = parser.parse(content, "theme")
                location = parser.parse(content, "location")
                print(f"✓ Parsed doc id: {doc.get('id', 'N/A')} (sentiment: {sentiment}, theme: {theme})")
            except Exception as e:
                print(f"✗ Error parsing document {doc.get('id')}: {e}")
                # Save checkpoint on error
                checkpoint["last_processed_index"] = doc_index - 1
                checkpoint["total_processed"] = len(processed_data)
                save_checkpoint(checkpoint)
                continue

            # b. Generate embedding
            try:
                embedding = embedding_model.encode(content, convert_to_tensor=False).tolist()
            except Exception as e:
                print(f"✗ Error generating embedding for document {doc.get('id')}: {e}")
                continue

            # c. Create processed post entry
            processed_post = {
                "id": doc.get("id"),
                "timestamp": doc.get("timestamp"),
                "content": content,
                "embedding": embedding,
                "sentiment": sentiment,
                "purpose": theme,
                "parsed_metadata": json.dumps({
                    "theme": theme,
                    "location": location,
                    "sentiment": sentiment
                })
            }
            processed_posts.append(processed_post)

            # d. Flatten and structure data for Milvus
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

            # Update checkpoint
            checkpoint["last_processed_index"] = doc_index
            checkpoint["total_processed"] = len(processed_data)

        # Save checkpoint after each batch
        save_checkpoint(checkpoint)
        save_processed_posts(processed_posts)

        # Progress reporting
        elapsed = time.time() - start_time
        docs_per_sec = (len(processed_data)) / elapsed if elapsed > 0 else 0
        print(f"Progress: {len(processed_data)}/{len(all_documents)} processed ({docs_per_sec:.2f} docs/sec)")

        # Rate limiting: small delay between batches
        if isinstance(parser, GeminiParser):
            time.sleep(2)  # 2 second delay between batches

    # 5. Final batch insert
    if processed_data:
        print(f"\n5. Inserting {len(processed_data)} documents into Milvus...")
        # milvus_engine.insert(processed_data)
        print("✓ Skipping Milvus insertion (not available)")
    else:
        print("No data to insert.")

    # 6. Final save
    save_processed_posts(processed_posts)
    save_checkpoint(checkpoint)

    print("\n--- Pipeline Complete ---")
    print(f"Total processed: {len(processed_data)}")
    print(f"Processed posts saved to: {PROCESSED_PATH}")
    print(f"Checkpoint saved to: {CHECKPOINT_PATH}")

    # Rate limiting summary
    if isinstance(parser, GeminiParser):
        final_status = parser.get_rate_limit_status()
        print(f"Final rate limit status: {final_status}")

if __name__ == "__main__":
    # Set up environment
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    # Check for Gemini API key
    if not os.getenv("GEMINI_API_KEY"):
        print("Warning: GEMINI_API_KEY not set. Using LangExtract fallback.")
        print("To use Gemini, set: export GEMINI_API_KEY='your-api-key'")

    main()