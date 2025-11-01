#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
coverage_report.py — Compute mapping coverage for CG geography names.

This tool compares:
- data/name_mappings/missing_names.ndjson (append-only log of unmapped names)
- data/name_mappings/geography_name_map.json (curated/merged mappings)

and reports coverage (per-kind and overall) based on canonical English keys.

Usage:
  python api/src/sota/dataset_builders/tools/coverage_report.py
    [--missing <path/to/missing_names.ndjson>]
    [--json-map <path/to/geography_name_map.json>]
    [--json-out <path/to/summary.json>]
    [--max-samples 20]

Outputs a JSON summary to stdout and optionally writes it to --json-out.

Notes:
- Canonicalization: English keys are normalized to lowercased, ASCII-friendly,
  whitespace-collapsed strings to ensure stable matching across sources.
- Only kinds in {"village","gram_panchayat"} are considered for coverage.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Set, Tuple


KIND_VALUES: Tuple[str, ...] = ("village", "gram_panchayat")


# -------------------------
# Repo root & default paths
# -------------------------

def _repo_root() -> str:
    # api/src/sota/dataset_builders/tools/coverage_report.py -> up 5 levels
    here = os.path.abspath(os.path.dirname(__file__))
    return os.path.abspath(os.path.join(here, "..", "..", "..", "..", ".."))


def _mappings_dir() -> str:
    return os.path.join(_repo_root(), "data", "name_mappings")


def _default_missing_path() -> str:
    return os.path.join(_mappings_dir(), "missing_names.ndjson")


def _default_json_map_path() -> str:
    return os.path.join(_mappings_dir(), "geography_name_map.json")


# -------------------------
# Normalization helpers
# -------------------------

def _normalize_ws(s: str) -> str:
    return " ".join((s or "").strip().split())


def _ascii_friendly(s: str) -> str:
    """
    Basic ASCII-friendly fold for English tokens:
    - lowercases
    - replaces non-alnum with spaces
    - collapses whitespace
    """
    s = (s or "").lower()
    # Replace any non [a-z0-9] with a space
    out_chars: List[str] = []
    for ch in s:
        if "a" <= ch <= "z" or "0" <= ch <= "9":
            out_chars.append(ch)
        else:
            out_chars.append(" ")
    return _normalize_ws("".join(out_chars))


def _canon_en(english: str) -> str:
    return _ascii_friendly(english)


# -------------------------
# Data structures
# -------------------------

@dataclass
class MissingEntry:
    kind: str
    english_original: str
    canon: str


# -------------------------
# Loaders
# -------------------------

def load_missing_ndjson(path: str) -> Tuple[List[MissingEntry], int]:
    """
    Load missing_names.ndjson and return:
      - unique entries (deduped by (kind, canon_english), preserving first-seen english)
      - total_lines read (for diagnostics)
    """
    entries: List[MissingEntry] = []
    total_lines = 0

    if not os.path.exists(path):
        return (entries, total_lines)

    # We preserve first-seen original English for each canon key
    seen: Set[Tuple[str, str]] = set()

    with io.open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            total_lines += 1
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            kind = _normalize_ws(str(obj.get("kind", ""))).lower()
            if kind not in KIND_VALUES:
                continue
            en = _normalize_ws(str(obj.get("english", "")))
            if not en:
                continue
            canon = _canon_en(en)
            key = (kind, canon)
            if key in seen:
                continue
            seen.add(key)
            entries.append(MissingEntry(kind=kind, english_original=en, canon=canon))
    return (entries, total_lines)


def load_mapping_json(path: str) -> Dict[str, Set[str]]:
    """
    Load geography_name_map.json and return:
      { kind: { canon_english, ... }, ... }
    Missing or malformed files yield empty sets.
    """
    by_kind: Dict[str, Set[str]] = {k: set() for k in KIND_VALUES}
    if not os.path.exists(path):
        return by_kind
    try:
        with io.open(path, "r", encoding="utf-8") as fh:
            obj = json.load(fh)
        for kind in KIND_VALUES:
            m = obj.get(kind)
            if isinstance(m, dict):
                for en_key in m.keys():
                    by_kind[kind].add(_canon_en(_normalize_ws(str(en_key))))
    except Exception:
        # Treat as empty mapping on error
        pass
    return by_kind


# -------------------------
# Coverage computation
# -------------------------

@dataclass
class CoverageStats:
    covered: int
    total: int

    @property
    def percent(self) -> float:
        if self.total <= 0:
            return 100.0
        return round(100.0 * (self.covered / float(self.total)), 2)


def compute_coverage(
    missing: List[MissingEntry],
    mapped_by_kind: Dict[str, Set[str]],
) -> Tuple[Dict[str, CoverageStats], Dict[str, List[str]]]:
    """
    Returns:
      - coverage per kind: { kind: CoverageStats }
      - samples of unmapped original english per kind: { kind: [english, ...] }
    """
    # Build sets of missing canon keys per kind and retain a map for samples
    miss_sets: Dict[str, Set[str]] = {k: set() for k in KIND_VALUES}
    canon_to_original: Dict[str, Dict[str, str]] = {k: {} for k in KIND_VALUES}

    for e in missing:
        miss_sets[e.kind].add(e.canon)
        # preserve first-seen original
        canon_to_original[e.kind].setdefault(e.canon, e.english_original)

    coverage: Dict[str, CoverageStats] = {}
    unmapped_samples: Dict[str, List[str]] = {}

    for kind in KIND_VALUES:
        missing_keys = miss_sets[kind]
        mapped_keys = mapped_by_kind.get(kind, set())
        covered = len(missing_keys & mapped_keys)
        total = len(missing_keys)
        coverage[kind] = CoverageStats(covered=covered, total=total)

        # Collect samples of unmapped originals
        leftover = missing_keys - mapped_keys
        samples: List[str] = []
        for c in leftover:
            orig = canon_to_original[kind].get(c, c)
            samples.append(orig)
        unmapped_samples[kind] = samples

    return coverage, unmapped_samples


def aggregate_overall(coverage: Dict[str, CoverageStats]) -> CoverageStats:
    covered = sum(coverage[k].covered for k in KIND_VALUES if k in coverage)
    total = sum(coverage[k].total for k in KIND_VALUES if k in coverage)
    return CoverageStats(covered=covered, total=total)


# -------------------------
# CLI
# -------------------------

def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Compute coverage of curated mappings against missing_names.ndjson.")
    p.add_argument("--missing", default=_default_missing_path(), help=f"Path to missing_names.ndjson (default: {_default_missing_path()})")
    p.add_argument("--json-map", default=_default_json_map_path(), help=f"Path to geography_name_map.json (default: {_default_json_map_path()})")
    p.add_argument("--json-out", default=None, help="Optional path to write JSON summary")
    p.add_argument("--max-samples", type=int, default=20, help="Max unmapped samples to include per kind")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    ap = _build_arg_parser()
    args = ap.parse_args(argv)

    missing_entries, total_lines = load_missing_ndjson(args.missing)
    mapped_by_kind = load_mapping_json(args.json_map)

    coverage_by_kind, unmapped_samples = compute_coverage(missing_entries, mapped_by_kind)
    overall = aggregate_overall(coverage_by_kind)

    # Trim samples
    trimmed_samples: Dict[str, List[str]] = {}
    for kind in KIND_VALUES:
        samples = unmapped_samples.get(kind, [])[: max(0, int(args.max_samples))]
        trimmed_samples[kind] = samples

    # Counts
    uniq_missing_counts = {k: coverage_by_kind[k].total for k in KIND_VALUES}
    mapped_counts = {k: len(mapped_by_kind.get(k, set())) for k in KIND_VALUES}

    summary = {
        "ok": True,
        "paths": {
            "missing": os.path.relpath(args.missing, _repo_root()),
            "json_map": os.path.relpath(args.json_map, _repo_root()),
        },
        "missing": {
            "total_lines": total_lines,
            "unique": {
                "village": uniq_missing_counts["village"],
                "gram_panchayat": uniq_missing_counts["gram_panchayat"],
                "overall": uniq_missing_counts["village"] + uniq_missing_counts["gram_panchayat"],
            },
        },
        "mapping_json": {
            "entries": {
                "village": mapped_counts["village"],
                "gram_panchayat": mapped_counts["gram_panchayat"],
                "overall": mapped_counts["village"] + mapped_counts["gram_panchayat"],
            }
        },
        "coverage": {
            "village": {
                "covered": coverage_by_kind["village"].covered,
                "total": coverage_by_kind["village"].total,
                "percent": coverage_by_kind["village"].percent,
            },
            "gram_panchayat": {
                "covered": coverage_by_kind["gram_panchayat"].covered,
                "total": coverage_by_kind["gram_panchayat"].total,
                "percent": coverage_by_kind["gram_panchayat"].percent,
            },
            "overall": {
                "covered": overall.covered,
                "total": overall.total,
                "percent": overall.percent,
            },
        },
        "unmapped_samples": trimmed_samples,
    }

    # Emit to stdout
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    # Optional write
    if args.json_out:
        out_path = args.json_out
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        tmp = out_path + ".tmp"
        with io.open(tmp, "w", encoding="utf-8") as fh:
            json.dump(summary, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, out_path)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        sys.stderr.write("Interrupted\n")
        raise SystemExit(130)
