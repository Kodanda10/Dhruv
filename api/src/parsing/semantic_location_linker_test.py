#!/usr/bin/env python3
"""
CLI Test Harness for Multilingual Semantic Location Linker

Usage:
    python -m src.parsing.semantic_location_linker_test "रायगढ़ कलेक्टरेट"
    python -m src.parsing.semantic_location_linker_test --help
    python -m src.parsing.semantic_location_linker_test --backend faiss "bilaspur district"
    python -m src.parsing.semantic_location_linker_test --limit 5 --min-score 0.8 "कोरबा शहर"

This script provides a convenient CLI interface to test the multilingual semantic location linker
with various queries, backends, and configuration options.
"""

import argparse
import sys
from pathlib import Path

# Add the api directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.parsing.semantic_location_linker import create_semantic_linker


def format_match_result(query: str, matches: list, index: int) -> str:
    """Format a single match result for display."""
    if not matches:
        return f"❌ \"{query}\" → No matches found"

    top_match = matches[0]
    result = f"✅ \"{query}\" → {top_match['name']} (score: {top_match['similarity_score']:.3f})"

    if len(matches) > 1:
        for j, match in enumerate(matches[1:], 1):
            result += f"\n      + {match['name']} (score: {match['similarity_score']:.3f})"

    return result


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Test Multilingual Semantic Location Linker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m src.parsing.semantic_location_linker_test "रायगढ़ कलेक्टरेट"
  python -m src.parsing.semantic_location_linker_test --backend faiss "bilaspur district"
  python -m src.parsing.semantic_location_linker_test --limit 5 --min-score 0.8 "कोरबा शहर"
  python -m src.parsing.semantic_location_linker_test --no-transliteration "रायगढ़"
  python -m src.parsing.semantic_location_linker_test --no-synonyms "बिलासपुर जिला"
        """
    )

    parser.add_argument(
        'query',
        nargs='*',
        help='Location query to test (can be multiple queries)'
    )

    parser.add_argument(
        '--backend',
        choices=['auto', 'milvus', 'faiss'],
        default='auto',
        help='Backend to use (default: auto - tries Milvus then FAISS)'
    )

    parser.add_argument(
        '--limit',
        type=int,
        default=3,
        help='Maximum number of matches to return (default: 3)'
    )

    parser.add_argument(
        '--min-score',
        type=float,
        default=0.7,
        help='Minimum similarity score threshold (default: 0.7)'
    )

    parser.add_argument(
        '--no-transliteration',
        action='store_true',
        help='Disable transliteration support'
    )

    parser.add_argument(
        '--no-synonyms',
        action='store_true',
        help='Disable Hindi synonym expansion'
    )

    parser.add_argument(
        '--milvus-uri',
        help='Override Milvus URI (default: from environment)'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )

    args = parser.parse_args()

    # Handle case where no query provided
    if not args.query:
        print("❌ Error: No query provided")
        print("\nUsage examples:")
        print("  python -m src.parsing.semantic_location_linker_test \"रायगढ़\"")
        print("  python -m src.parsing.semantic_location_linker_test --backend faiss \"bilaspur district\"")
        parser.print_help()
        return 1

    # Join multiple query arguments
    query = ' '.join(args.query)

    try:
        print("🚀 Multilingual Semantic Location Linker - CLI Test")
        print("=" * 55)

        # Configure backend
        milvus_uri = args.milvus_uri
        if args.backend == 'faiss':
            # Force FAISS by using invalid Milvus URI
            milvus_uri = 'invalid://force-faiss'
        elif args.backend == 'milvus':
            # Ensure we have a valid URI for Milvus
            if not milvus_uri:
                milvus_uri = 'http://localhost:19530'

        # Create linker with specified options
        linker = create_semantic_linker(
            milvus_uri=milvus_uri,
            enable_transliteration=not args.no_transliteration,
            enable_synonym_expansion=not args.no_synonyms
        )

        if args.verbose:
            print(f"\n🔧 Configuration:")
            print(f"   Query: \"{query}\"")
            print(f"   Backend: {args.backend}")
            print(f"   Limit: {args.limit}")
            print(f"   Min Score: {args.min_score}")
            print(f"   Transliteration: {'disabled' if args.no_transliteration else 'enabled'}")
            print(f"   Synonym Expansion: {'disabled' if args.no_synonyms else 'enabled'}")
            print()

        # Test the query
        print("🧪 Testing Query:")
        print("-" * 20)

        matches = linker.find_semantic_matches(
            query,
            limit=args.limit,
            min_score=args.min_score
        )

        if matches:
            print(format_match_result(query, matches, 0))

            if args.verbose and len(matches) > 1:
                print(f"\n📊 Full Results ({len(matches)} matches):")
                for i, match in enumerate(matches, 1):
                    print(f"   {i}. {match['name']} (score: {match['similarity_score']:.3f})")

        else:
            print(f"❌ \"{query}\" → No matches found")

        print(f"\n🎉 Test complete!")

        return 0

    except Exception as e:
        print(f"❌ Test failed: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())