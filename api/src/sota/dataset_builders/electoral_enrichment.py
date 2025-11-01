#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Electoral enrichment utilities for Chhattisgarh datasets.

This module deterministically attaches Assembly (Vidhan Sabha) and
Parliamentary (Lok Sabha) constituencies to pre-normalised geography or
urban records. It supports multi-level lookups (district, block, ULB) and
writes rejects for any records that cannot be matched.

Usage patterns:
    - Wrap an existing dataset builder:
        enriched_lines = list(
            enrich_from_builder(build_cg_urban_excel_dataset)
        )

    - Enrich an existing NDJSON file on disk via CLI:
        python electoral_enrichment.py --input data/urban.ndjson \
            --output data/urban_with_constituencies.ndjson

Feature flags / env-vars:
    CG_ELECTORAL_LOOKUP_PATH   → override lookup JSON
    CG_ELECTORAL_REJECTS_PATH  → override rejects NDJSON
    CG_ELECTORAL_STRICT=off    → continue on mismatches (skip records)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
from dataclasses import dataclass
from typing import Dict, Iterable, Iterator, List, Optional, Tuple

INFO_KEYS = ("assembly", "parliamentary")


def repo_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))


DEFAULT_LOOKUP_PATH = os.path.join(repo_root(), "data", "constituencies.json")
DEFAULT_REJECTS_PATH = os.path.join(repo_root(), "data", "rejects", "electoral_mismatches.ndjson")
DEFAULT_SOURCE_LABEL = "dataset_builder"


# ---------------------------------------------------------------------------
# Canonicalisation helpers
# ---------------------------------------------------------------------------

def normalize_whitespace(value: str) -> str:
    if not value:
        return ""
    return " ".join(str(value).strip().split())


def canon(value: str) -> str:
    """Lowercase, strip accents and collapse whitespace for stable keys."""
    if not value:
        return ""
    text = normalize_whitespace(value)
    text = unicodedata.normalize("NFKC", text).lower()
    return " ".join(text.split())


# ---------------------------------------------------------------------------
# Lookup handling
# ---------------------------------------------------------------------------

@dataclass
class ElectoralInfo:
    assembly: str
    parliamentary: str
    source_level: str


class ElectoralLookup:
    def __init__(self, districts: Dict[str, Dict[str, str]],
                 blocks: Dict[str, Dict[str, str]],
                 ulbs: Dict[str, Dict[str, str]]):
        self.districts = districts
        self.blocks = blocks
        self.ulbs = ulbs

    @classmethod
    def from_path(cls, path: Optional[str]) -> "ElectoralLookup":
        lookup_path = path or DEFAULT_LOOKUP_PATH
        if not os.path.exists(lookup_path):
            raise FileNotFoundError(f"Electoral lookup not found at {lookup_path}")
        with open(lookup_path, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
        return cls.from_dict(raw)

    @classmethod
    def from_dict(cls, raw: Dict) -> "ElectoralLookup":
        districts: Dict[str, Dict[str, str]] = {}
        blocks: Dict[str, Dict[str, str]] = {}
        ulbs: Dict[str, Dict[str, str]] = {}

        def ensure_payload(payload: Dict, fallback: Optional[Dict[str, str]] = None) -> Dict[str, str]:
            merged: Dict[str, str] = {}
            for key in INFO_KEYS:
                value = payload.get(key) or (fallback or {}).get(key)
                if not value:
                    raise ValueError(f"Missing '{key}' in electoral lookup entry")
                merged[key] = normalize_whitespace(value)
            return merged

        if any(k in raw for k in ("districts", "blocks", "ulbs")):
            raw_districts = raw.get("districts", {}) or {}
            for dist_name, dist_payload in raw_districts.items():
                canon_dist = canon(dist_name)
                base_info = ensure_payload(dist_payload, None)
                districts[canon_dist] = base_info

                for block_name, block_payload in (dist_payload.get("blocks", {}) or {}).items():
                    blocks[f"{canon_dist}|{canon(block_name)}"] = ensure_payload(block_payload, base_info)

                for ulb_name, ulb_payload in (dist_payload.get("ulbs", {}) or {}).items():
                    ulbs[f"{canon_dist}|{canon(ulb_name)}"] = ensure_payload(ulb_payload, base_info)

            # Allow top-level blocks/ulbs maps if provided separately
            for block_key, payload in (raw.get("blocks", {}) or {}).items():
                blocks[canon(block_key)] = ensure_payload(payload, None)
            for ulb_key, payload in (raw.get("ulbs", {}) or {}).items():
                ulbs[canon(ulb_key)] = ensure_payload(payload, None)
        else:
            # Legacy format: {"district": {"assembly": ..., "parliamentary": ...}}
            for dist_name, payload in raw.items():
                if isinstance(payload, dict):
                    districts[canon(dist_name)] = ensure_payload(payload, None)

        if not districts:
            raise ValueError("Electoral lookup missing district mappings")

        return cls(districts=districts, blocks=blocks, ulbs=ulbs)

    def resolve(self, record: Dict[str, str]) -> Optional[ElectoralInfo]:
        district = record.get("district") or record.get("district_name")
        block = record.get("block") or record.get("sub_district") or record.get("tehsil")
        ulb = record.get("ulb") or record.get("municipality")

        if not district:
            return None

        canon_dist = canon(district)
        candidates: List[Tuple[str, str]] = []
        if ulb:
            candidates.append(("ulbs", f"{canon_dist}|{canon(ulb)}"))
        if block:
            candidates.append(("blocks", f"{canon_dist}|{canon(block)}"))
        candidates.append(("districts", canon_dist))

        for level, key in candidates:
            store = getattr(self, level)
            if key in store:
                info = store[key]
                return ElectoralInfo(
                    assembly=info["assembly"],
                    parliamentary=info["parliamentary"],
                    source_level=level[:-1]  # strip plural
                )
        return None


# ---------------------------------------------------------------------------
# Enrichment logic
# ---------------------------------------------------------------------------

def enrich_ndjson_lines(lines: Iterable[str],
                        lookup_path: Optional[str] = None,
                        rejects_path: Optional[str] = None,
                        strict: Optional[bool] = None,
                        source_label: str = DEFAULT_SOURCE_LABEL) -> Iterator[str]:
    lookup = ElectoralLookup.from_path(lookup_path)
    rejects: List[Dict[str, str]] = []
    output: List[str] = []
    strict_mode = lookup_bool_env(strict)

    for idx, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        record = json.loads(line)
        info = lookup.resolve(record)
        if not info:
            rejects.append(_reject_payload(record, source_label, idx, "lookup_miss"))
            if strict_mode:
                continue
            else:
                # skip silently when strict is False
                continue
        enriched = record.copy()
        enriched["assembly_constituency"] = info.assembly
        enriched["parliamentary_constituency"] = info.parliamentary
        enriched["electoral_match_level"] = info.source_level
        output.append(json.dumps(enriched, ensure_ascii=False))

    if rejects:
        _write_rejects(rejects, rejects_path or DEFAULT_REJECTS_PATH)
        if strict_mode:
            raise ValueError(f"Electoral enrichment missing {len(rejects)} mappings")

    for line in output:
        yield line


def enrich_from_builder(builder_func,
                        lookup_path: Optional[str] = None,
                        rejects_path: Optional[str] = None,
                        strict: Optional[bool] = None) -> Iterator[str]:
    base_lines = list(builder_func())
    return enrich_ndjson_lines(base_lines, lookup_path=lookup_path,
                               rejects_path=rejects_path, strict=strict,
                               source_label=builder_func.__name__)


def _reject_payload(record: Dict[str, str], source_label: str, idx: int, reason: str) -> Dict[str, str]:
    return {
        "reason": reason,
        "source": source_label,
        "index": idx,
        "district": record.get("district"),
        "block": record.get("block"),
        "ulb": record.get("ulb"),
    }


def _write_rejects(rejects: List[Dict[str, str]], path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as fh:
        for item in rejects:
            fh.write(json.dumps(item, ensure_ascii=False) + "\n")


def lookup_bool_env(explicit: Optional[bool]) -> bool:
    if explicit is not None:
        return explicit
    env = os.getenv("CG_ELECTORAL_STRICT", "on").strip().lower()
    return env not in {"off", "0", "false", "no"}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _parse_cli_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich NDJSON with electoral constituencies")
    parser.add_argument("--input", required=True, help="Path to input NDJSON file")
    parser.add_argument("--output", required=True, help="Path to output NDJSON file")
    parser.add_argument("--lookup", help="Override lookup JSON path")
    parser.add_argument("--rejects", help="Override rejects output path")
    parser.add_argument("--strict", choices=["on", "off"], help="Force strict mode on/off")
    return parser.parse_args(argv)


def _run_cli(args: argparse.Namespace) -> int:
    strict_override = None
    if args.strict == "on":
        strict_override = True
    elif args.strict == "off":
        strict_override = False

    with open(args.input, "r", encoding="utf-8") as fh:
        lines = list(fh)

    try:
        enriched = list(
            enrich_ndjson_lines(
                lines,
                lookup_path=args.lookup,
                rejects_path=args.rejects,
                strict=strict_override,
                source_label=os.path.basename(args.input)
            )
        )
    except ValueError as exc:
        sys.stderr.write(str(exc) + "\n")
        return 1

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        for line in enriched:
            fh.write(line + "\n")
    return 0


if __name__ == "__main__":
    exit_code = _run_cli(_parse_cli_args())
    sys.exit(exit_code)
