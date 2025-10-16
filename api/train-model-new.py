import os
import json
import sys
import time
from sentence_transformers import SentenceTransformer

# Add the api directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from src.parsing.parser import create_parser, GeminiParser
    PARSING_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Warning: Parsing modules not available: {e}")
    PARSING_AVAILABLE = False

# --- Configuration ---
EMBEDDING_MODEL = 'paraphrase-MiniLM-L6-v2'
DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'posts_new.json')
CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'posts_new_checkpoint.json')
PROCESSED_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'posts_new_processed.json')

def load_checkpoint():
    """Load processing checkpoint"""
    if os.path.exists(CHECKPOINT_PATH):
        try:
            with open(CHECKPOINT_PATH, 'r', encoding='utf-8') as f:
                checkpoint = json.load(f)
                # Ensure required fields exist
                if "last_processed_index" not in checkpoint:
                    checkpoint["last_processed_index"] = -1
                if "total_processed" not in checkpoint:
                    checkpoint["total_processed"] = 0
                return checkpoint
        except Exception as e:
            print(f"⚠️  Error loading checkpoint: {e}")
            return {"last_processed_index": -1, "total_processed": 0}
    return {"last_processed_index": -1, "total_processed": 0}

def save_checkpoint(checkpoint):
    """Save processing checkpoint"""
    try:
        with open(CHECKPOINT_PATH, 'w', encoding='utf-8') as f:
            json.dump(checkpoint, f, indent=2, ensure_ascii=False)
        print(f"   💾 Checkpoint saved: {checkpoint}")
    except Exception as e:
        print(f"❌ Error saving checkpoint: {e}")

def load_processed_posts():
    """Load existing processed posts"""
    if os.path.exists(PROCESSED_PATH):
        try:
            with open(PROCESSED_PATH, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    return json.loads(content)
        except Exception as e:
            print(f"⚠️  Error loading processed posts: {e}")
    return []

def save_processed_posts(processed_posts):
    """Save processed posts to file"""
    try:
        with open(PROCESSED_PATH, 'w', encoding='utf-8') as f:
            json.dump(processed_posts, f, ensure_ascii=False, indent=2)
        print(f"   💾 Processed posts saved: {len(processed_posts)} posts to {PROCESSED_PATH}")
    except Exception as e:
        print(f"❌ Error saving processed posts: {e}")

def main():
    """Main function to run the data processing pipeline with rate limiting"""

    print("🚀 Starting LangExtract-Milvus-Gemini Pipeline with Rate Limiting")
    print("=" * 60)

    # 1. Load checkpoint and data
    print("\n1. 📂 Loading checkpoint and data...")
    checkpoint = load_checkpoint()
    last_processed = checkpoint.get("last_processed_index", -1)

    try:
        with open(DATA_PATH, 'r', encoding='utf-8') as f:
            all_documents = json.load(f)
    except Exception as e:
        print(f"❌ Error loading data: {e}")
        return

    print(f"   Total documents: {len(all_documents)}")
    print(f"   Last processed index: {last_processed}")
    print(f"   Remaining to process: {len(all_documents) - last_processed - 1}")

    # 2. Initialize Parser and Embedding Model
    print("\n2. 🤖 Initializing models...")
    parser = None
    if PARSING_AVAILABLE:
        try:
            parser = create_parser("gemini")  # Use Gemini with rate limiting
            print("   ✅ Using Gemini parser with rate limiting")
            print("   📊 Rate limits: 60 requests/minute, burst size: 10")
        except ValueError as e:
            print(f"   ⚠️  Gemini not available ({e}), falling back to LangExtract")
            try:
                parser = create_parser("langextract")
                print("   ✅ Using LangExtract parser")
            except Exception as e2:
                print(f"   ❌ LangExtract also failed: {e2}")
                parser = None
    else:
        print("   ❌ Parsing modules not available")

    # Initialize embedding model (with fallback)
    embedding_model = None
    try:
        embedding_model = SentenceTransformer(EMBEDDING_MODEL)
        print("   ✅ Embedding model loaded")
    except Exception as e:
        print(f"   ⚠️  Embedding model failed to load: {e}")
        print("   📝 Continuing without embeddings (will use empty arrays)")
        embedding_model = None

    # 3. Process documents with checkpointing
    print("\n3. 🔄 Processing documents with rate limiting...")
    processed_posts = load_processed_posts()  # Load existing processed posts
    print(f"   📂 Loaded {len(processed_posts)} existing processed posts")
    batch_size = 5  # Smaller batches for rate limiting
    start_time = time.time()

    # Update checkpoint status
    checkpoint["status"] = "in_progress"  # type: ignore
    checkpoint["start_time"] = time.time()  # type: ignore
    save_checkpoint(checkpoint)

    for i in range(last_processed + 1, len(all_documents), batch_size):
        batch_end = min(i + batch_size, len(all_documents))
        batch = all_documents[i:batch_end]

        print(f"\n   📦 Processing batch {i//batch_size + 1}: documents {i} to {batch_end-1}")

        for j, doc in enumerate(batch):
            doc_index = i + j
            content = doc.get("content", "")
            if not content:
                print(f"   ⚠️  Skipping empty content for doc {doc.get('id', 'N/A')}")
                continue

            # Initialize default values
            sentiment = "unknown"
            theme = "unknown"
            location = "unknown"

            # Parse with available parser
            if parser:
                try:
                    if hasattr(parser, 'get_rate_limit_status'):  # Check if Gemini parser
                        status = parser.get_rate_limit_status()  # type: ignore
                        print(f"   📈 Rate limit: {status['tokens_available']:.1f} tokens available, queue: {status['queue_size']}")

                    sentiment = parser.parse(content, "sentiment")
                    theme = parser.parse(content, "theme")
                    location = parser.parse(content, "location")
                    print(f"   ✅ Parsed doc id: {doc.get('id', 'N/A')} (sentiment: {sentiment}, theme: {theme})")
                except Exception as e:
                    print(f"   ❌ Error parsing document {doc.get('id')}: {e}")
                    # Continue with default values
            else:
                print(f"   ⚠️  No parser available for doc {doc.get('id', 'N/A')}")

            # Generate embedding
            embedding = []
            if embedding_model:
                try:
                    embedding = embedding_model.encode(content, convert_to_tensor=False).tolist()
                except Exception as e:
                    print(f"   ❌ Error generating embedding for document {doc.get('id')}: {e}")
                    embedding = []
            else:
                print(f"   📝 Skipping embedding for doc {doc.get('id', 'N/A')} (no model available)")
                embedding = []  # Empty embedding array

            # Create processed post entry
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
                }, ensure_ascii=False)
            }
            processed_posts.append(processed_post)

            # Update checkpoint
            checkpoint["last_processed_index"] = doc_index
            checkpoint["total_processed"] = len(processed_posts)

        # Save checkpoint and processed posts after each batch
        save_checkpoint(checkpoint)
        save_processed_posts(processed_posts)

        # Progress reporting
        elapsed = time.time() - start_time
        docs_per_sec = len(processed_posts) / elapsed if elapsed > 0 else 0
        progress_pct = (len(processed_posts) / len(all_documents)) * 100
        print(f"   📊 Progress: {len(processed_posts)}/{len(all_documents)} processed ({docs_per_sec:.2f} docs/sec, {progress_pct:.1f}%)")

        # Rate limiting: delay between batches
        if parser and isinstance(parser, GeminiParser):
            print("   ⏱️  Rate limiting: waiting 3 seconds...")
            time.sleep(3)  # 3 second delay for Gemini rate limiting
        else:
            time.sleep(1)  # 1 second delay for other parsers

    # Final save and status update
    checkpoint["status"] = "completed"  # type: ignore
    checkpoint["end_time"] = time.time()  # type: ignore
    save_processed_posts(processed_posts)
    save_checkpoint(checkpoint)

    print("\n" + "=" * 60)
    print("🎉 Pipeline Complete!")
    print(f"   📊 Total processed: {len(processed_posts)}/{len(all_documents)}")
    print(f"   💾 Processed posts saved to: {PROCESSED_PATH}")
    print(f"   📋 Checkpoint saved to: {CHECKPOINT_PATH}")

    # Rate limiting summary
    if parser and hasattr(parser, 'get_rate_limit_status'):
        final_status = parser.get_rate_limit_status()  # type: ignore
        print(f"   📈 Final rate limit status: {final_status}")

    print("\n✅ Ready for next steps: Dashboard integration and human review!")

if __name__ == "__main__":
    # Check for Gemini API key
    if not os.getenv("GEMINI_API_KEY"):
        print("⚠️  Warning: GEMINI_API_KEY not set. Using LangExtract fallback.")
        print("   To use Gemini with rate limiting, set: export GEMINI_API_KEY='your-api-key'")
    else:
        print("🔑 Gemini API key detected - using Gemini with rate limiting!")

    main()