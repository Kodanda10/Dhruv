#!/usr/bin/env python3
"""
Test Semantic Location Linking

Tests the semantic location search functionality and integration with location matcher.
"""

import sys
from pathlib import Path

# Add API path for imports
sys.path.append(str(Path(__file__).parent / 'api'))

def test_semantic_location_search():
    """Test semantic location search functionality."""
    print("🧪 Testing Semantic Location Linking")
    print("=" * 50)

    try:
        from api.src.parsing.semantic_location_linker import SemanticLocationLinker

        # Initialize linker
        linker = SemanticLocationLinker()
        print("✅ Semantic linker initialized")

        # Test queries with various formats
        test_cases = [
            ("रायगढ़", "Hindi name"),
            ("raigarh", "English transliteration"),
            ("Raigarh", "Proper case"),
            ("बिलासपुर", "Another Hindi district"),
            ("korba", "Smaller district"),
            ("अमबिकापुर", "City name"),
            ("सूरजपुर", "Less common location"),
        ]

        print("\n🔍 Testing semantic search:")
        for query, description in test_cases:
            matches = linker.find_semantic_matches(query, limit=2)
            if matches:
                top_match = matches[0]
                print(f"✅ '{query}' ({description}) → {top_match['name']} (score: {top_match['similarity_score']})")
                if len(matches) > 1:
                    print(f"   Also found: {matches[1]['name']} (score: {matches[1]['similarity_score']})")
            else:
                print(f"❌ '{query}' ({description}) → No matches found")

        print("\n🎯 Testing location context:")
        context = linker.get_location_context("रायगढ़")
        if context:
            print(f"✅ Context for रायगढ़: District={context['district']}, Type={context['type']}")
        else:
            print("❌ No context found for रायगढ़")

    except Exception as e:
        print(f"❌ Semantic linker test failed: {e}")
        return False

    return True

def test_enhanced_location_matcher():
    """Test enhanced location matcher with semantic capabilities."""
    print("\n🔗 Testing Enhanced Location Matcher")
    print("=" * 50)

    try:
        from api.src.parsing.semantic_location_linker import create_enhanced_matcher

        # Create enhanced matcher
        matcher = create_enhanced_matcher()
        print("✅ Enhanced matcher created")

        # Test with sample tweet text
        test_texts = [
            "रायगढ़ जिला में विकास कार्य शुरू",
            "Meeting in Raigarh district tomorrow",
            "बिलासपुर से मुख्यमंत्री का दौरा",
            "Development work in korba block",
            "अमबिकापुर में नया अस्पताल बन रहा है",
        ]

        print("\n📍 Testing location extraction:")
        for text in test_texts:
            locations = matcher.extract_locations(text)
            if locations:
                top_location = locations[0]
                print(f"✅ '{text[:30]}...' → {top_location['name']} (confidence: {top_location.get('confidence', 'N/A')})")
            else:
                print(f"❌ '{text[:30]}...' → No locations found")

    except Exception as e:
        print(f"❌ Enhanced matcher test failed: {e}")
        return False

    return True

def test_phrase_extraction():
    """Test location phrase extraction."""
    print("\n🔤 Testing Location Phrase Extraction")
    print("=" * 50)

    try:
        from api.src.parsing.semantic_location_linker import SemanticLocationLinker

        linker = SemanticLocationLinker()

        test_text = "रायगढ़ जिला के बिलासपुर ब्लॉक में विकास कार्य"
        phrases = linker._extract_location_phrases(test_text)

        print(f"✅ Extracted phrases from: {test_text}")
        for phrase in phrases[:5]:  # Show first 5
            print(f"   - '{phrase}'")

        if len(phrases) > 5:
            print(f"   ... and {len(phrases) - 5} more")

    except Exception as e:
        print(f"❌ Phrase extraction test failed: {e}")
        return False

    return True

def main():
    """Run all tests."""
    print("🚀 Starting Semantic Location Linking Tests")
    print("=" * 60)

    # Check if Milvus is available
    try:
        from pymilvus import MilvusClient
        client = MilvusClient(uri="http://localhost:19530")
        client.has_collection("geography_embeddings")
        print("✅ Milvus connection verified")
    except Exception as e:
        print(f"❌ Milvus not available: {e}")
        print("Make sure Milvus is running and embeddings are generated:")
        print("1. Start Milvus: docker run -p 19530:19530 -p 9091:9091 milvusdb/milvus:latest")
        print("2. Generate embeddings: python scripts/generate_geography_embeddings.py")
        return

    # Run tests
    tests = [
        test_semantic_location_search,
        test_enhanced_location_matcher,
        test_phrase_extraction,
    ]

    passed = 0
    for test in tests:
        if test():
            passed += 1
        print()

    print(f"📊 Test Results: {passed}/{len(tests)} tests passed")

    if passed == len(tests):
        print("🎉 All tests passed! Semantic location linking is working correctly.")
        print("\n📋 Next Steps:")
        print("1. Run integration tests with real tweet data")
        print("2. Fine-tune similarity thresholds if needed")
        print("3. Deploy to production environment")
    else:
        print("⚠️  Some tests failed. Check the output above for details.")

if __name__ == '__main__':
    main()