#!/usr/bin/env python3
"""
Simple Gemini Parser for Dhruv Project Posts
Processes posts using Gemini AI with proper rate limiting
"""

import os
import json
import time
import sys
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def create_simple_gemini_parser():
    """Create a simple Gemini parser without complex dependencies"""
    try:
        import google.generativeai as genai
    except ImportError:
        raise ImportError("google-generativeai package not installed. Run: pip install google-generativeai")

    class SimpleGeminiParser:
        def __init__(self):
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY not found in environment")

            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel("gemini-1.5-flash")
            self.request_count = 0
            self.last_request_time = 0
            self.min_delay = 2  # 2 seconds between requests (30 requests/minute max)

        def parse(self, text: str, entity: str) -> str:
            """Parse text for entity with rate limiting"""
            # Rate limiting
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            if time_since_last < self.min_delay:
                sleep_time = self.min_delay - time_since_last
                time.sleep(sleep_time)

            # Create prompt based on entity
            if entity == "sentiment":
                prompt = f"Analyze the sentiment of this text and respond with only one word: 'positive', 'negative', or 'neutral'.\n\nText: {text}"
            elif entity == "theme":
                prompt = f"Extract the main theme/topic from this text. Respond with a short phrase in the same language as the text.\n\nText: {text}"
            elif entity == "location":
                prompt = f"Extract the primary location mentioned in this text. If no location is mentioned, respond with 'unknown'.\n\nText: {text}"
            else:
                return "unknown"

            try:
                response = self.model.generate_content(prompt)
                result = response.text.strip()
                self.last_request_time = time.time()
                self.request_count += 1

                # Progress indicator
                if self.request_count % 10 == 0:
                    print(f"   Processed {self.request_count} requests...")

                return result
            except Exception as e:
                print(f"   Error: {e}")
                return "unknown"

    return SimpleGeminiParser()

def main():
    print("🚀 Dhruv Project - Gemini Post Parser")
    print("=" * 50)

    # Check if posts file exists
    posts_file = "data/posts_new.json"
    if not os.path.exists(posts_file):
        print(f"❌ Posts file not found: {posts_file}")
        return

    # Load posts
    print("📂 Loading posts...")
    with open(posts_file, 'r', encoding='utf-8') as f:
        posts = json.load(f)

    print(f"✅ Loaded {len(posts)} posts (IDs {posts[0]['id']} to {posts[-1]['id']})")

    # Check for existing processed posts
    processed_file = "data/posts_new_processed.json"
    processed_posts = []
    if os.path.exists(processed_file):
        try:
            with open(processed_file, 'r', encoding='utf-8') as f:
                processed_posts = json.load(f)
            print(f"📂 Found {len(processed_posts)} already processed posts")
        except:
            print("⚠️  Processed posts file exists but is corrupted - starting fresh")
            processed_posts = []

    # Find which posts still need processing
    processed_ids = {p['id'] for p in processed_posts}
    posts_to_process = [p for p in posts if p['id'] not in processed_ids]

    if not posts_to_process:
        print("✅ All posts have already been processed!")
        return

    print(f"🎯 Need to process {len(posts_to_process)} posts")
    print(f"   Already processed: {len(processed_posts)} posts")
    print(f"   Remaining: {len(posts_to_process)} posts")

    # Initialize Gemini parser
    print("🤖 Initializing Gemini parser...")
    try:
        parser = create_simple_gemini_parser()
        print("✅ Gemini parser ready")
    except Exception as e:
        print(f"❌ Failed to initialize Gemini: {e}")
        return

    # Process remaining posts
    print("🎯 Starting processing with rate limiting...")
    start_time = time.time()
    errors = []
    batch_size = 10  # Save every 10 posts

    for i, post in enumerate(posts_to_process):
        post_id = post['id']
        content = post.get('content', '')

        if not content:
            print(f"⚠️  Skipping empty content for post {post_id}")
            continue

        # Progress indicator
        if (i + 1) % 5 == 0 or i == 0:
            elapsed = time.time() - start_time
            progress = ((i + 1) / len(posts_to_process)) * 100
            eta = (elapsed / (i + 1)) * (len(posts_to_process) - i - 1) if i > 0 else 0
            print(".1f")
        try:
            # Parse with Gemini
            sentiment = parser.parse(content, "sentiment")
            theme = parser.parse(content, "theme")
            location = parser.parse(content, "location")

            # Create processed post
            processed_post = {
                'id': post_id,
                'timestamp': post['timestamp'],
                'content': content,
                'sentiment': sentiment,
                'purpose': theme,
                'parsed_metadata': json.dumps({
                    'theme': theme,
                    'location': location,
                    'sentiment': sentiment
                }, ensure_ascii=False)
            }

            processed_posts.append(processed_post)
            print(f"✅ Post {post_id}: sentiment='{sentiment}', theme='{theme}'")

            # Save incrementally every batch_size posts
            if len(processed_posts) % batch_size == 0:
                print(f"💾 Saving progress... ({len(processed_posts)} posts)")
                with open(processed_file, 'w', encoding='utf-8') as f:
                    json.dump(processed_posts, f, ensure_ascii=False, indent=2)

        except Exception as e:
            error_msg = f"Error processing post {post_id}: {str(e)}"
            print(f"❌ {error_msg}")
            errors.append({
                'post_id': post_id,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
            continue

    # Final save
    print(f"\n💾 Final save of {len(processed_posts)} processed posts...")
    with open(processed_file, 'w', encoding='utf-8') as f:
        json.dump(processed_posts, f, ensure_ascii=False, indent=2)

    # Save error log if any
    if errors:
        error_file = "data/processing_errors.json"
        with open(error_file, 'w', encoding='utf-8') as f:
            json.dump(errors, f, ensure_ascii=False, indent=2)
        print(f"⚠️  Errors saved to: {error_file}")

    # Final summary
    total_time = time.time() - start_time
    print("\n" + "=" * 50)
    print("🎉 PROCESSING COMPLETE!")
    print("=" * 50)
    print(f"📊 Total posts processed: {len(processed_posts)}/{len(posts)}")
    print(f"❌ Errors encountered: {len(errors)}")
    print(f"⏱️  Total processing time: {total_time:.1f} seconds")
    print(f"🚀 Average time per post: {total_time / max(len(processed_posts) - len(processed_posts) + len(posts_to_process), 1):.2f} seconds")
    print(f"💾 Results saved to: {processed_file}")
    print("\n🎯 Next steps:")
    print("   1. Check processed posts in data/posts_new_processed.json")
    print("   2. Start the dashboard servers to view results")
    print("   3. Use the Human Review Dashboard for corrections")