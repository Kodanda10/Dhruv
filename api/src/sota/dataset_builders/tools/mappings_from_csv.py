#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mappings_from_csv.py — Diff missing_names.ndjson against curated CSV and emit mapping NDJSON/JSON.

Goal
- Help populate curated Hindi and Nukta-Hindi spellings by matching curated CSV rows
  against missing entries recorded by the dataset builder.

Inputs
- missing_names.ndjson (append-only log of unmapped names)
- curated CSV with columns:
    - Required: english
    - Optional but recommended: kind ("village"|"gram_panchayat"), hindi, nukta_hindi
    - Optional metadata: district, block, source, verified_by, verified_on, notes

Outputs
- NDJSON file with mapping records (one JSON object per line) suitable for loading by translation.py
- JSON mapping object (optionally merged into an existing geography_name_map.json)

Default Paths (relative to repo root)
- Missing NDJSON: data/name_mappings/missing_names.ndjson
- Output NDJSON:  data/name_mappings/geography_name_map.ndjson
- Output JSON:    data/name_mappings/geography_name_map.json  (only if explicitly requested)

Matching Logic
- Matches curated rows to missing items by (kind, canonical_english).
- Canonicalization mirrors the translator: lowercase, trim, collapse whitespace,
  and keep only [a-z0-9-_ ] for English inputs (best-effort).

Usage
- Dry run (show summary only):
    python api/src/sota/dataset_builders/tools/mappings_from_csv.py --csv curated.csv --dry-run

- Emit NDJSON (append to default path):
    python api/src/sota/dataset_builders/tools/mappings_from_csv.py --csv curated.csv --out-ndjson

- Emit NDJSON (overwrite path) and also merge into JSON:
    python api/src/sota/dataset_builders/tools/mappings_from_csv.py \\
      --csv curated.csv \\
      --out-ndjson data/name_mappings/my_batch.ndjson --overwrite-ndjson \\
      --out-json data/name_mappings/geography_name_map.json --merge-json

- If your CSV lacks a "kind" column but all rows are villages:
    python api/src/sota/dataset_builders/tools/mappings_from_csv.py --csv curated.csv --default-kind village

Notes
- We never fabricate Hindi; if hindi/nukta_hindi are missing in CSV, that row is skipped.
- nukta_hindi defaults to hindi if not provided.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple


# -------------------------
# Repo root & default paths
# -------------------------

def _repo_root() -> str:
    # File location: <repo>/api/src/sota/dataset_builders/tools/mappings_from_csv.py
    here = os.path.abspath(os.path.dirname(__file__))
    # ascend 5 levels to reach repo root
    return os.path.abspath(os.path.join(here, "..", "..", "..", "..", ".."))


def _default_mappings_dir() -> str:
    return os.path.join(_repo_root(), "data", "name_mappings")


def _default_missing_path() -> str:
    return os.path.join(_default_mappings_dir(), "missing_names.ndjson")


def _default_out_ndjson() -> str:
    return os.path.join(_default_mappings_dir(), "geography_name_map.ndjson")


# -------------------------
# Normalization helpers (align with translator)
# -------------------------

def _normalize_ws(s: str) -> str:
    return " ".join((s or "").strip().split())


def _ascii_friendly(s: str) -> str:
    """
    Lowercased ascii-friendly for matching: keep [a-z0-9-_ ] and collapse spaces.
    Non-ASCII letters are left as-is to avoid data loss when inputs are Devanagari,
    but then lowercased/collapsed which still helps with simple consistency.
    """
    if not s:
        return s
    # allowlist ASCII, preserve others (which includes Devanagari) to avoid stripping official names in Hindi
    out: List[str] = []
    for ch in s:
        if ch.isalnum() or ch in (" ", "-", "_"):
            out.append(ch)
        else:
            # replace punctuation with space
            out.append(" ")
    return _normalize_ws("".join(out)).lower()


def _normalize_nukta(hindi: str) -> str:
    """Normalize nukta forms: drop stray combining nukta '़', preserve precomposed nukta letters."""
    if not hindi:
        return hindi
    out: List[str] = []
    for ch in hindi:
        if ch == "़":
            # skip stray nukta combining mark
            continue
        out.append(ch)
    return _normalize_ws("".join(out))


def _canon_en(s: str) -> str:
    return _ascii_friendly(_normalize_ws(s or ""))


# -------------------------
# IO types
# -------------------------

KIND_VALUES = ("village", "gram_panchayat")


@dataclass
class MappingRow:
    kind: str
    english: str
    hindi: str
    nukta_hindi: str
    # Optional metadata
    district: str = ""
    block: str = ""
    source: str = ""
    verified_by: str = ""
    verified_on: str = ""
    notes: str = ""

    @property
    def canon_key(self) -> Tuple[str, str]:
        return (self.kind, _canon_en(self.english))

    def to_ndjson_object(self) -> Dict[str, str]:
        obj = {
            "kind": self.kind,
            "english": _normalize_ws(self.english),
            "hindi": _normalize_ws(self.hindi),
            "nukta_hindi": _normalize_nukta(self.nukta_hindi or self.hindi),
        }
        # include optional metadata when present
        if self.district:
            obj["district"] = _normalize_ws(self.district)
        if self.block:
            obj["block"] = _normalize_ws(self.block)
        if self.source:
            obj["source"] = self.source.strip()
        if self.verified_by:
            obj["verified_by"] = self.verified_by.strip()
        if self.verified_on:
            obj["verified_on"] = self.verified_on.strip()
        if self.notes:
            obj["notes"] = self.notes.strip()
        return obj


# -------------------------
# Loading functions
# -------------------------

def load_missing_ndjson(path: str) -> Dict[Tuple[str, str], str]:
    """
    Load missing_names.ndjson and return a map:
        (kind, canon_english) -> first_seen_original_english
    """
    missing: Dict[Tuple[str, str], str] = {}
    if not os.path.exists(path):
        return missing
    with io.open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                continue
            kind = _normalize_ws(str(rec.get("kind", ""))).lower()
            if kind not in KIND_VALUES:
                continue
            en = rec.get("english")
            if not en:
                continue
            key = (kind, _canon_en(en))
            if key not in missing:
                missing[key] = _normalize_ws(en)
    return missing


def _normalize_header(h: str) -> str:
    return _normalize_ws(h).lower().replace("-", "_").replace(" ", "_")


def load_curated_csv(csv_path: str, default_kind: Optional[str] = None) -> List[MappingRow]:
    """
    Load curated CSV. Expected columns (case/space insensitive):
      - kind (optional; falls back to default_kind)
      - english (required)
      - hindi (recommended)
      - nukta_hindi (optional; falls back to hindi)
      - district, block, source, verified_by, verified_on, notes (optional)
    Rows without english or without hindi (and nukta_hindi) are skipped.
    """
    rows: List[MappingRow] = []
    if default_kind and default_kind not in KIND_VALUES:
        raise ValueError(f"Invalid default_kind: {default_kind} (must be one of {KIND_VALUES})")

    with io.open(csv_path, "r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        # normalize header names
        field_map = {name: _normalize_header(name) for name in (reader.fieldnames or [])}

        for raw in reader:
            # remap to normalized keys
            rec = {_normalize_header(k): (v or "").strip() for k, v in raw.items()}

            kind = rec.get("kind", "") or (default_kind or "")
            kind = _normalize_ws(kind).lower()
            if not kind:
                # cannot infer kind; skip
                continue
            if kind not in KIND_VALUES:
                # unsupported kind; skip
                continue

            english = rec.get("english", "")
            if not english:
                continue

            hindi = rec.get("hindi", "")
            nukta = rec.get("nukta_hindi", "")

            # Skip rows with no hindi and no nukta
            if not hindi and not nukta:
                continue

            row = MappingRow(
                kind=kind,
                english=english,
                hindi=hindi,
                nukta_hindi=nukta or hindi,
                district=rec.get("district", ""),
                block=rec.get("block", ""),
                source=rec.get("source", ""),
                verified_by=rec.get("verified_by", ""),
                verified_on=rec.get("verified_on", ""),
                notes=rec.get("notes", ""),
            )
            rows.append(row)

    return rows


# -------------------------
# Matching and emission
# -------------------------

@dataclass
class MatchSummary:
    loaded_curated: int
    missing_total: int
    matched: int
    unmatched_missing: int
    unmatched_curated: int
    deduped_curated: int


def match_curated_to_missing(
    missing_map: Dict[Tuple[str, str], str],
    curated_rows: List[MappingRow],
    include_all_curated: bool = False,
) -> Tuple[Dict[Tuple[str, str], MappingRow], MatchSummary]:
    """
    Return:
      - matched dict: (kind, canon_english) -> MappingRow (deduped by last occurrence)
      - summary stats
    include_all_curated=True will include curated rows even if they were not present in missing_map.
    """
    selected: Dict[Tuple[str, str], MappingRow] = {}
    curated_keys_seen: Dict[Tuple[str, str], int] = {}

    for idx, row in enumerate(curated_rows):
        key = row.canon_key
        curated_keys_seen[key] = curated_keys_seen.get(key, 0) + 1
        if include_all_curated or key in missing_map:
            # latest wins to allow easy corrections in CSV
            selected[key] = row

    matched = len(selected)
    unmatched_missing = max(0, len(missing_map) - sum(1 for k in selected.keys() if k in missing_map))
    unmatched_curated = sum(1 for r in curated_rows if (not include_all_curated) and (r.canon_key not in missing_map))
    deduped_curated = sum(c - 1 for c in curated_keys_seen.values() if c > 1)

    summary = MatchSummary(
        loaded_curated=len(curated_rows),
        missing_total=len(missing_map),
        matched=matched,
        unmatched_missing=unmatched_missing,
        unmatched_curated=unmatched_curated,
        deduped_curated=deduped_curated,
    )
    return selected, summary


def emit_ndjson(rows: Iterable[MappingRow], out_path: Optional[str], overwrite: bool = False) -> Optional[str]:
    """
    Write NDJSON lines to out_path (append by default). If out_path is None, write to stdout.
    Returns the out_path if written to a file.
    """
    if out_path:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        mode = "w" if overwrite else "a"
        with io.open(out_path, mode, encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r.to_ndjson_object(), ensure_ascii=False) + "\n")
        return out_path
    else:
        for r in rows:
            sys.stdout.write(json.dumps(r.to_ndjson_object(), ensure_ascii=False) + "\n")
        return None


def emit_json_mapping(
    rows: Iterable[MappingRow],
    out_json_path: Optional[str],
    merge_existing: bool = False,
) -> Tuple[Dict[str, Dict[str, Dict[str, str]]], Optional[str]]:
    """
    Build a JSON mapping object:
      { "village": { "<english>": {"hindi":"..", "nukta_hindi":".."}, ... },
        "gram_panchayat": { ... } }

    If out_json_path is provided:
      - when merge_existing=True and file exists, load and merge entries
      - otherwise, write only the current rows into a new minimal object

    Returns the object and the path written (or None if not written).
    """
    obj: Dict[str, Dict[str, Dict[str, str]]] = {
        "village": {},
        "gram_panchayat": {},
    }
    if out_json_path and merge_existing and os.path.exists(out_json_path):
        try:
            with io.open(out_json_path, "r", encoding="utf-8") as fh:
                existing = json.load(fh)
            for kind in ("village", "gram_panchayat"):
                if isinstance(existing.get(kind), dict):
                    # merge shallow
                    for k, v in existing[kind].items():
                        if isinstance(v, dict) and "hindi" in v:
                            obj[kind][k] = {
                                "hindi": _normalize_ws(v.get("hindi", "")),
                                "nukta_hindi": _normalize_nukta(v.get("nukta_hindi", v.get("hindi", ""))),
                            }
        except Exception as e:
            sys.stderr.write(f"[mappings_from_csv] Warning: failed to load existing JSON for merge: {e}\n")

    # add/overwrite with current rows
    for r in rows:
        entry = {"hindi": _normalize_ws(r.hindi), "nukta_hindi": _normalize_nukta(r.nukta_hindi or r.hindi)}
        obj[r.kind][_normalize_ws(r.english)] = entry

    if out_json_path:
        os.makedirs(os.path.dirname(out_json_path), exist_ok=True)
        with io.open(out_json_path, "w", encoding="utf-8") as fh:
            json.dump(obj, fh, ensure_ascii=False, indent=2)
        return obj, out_json_path

    return obj, None


# -------------------------
# CLI
# -------------------------

def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Diff missing_names.ndjson against curated CSV and emit NDJSON/JSON mappings."
    )
    p.add_argument("--csv", required=True, help="Path to curated CSV containing english,hindi(,nukta_hindi,kind,metadata)")
    p.add_argument("--missing", default=_default_missing_path(), help=f"Path to missing_names.ndjson (default: {_default_missing_path()})")
    p.add_argument("--default-kind", choices=list(KIND_VALUES), help="Default kind to use when CSV has no 'kind' column")
    p.add_argument(
        "--out-ndjson",
        nargs="?",
        const=_default_out_ndjson(),
        default=None,
        help=f"Write NDJSON mappings to this path (append). If flag given without value, uses default: {_default_out_ndjson()}. Omit to print to stdout.",
    )
    p.add_argument("--overwrite-ndjson", action="store_true", help="Overwrite NDJSON output instead of appending")
    p.add_argument("--out-json", default=None, help="Write aggregated JSON mapping to this path (overwrites or merges; see --merge-json)")
    p.add_argument("--merge-json", action="store_true", help="Merge into existing JSON mapping if present (preserves other entries)")
    p.add_argument("--include-all-curated", action="store_true", help="Include curated rows even if not present in missing_names.ndjson")
    p.add_argument("--dry-run", action="store_true", help="Do not write files; print summary only")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    ap = _build_arg_parser()
    args = ap.parse_args(argv)

    try:
        missing_map = load_missing_ndjson(args.missing)
        curated_rows = load_curated_csv(args.csv, default_kind=args.default_kind)

        matched_map, summary = match_curated_to_missing(
            missing_map=missing_map,
            curated_rows=curated_rows,
            include_all_curated=args.include_all_curated,
        )

        # Deterministic order for output (by kind then english)
        matched_rows: List[MappingRow] = sorted(
            matched_map.values(),
            key=lambda r: (r.kind, _canon_en(r.english)),
        )

        # Summary
        print("-- Mappings From CSV Summary --")
        print(f"Missing entries total   : {summary.missing_total}")
        print(f"Curated CSV rows loaded : {summary.loaded_curated}")
        print(f"Curated duplicates (by canon key) resolved by last occurrence: {summary.deduped_curated}")
        print(f"Matched rows (to emit)  : {summary.matched}")
        if not args.include_all_curated:
            print(f"Unmatched curated rows  : {summary.unmatched_curated} (not present in missing; use --include-all-curated to include)")
        print(f"Unmatched missing entries: {summary.unmatched_missing}")

        if args.dry_run:
            print("\nDry run: no files written.")
            return 0

        # Emit NDJSON
        out_ndjson_path_written: Optional[str] = None
        if args.out_ndjson is not None:
            out_ndjson_path = args.out_ndjson or _default_out_ndjson()
            out_ndjson_path_written = emit_ndjson(matched_rows, out_ndjson_path, overwrite=args.overwrite_ndjson)
            if out_ndjson_path_written:
                mode = "w" if args.overwrite_ndjson else "a"
                print(f"Wrote NDJSON ({len(matched_rows)} lines, mode={mode}) → {out_ndjson_path_written}")
        else:
            # stdout
            emit_ndjson(matched_rows, out_path=None)

        # Emit JSON (optional)
        if args.out_json:
            obj, out_json_path = emit_json_mapping(
                matched_rows,
                out_json_path=args.out_json,
                merge_existing=args.merge_json,
            )
            print(f"Wrote JSON mapping with {sum(len(obj[k]) for k in ('village','gram_panchayat'))} entries → {out_json_path}")

        return 0

    except FileNotFoundError as e:
        sys.stderr.write(f"[mappings_from_csv] File not found: {e}\n")
        return 2
    except Exception as e:
        sys.stderr.write(f"[mappings_from_csv] Error: {e}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
