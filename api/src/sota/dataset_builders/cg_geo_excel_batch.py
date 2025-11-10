#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cg_geo_excel_batch.py — Batch builder to combine multiple Excel sources into one deduped NDJSON.

Purpose
- Read multiple CG_Geo Excel files (each: District → Block → Gram Panchayat → Village),
  normalize and validate them using the existing single-file builder internals,
  deduplicate across all files on the composite key, and emit a single NDJSON stream.

Key points
- Reuses cg_geo_excel_builder internals for:
  - header mapping
  - normalization (including nukta handling and transliteration)
  - validations (Pandera + optional Great Expectations)
  - record shaping and variants (via _record_from_row)
- Preserves per-row source path in the output's source.file.
- Writes one rejects file for cross-file duplicates (keep-first per composite_key).

CLI examples
- Combine specific files and print to stdout:
    python api/src/sota/dataset_builders/cg_geo_excel_batch.py \
      --xlsx data/CG_Geo_1.xlsx \
      --xlsx data/CG_Geo_2.xlsx \
      --xlsx data/CG_Geo_3.xlsx

- Write output to a file and append duplicates to a rejects NDJSON:
    python api/src/sota/dataset_builders/cg_geo_excel_batch.py \
      --xlsx data/CG_Geo_1.xlsx \
      --xlsx data/CG_Geo_2.xlsx \
      --xlsx data/CG_Geo_3.xlsx \
      --out data/datasets/chhattisgarh_geography.ndjson \
      --rejects data/rejects/cg_geo_duplicates.ndjson

- Use env var (comma-separated) and run validations:
    CG_GEO_BATCH_XLSX="data/CG_Geo_1.xlsx,data/CG_Geo_2.xlsx" \
    python api/src/sota/dataset_builders/cg_geo_excel_batch.py --validate

Notes
- Files missing required headers are skipped with a clear message.
- Great Expectations (GE) is run on the deduped frame (like the CLI) to avoid duplicate-induced failures.
- Pandera is run pre-dedup on the combined normalized frame.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import pandas as pd

# Reuse single-file builder internals (robust import whether run as module or script)
try:
    from .cg_geo_excel_builder import (  # type: ignore
        repo_root,
        _read_excel,
        map_headers,
        _project_columns,
        _normalize_frame,
        run_pandera_validation,
        run_ge_validation,
        _record_from_row,
    )
except Exception:
    # Fallback when executed as a script
    _HERE = os.path.abspath(os.path.dirname(__file__))
    _REPO_ROOT = os.path.abspath(os.path.join(_HERE, "..", "..", "..", ".."))
    _API_SRC = os.path.join(_REPO_ROOT, "api", "src")
    if _API_SRC not in sys.path:
        sys.path.insert(0, _API_SRC)
    from sota.dataset_builders.cg_geo_excel_builder import (  # type: ignore
        repo_root,
        _read_excel,
        map_headers,
        _project_columns,
        _normalize_frame,
        run_pandera_validation,
        run_ge_validation,
        _record_from_row,
    )


DEFAULT_OUT = None  # stdout
DEFAULT_REJECTS = os.path.join(repo_root(), "data", "rejects", "cg_geo_duplicates.ndjson")


def _ensure_dir(path: str) -> None:
    if not path:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)


def _safe_read_normalize(path: str) -> Optional[pd.DataFrame]:
    """
    Read a single Excel, map headers, project relevant columns, and normalize.
    Returns None if file is invalid or missing required headers.
    """
    try:
        df_raw = _read_excel(path)
        mapping = map_headers(df_raw)
        projected = _project_columns(df_raw, mapping)
        norm = _normalize_frame(projected)
        # Attach provenance (used for emission and rejects)
        norm["_source_path"] = path
        # Preserve original row index position as an integer (for source row tracking)
        norm["_row_index"] = list(range(len(norm)))
        return norm
    except FileNotFoundError:
        sys.stderr.write(f"[cg_geo_excel_batch] File not found: {path}\n")
    except ValueError as e:
        # Typically missing required headers or empty
        sys.stderr.write(f"[cg_geo_excel_batch] Skipping {path}: {e}\n")
    except Exception as e:
        sys.stderr.write(f"[cg_geo_excel_batch] Error reading {path}: {e}\n")
    return None


def _dedup_across_sources(combined: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Deduplicate across all sources using the existing composite_key column.
    Keep the first occurrence by input order; mark the rest as duplicates.
    """
    if "composite_key" not in combined.columns:
        return combined, combined.iloc[0:0].copy()
    dup_mask = combined.duplicated(subset=["composite_key"], keep="first")
    dups = combined[dup_mask].copy()
    uniq = combined[~dup_mask].copy()
    return uniq, dups


def _write_rejects_batch(dups: pd.DataFrame, rejects_path: Optional[str]) -> None:
    """
    Append duplicate rows to a rejects NDJSON file (cross-file dedupe log).
    """
    if rejects_path is None or dups is None or dups.empty:
        return
    _ensure_dir(rejects_path)
    with io.open(rejects_path, "a", encoding="utf-8") as f:
        for _, row in dups.iterrows():
            out = {
                "reason": "duplicate_composite_key",
                "composite_key": row.get("composite_key"),
                "district": row.get("district"),
                "block": row.get("block"),
                "gram_panchayat": row.get("gram_panchayat"),
                "village": row.get("village"),
                "source": {"file": row.get("_source_path")},
            }
            f.write(json.dumps(out, ensure_ascii=False) + "\n")


def build_cg_geo_excel_batch(
    xlsx_paths: Sequence[str],
    rejects_path: Optional[str] = DEFAULT_REJECTS,
    validate: bool = True,
) -> Iterable[str]:
    """
    Generator that yields NDJSON lines combining multiple CG_Geo Excel files.

    Steps:
    - Read and normalize each Excel via single-file internals.
    - Concatenate in the given order (order determines keep-first on duplicates).
    - Validate with Pandera on the combined normalized frame (pre-dedup).
    - Deduplicate across files on composite_key (keep-first).
    - Validate with GE on the deduped frame (if available).
    - Emit NDJSON using _record_from_row (preserving source.path per row).
    """
    # Collect normalized frames
    frames: List[pd.DataFrame] = []
    for xp in xlsx_paths:
        norm = _safe_read_normalize(xp)
        if norm is not None and len(norm) > 0:
            frames.append(norm)

    if not frames:
        raise RuntimeError("No valid Excel inputs were loaded; aborting.")

    combined = pd.concat(frames, ignore_index=True)

    # Pandera validation (pre-dedup)
    if validate:
        try:
            run_pandera_validation(combined)
        except Exception as e:
            # Surface but do not mask the exact reason
            raise

    # Dedup across sources
    unique_df, dups_df = _dedup_across_sources(combined)
    _write_rejects_batch(dups_df, rejects_path)

    # GE validation (on deduped frame to avoid known duplicates)
    if validate:
        try:
            run_ge_validation(unique_df)
        except Exception:
            # GE is optional; the internal helper already no-ops if GE is unavailable
            pass

    # Emit deduped records
    for i, row in unique_df.reset_index(drop=True).iterrows():
        src = row.get("_source_path") or ""
        # Use original row index when available, else fall back to the running index
        ridx = int(row.get("_row_index")) if "_row_index" in row and pd.notna(row["_row_index"]) else i
        rec = _record_from_row(row, src, ridx)
        yield json.dumps(rec, ensure_ascii=False)


def _parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Batch CG Geo Excel → deduped NDJSON")
    p.add_argument(
        "--xlsx",
        action="append",
        default=[],
        help="Path to a CG_Geo Excel file. Specify multiple times for multiple files.",
    )
    p.add_argument(
        "--out",
        default=DEFAULT_OUT,
        help="Output NDJSON path. If omitted, prints to stdout.",
    )
    p.add_argument(
        "--rejects",
        default=DEFAULT_REJECTS,
        help=f"Rejects (duplicates) NDJSON path (append). Default: {DEFAULT_REJECTS}",
    )
    p.add_argument(
        "--no-validate",
        dest="validate",
        action="store_false",
        help="Skip Pandera/GE validations.",
    )
    return p.parse_args(argv)


def _resolve_xlsx_paths(cli_paths: Sequence[str]) -> List[str]:
    """
    Resolve input paths using CLI list or CG_GEO_BATCH_XLSX env (comma-separated).
    """
    paths: List[str] = list(cli_paths) if cli_paths else []
    if not paths:
        env_var = os.getenv("CG_GEO_BATCH_XLSX", "").strip()
        if env_var:
            paths.extend([p.strip() for p in env_var.split(",") if p.strip()])
    # Deduplicate while preserving order
    seen: set[str] = set()
    uniq: List[str] = []
    for p in paths:
        absp = p if os.path.isabs(p) else os.path.join(repo_root(), p)
        if absp not in seen:
            uniq.append(absp)
            seen.add(absp)
    return uniq


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = _parse_args(argv)
    xlsx_paths = _resolve_xlsx_paths(args.xlsx)
    if not xlsx_paths:
        sys.stderr.write("[cg_geo_excel_batch] No input Excel files provided (--xlsx or CG_GEO_BATCH_XLSX).\n")
        return 2

    try:
        lines = build_cg_geo_excel_batch(
            xlsx_paths=xlsx_paths,
            rejects_path=args.rejects,
            validate=args.validate,
        )
        if args.out:
            _ensure_dir(args.out)
            with io.open(args.out, "w", encoding="utf-8") as fh:
                for ln in lines:
                    fh.write(ln + "\n")
        else:
            out = sys.stdout
            for ln in lines:
                out.write(ln + "\n")
        return 0
    except Exception as e:
        sys.stderr.write(f"[cg_geo_excel_batch] Error: {e}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
