#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cg_geo_cli.py — Preview duplicates and basic counts from the Excel-driven CG geography builder.

Features:
- Load Excel (data/CG_Geo_1.xlsx by default or env/flag override)
- Normalize + compute composite keys
- Report basic counts (districts, blocks, panchayats, villages, rows)
- Preview duplicate composite keys (with counts and sample values)
- Optionally persist rejects (duplicates) to NDJSON (same format as builder emits)
- Optional schema validations (Pandera + Great Expectations) before reporting

Usage examples:
- Preview summary + top duplicates (default paths):
    python api/src/sota/dataset_builders/cg_geo_cli.py

- Custom Excel path + JSON-only:
    python api/src/sota/dataset_builders/cg_geo_cli.py --xlsx /path/to/CG_Geo_1.xlsx --json

- Write rejects (duplicates) file:
    python api/src/sota/dataset_builders/cg_geo_cli.py --write-rejects data/rejects/cg_geo_duplicates.ndjson

- Validate with Pandera + Great Expectations (if installed):
    python api/src/sota/dataset_builders/cg_geo_cli.py --validate
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Tuple

import pandas as pd

# Import builder internals (kept local to this package)
# Robust import: works when run as a module or as a standalone script
try:
    from .cg_geo_excel_builder import (
        repo_root,
        _read_excel,
        map_headers,
        _project_columns,
        _normalize_frame,
        _dedup,
        run_pandera_validation,
        run_ge_validation,
        _write_rejects,
    )
except Exception:
    # Fallback for script execution without package context
    import os as _os
    import sys as _sys
    _HERE = _os.path.abspath(_os.path.dirname(__file__))
    _REPO_ROOT = _os.path.abspath(_os.path.join(_HERE, "..", "..", "..", ".."))
    _API_SRC = _os.path.join(_REPO_ROOT, "api", "src")
    if _API_SRC not in _sys.path:
        _sys.path.insert(0, _API_SRC)
    from sota.dataset_builders.cg_geo_excel_builder import (  # type: ignore
        repo_root,
        _read_excel,
        map_headers,
        _project_columns,
        _normalize_frame,
        _dedup,
        run_pandera_validation,
        run_ge_validation,
        _write_rejects,
    )


DEFAULT_XLSX = os.path.join(repo_root(), "data", "CG_Geo_1.xlsx")
DEFAULT_REJECTS = os.path.join(repo_root(), "data", "rejects", "cg_geo_duplicates.ndjson")


def compute_basic_counts(unique_df: pd.DataFrame) -> Dict[str, Any]:
    """Compute summary counts from a normalized, deduplicated frame."""
    def str_col(name: str) -> pd.Series:
        return unique_df[name].astype(str).str.strip() if name in unique_df.columns else pd.Series([], dtype=str)

    d = str_col("district")
    b = str_col("block")
    g = str_col("gram_panchayat")
    v = str_col("village")

    districts = set(d.tolist())
    blocks = set(f"{di}::{bl}" for di, bl in zip(d, b) if di and bl)
    gps = set(f"{di}::{bl}::{gp}" for di, bl, gp in zip(d, b, g) if di and bl and gp)
    villages = set(f"{di}::{bl}::{gp}::{vi}" for di, bl, gp, vi in zip(d, b, g, v) if di and bl and gp and vi)

    return {
        "totals": {
            "districts": len(districts),
            "blocks": len(blocks),
            "panchayats": len(gps),
            "villages": len(villages),
            "rows": int(len(unique_df)),
        }
    }


def find_duplicate_groups(norm_df: pd.DataFrame) -> List[Tuple[str, int]]:
    """
    Return list of (composite_key, total_count) for groups with total_count > 1,
    sorted by total_count desc.
    """
    if "composite_key" not in norm_df.columns:
        return []
    sizes = norm_df.groupby("composite_key").size().sort_values(ascending=False)
    dups = sizes[sizes > 1]
    return [(ck, int(cnt)) for ck, cnt in dups.items()]


def sample_duplicate_rows(norm_df: pd.DataFrame, composite_key: str, max_rows: int = 3) -> List[Dict[str, Any]]:
    """Return up to max_rows sample rows for a duplicate composite key."""
    rows = norm_df[norm_df["composite_key"] == composite_key]
    out: List[Dict[str, Any]] = []
    for _, r in rows.head(max_rows).iterrows():
        out.append({
            "district": r.get("district"),
            "block": r.get("block"),
            "gram_panchayat": r.get("gram_panchayat"),
            "village": r.get("village"),
        })
    return out


def write_rejects_ndjson(dups_df: pd.DataFrame, rejects_path: str, source_path: str) -> str:
    """Append duplicates to a rejects NDJSON file (builder-compatible format)."""
    _write_rejects(dups_df, rejects_path, source_path)
    return rejects_path


def load_and_prepare(xlsx_path: str, do_validate: bool = False) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, str]]:
    """Load Excel, map headers, project columns, normalize, optional validate, and split into (raw_df, norm_df, uniq_df, mapping)."""
    raw_df = _read_excel(xlsx_path)
    mapping = map_headers(raw_df)
    projected = _project_columns(raw_df, mapping)
    norm_df = _normalize_frame(projected)

    # Deduplicate before optional GE validation to avoid failing on known duplicates
    uniq_df, _ = _dedup(norm_df)

    if do_validate:
        # Run schema first; GE will further assert uniqueness and basic row sanity
        run_pandera_validation(norm_df)
        # Validate GE on the deduplicated frame
        run_ge_validation(uniq_df)

    return raw_df, norm_df, uniq_df, mapping


def render_human_summary(
    xlsx_path: str,
    raw_df: pd.DataFrame,
    norm_df: pd.DataFrame,
    uniq_df: pd.DataFrame,
    dup_groups: List[Tuple[str, int]],
    limit: int,
) -> str:
    b = []

    b.append("== CG Geography (Excel) — Preview ==")
    b.append(f"Source: {xlsx_path}")
    b.append(f"Rows (raw): {len(raw_df)}")
    b.append(f"Rows (normalized): {len(norm_df)}")
    b.append(f"Rows (unique by composite_key): {len(uniq_df)}")
    b.append(f"Duplicate groups: {len(dup_groups)}")
    if dup_groups:
        b.append("")
        b.append(f"-- Top duplicate composite keys (limit {limit}) --")
        for i, (ck, cnt) in enumerate(dup_groups[:limit], start=1):
            b.append(f"{i:>3}. count={cnt}  key='{ck}'")
            # Include a small sample of rows for context
            sample = sample_duplicate_rows(norm_df, ck, max_rows=2)
            for s in sample:
                b.append(f"     ↳ {s['district']} / {s['block']} / {s['gram_panchayat']} / {s['village']}")

    # Add basic counts
    counts = compute_basic_counts(uniq_df)
    b.append("")
    b.append("-- Basic counts (unique) --")
    for k, v in counts.get("totals", {}).items():
        b.append(f"{k:>12}: {v}")
    return "\n".join(b)


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Preview duplicates and basic counts for CG Excel geography builder."
    )
    parser.add_argument(
        "--xlsx",
        type=str,
        default=os.environ.get("CG_GEO_XLSX_PATH", DEFAULT_XLSX),
        help=f"Path to Excel file (default: env CG_GEO_XLSX_PATH or {DEFAULT_XLSX})",
    )
    parser.add_argument(
        "--list-dups",
        action="store_true",
        help="Include top duplicate composite keys in the output (human-readable mode).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Limit of duplicate groups to show (when --list-dups). Default: 10",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON summary only (no human-readable text).",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Run Pandera + GE validation before reporting (if available).",
    )
    parser.add_argument(
        "--write-rejects",
        type=str,
        default="",
        help=f"Path to write rejects (duplicates) NDJSON (append). Default off. Example: {DEFAULT_REJECTS}",
    )

    args = parser.parse_args(argv)

    try:
        # Load, normalize, (optionally) validate
        raw_df, norm_df, uniq_df, mapping = load_and_prepare(args.xlsx, do_validate=args.validate)

        # Compute duplicate groups on full normalized set (not just the trailing duplicates)
        dup_groups = find_duplicate_groups(norm_df)

        # Optionally write rejects NDJSON (using builder's format)
        rejects_path_written = None
        if args.write_rejects:
            # Build trailing duplicates DF using builder's logic (keep-first policy)
            _, trailing_dups_df = _dedup(norm_df)
            if trailing_dups_df is not None and len(trailing_dups_df) > 0:
                rejects_path_written = write_rejects_ndjson(trailing_dups_df, args.write_rejects, args.xlsx)
            else:
                # Ensure directory exists; write empty file header (or skip)
                rejects_path_written = args.write_rejects
                os.makedirs(os.path.dirname(rejects_path_written), exist_ok=True)
                # Create file if not exists
                if not os.path.exists(rejects_path_written):
                    open(rejects_path_written, "a", encoding="utf-8").close()

        # Prepare summary
        counts = compute_basic_counts(uniq_df)
        summary_payload = {
            "ok": True,
            "source": args.xlsx,
            "rows": {
                "raw": len(raw_df),
                "normalized": len(norm_df),
                "unique_by_composite_key": len(uniq_df),
                "duplicate_groups": len(dup_groups),
            },
            "counts": counts.get("totals", {}),
            "mapping": mapping,
            "rejects_path": rejects_path_written,
        }

        if args.json:
            print(json.dumps(summary_payload, ensure_ascii=False, indent=2))
        else:
            print(render_human_summary(args.xlsx, raw_df, norm_df, uniq_df, dup_groups if args.list_dups else [], args.limit))
            # Also show machine-readable summary footer for pipelines
            print("\n-- JSON Summary --")
            print(json.dumps(summary_payload, ensure_ascii=False))

        return 0

    except FileNotFoundError as e:
        sys.stderr.write(f"[cg_geo_cli] File not found: {e}\n")
        return 2
    except KeyError as e:
        sys.stderr.write(f"[cg_geo_cli] Missing required column: {e}\n")
        return 3
    except Exception as e:
        sys.stderr.write(f"[cg_geo_cli] Error: {e}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
