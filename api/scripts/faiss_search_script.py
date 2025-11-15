#!/usr/bin/env python3
"""FAISS search bridge used by the Next.js API."""

from __future__ import annotations

import contextlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parents[2]
API_SRC = REPO_ROOT / "api" / "src"
sys.path.insert(0, str(API_SRC))


def exit_with_error(message: str, code: int = 1, meta: Dict[str, Any] | None = None) -> None:
    payload: Dict[str, Any] = {"error": message}
    if meta:
        payload.update(meta)
    print(json.dumps(payload))
    sys.exit(code)


try:
    from parsing.semantic_location_linker import MultilingualFAISSLocationLinker  # type: ignore
except ModuleNotFoundError as exc:  # pragma: no cover
    exit_with_error(
        "missing_python_dependency",
        3,
        {
            "detail": str(exc),
            "hint": "Install FAISS dependencies via `pip install -r requirements.txt`.",
        },
    )


def load_linker() -> MultilingualFAISSLocationLinker:
    linker: MultilingualFAISSLocationLinker | None = None
    try:
        with contextlib.redirect_stdout(sys.stderr):
            linker = MultilingualFAISSLocationLinker()
            linker.load_multilingual_data()
    except ModuleNotFoundError as exc:  # pragma: no cover
        exit_with_error(
            "missing_python_dependency",
            3,
            {
                "detail": str(exc),
                "hint": "Install FAISS dependencies via `pip install -r requirements.txt`.",
            },
        )
    except Exception as exc:  # pragma: no cover
        exit_with_error("faiss_initialization_failed", 2, {"detail": str(exc)})

    if not linker or not getattr(linker, "data_loaded", False):
        exit_with_error("faiss_index_not_loaded", 2, {"hint": "Run labs:faiss:build to generate embeddings."})

    return linker


def search(query: str, limit: int) -> List[Dict[str, Any]]:
    linker = load_linker()

    if query == "__GET_INDEX_STATS__":
        index_dir = REPO_ROOT / "data" / "embeddings" / "multilingual_geography"
        stats = {
            "locationCount": len(getattr(linker, "locations", [])),
            "dimension": getattr(linker, "dimension", 0),
            "indexPath": str(index_dir / "faiss_index.bin"),
        }
        print(json.dumps(stats, ensure_ascii=False))
        return []

    matches = linker.find_semantic_matches(query, limit=limit, min_score=0.6)
    formatted = []
    for idx, match in enumerate(matches):
        formatted.append(
            {
                "id": match.get("id", f"faiss-{idx}"),
                "name": match.get("name", ""),
                "score": float(match.get("similarity_score", 0.0)),
                "match_type": match.get("match_type", "semantic"),
            }
        )

    print(json.dumps(formatted, ensure_ascii=False))
    return formatted


def main() -> None:
    if len(sys.argv) < 3:
        exit_with_error("usage", meta={"detail": "python faiss_search_script.py <query> <limit>"})

    query = sys.argv[1]
    limit = int(sys.argv[2])
    search(query, limit)


if __name__ == "__main__":
    main()
