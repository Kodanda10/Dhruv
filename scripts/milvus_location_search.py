#!/usr/bin/env python3
"""CLI helper to search Milvus-backed semantic location index."""
import json
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API_SRC = ROOT / 'api' / 'src'
sys.path.insert(0, str(API_SRC))

try:
    from parsing.semantic_location_linker import SemanticLocationLinker
except Exception as exc:  # pragma: no cover
    print(json.dumps({"error": f"failed to import linker: {exc}"}))
    sys.exit(1)


def main() -> None:
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: milvus_location_search.py <query> <limit> [kind]"}))
        sys.exit(1)

    query = sys.argv[1]
    limit = int(sys.argv[2])
    kind = sys.argv[3] if len(sys.argv) > 3 else 'unknown'

    try:
        linker = SemanticLocationLinker(vector_backend='milvus')
        matches = linker.find_semantic_matches(query, limit=limit)
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)

    formatted = []
    for match in matches:
        formatted.append({
            'name': match.get('name', ''),
            'score': float(match.get('similarity_score', 0.0)),
            'kind': kind,
        })

    print(json.dumps({'results': formatted}))


if __name__ == '__main__':
    main()
