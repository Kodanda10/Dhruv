import os
import json
import sys
import time
from sentence_transformers import SentenceTransformer
from src.parsing.parser import create_parser, GeminiParser

# --- Configuration ---
EMBEDDING_MODEL = 'paraphrase-MiniLM-L6-v2'
DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'posts_new.json')
CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'posts_new_checkpoint.json')
PROCESSED_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'posts_new_processed.json')

def save_processed_posts(processed_posts):
    """Save processed posts to file"""
    print(f"Saving {len(processed_posts)} processed posts to {PROCESSED_PATH}")
    with open(PROCESSED_PATH, 'w', encoding='utf-8') as f:
        json.dump(processed_posts, f, ensure_ascii=False, indent=2)

def main():
    """Simple test processing of first 5 posts"""

    print("🧪 Testing parsing pipeline with first 5 posts...")

    # Load data
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        all_documents = json.load(f)

    print(f"Total documents: {len(all_documents)}")

    # Initialize parser
    try:
        parser = create_parser("gemini")
        print("Using Gemini parser")
    except ValueError:
        parser = create_parser("langextract")
        print("Using LangExtract parser")

    # Initialize embedding model
    embedding_model = SentenceTransformer(EMBEDDING_MODEL)
    print("Embedding model loaded")

    # Process first 5 posts
    processed_posts = []
    test_posts = all_documents[:5]  # First 5 posts only

    print(f"\nProcessing {len(test_posts)} test posts...")

    for i, doc in enumerate(test_posts):
        content = doc.get("content", "")
        if not content:
            continue

        print(f"Processing post {i+1}: ID {doc.get('id')}")

        try:
            sentiment = parser.parse(content, "sentiment")
            theme = parser.parse(content, "theme")
            location = parser.parse(content, "location")
            print(f"  ✅ Parsed: sentiment='{sentiment}', theme='{theme}', location='{location}'")
        except Exception as e:
            print(f"  ❌ Error parsing: {e}")
            continue

        try:
            embedding = embedding_model.encode(content, convert_to_tensor=False).tolist()
            print(f"  ✅ Generated embedding: {len(embedding)} dimensions")
        except Exception as e:
            print(f"  ❌ Error generating embedding: {e}")
            continue

        # Create processed post
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
        print(f"  ✅ Added to processed posts (total: {len(processed_posts)})")

    # Save results
    save_processed_posts(processed_posts)

    print("\n🎉 Test complete!")
    print(f"Processed {len(processed_posts)} posts")
    print(f"Check {PROCESSED_PATH} for results")

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()