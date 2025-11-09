#!/usr/bin/env python3
"""
FAISS Search Helper Script
Called from Node.js to perform vector search
"""

import sys
import json
import os
from pathlib import Path

# Add api directory to path
api_path = Path(__file__).parent.parent.parent.parent / 'api' / 'src'
sys.path.insert(0, str(api_path))

try:
    from parsing.semantic_location_linker import MultilingualFAISSLocationLinker
    
    # Get query and limit from command line args
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: search_helper.py <query> <limit>"}))
        sys.exit(1)
    
    query = sys.argv[1]
    limit = int(sys.argv[2])
    
    # Initialize linker
    linker = MultilingualFAISSLocationLinker(embedding_model="intfloat/multilingual-e5-base")
    linker.load_multilingual_data()
    
    if not linker.data_loaded:
        print(json.dumps({"error": "Failed to load FAISS index"}))
        sys.exit(1)
    
    # Perform search
    results = linker.find_semantic_matches(query, limit=limit, min_score=0.5)
    
    # Format results
    formatted_results = []
    for i, result in enumerate(results):
        formatted_results.append({
            "id": str(i),
            "name": result.get("name", ""),
            "score": result.get("similarity_score", 0.0),
            "similarity_score": result.get("similarity_score", 0.0),
            "source": result.get("source", "multilingual_faiss_search"),
            "match_type": result.get("match_type", "semantic")
        })
    
    print(json.dumps({"success": True, "results": formatted_results}))
    
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)

