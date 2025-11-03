#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Minimal Great Expectations validation for core datasets.

The goal is to provide a lightweight, deterministic check that can be
wired into the optional data-validation CI job (guarded by FLAG_DATA_VALIDATION).
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Optional

import pandas as pd

try:  # Great Expectations is optional
    import great_expectations as ge  # type: ignore
except Exception:  # pragma: no cover - handled at runtime
    ge = None

from api.src.sota.dataset_builders.cg_urban_excel_builder import build_cg_urban_excel_dataset
from api.src.sota.dataset_builders.cg_geo_excel_builder import build_cg_geo_excel_dataset


DEFAULT_OUTPUT_PATH = Path("data/validations/ge-summary.json")


def _flag_enabled() -> bool:
    flag = os.getenv("FLAG_DATA_VALIDATION", "off").strip().lower()
    return flag in {"1", "true", "yes", "on"}


def _ensure_output_dir(path: Path) -> None:
    if path and path.parent:
        path.parent.mkdir(parents=True, exist_ok=True)


def _load_dataframe(lines: Iterable[str], required_columns: List[str]) -> pd.DataFrame:
    rows: List[Dict] = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    if not rows:
        raise ValueError("dataset produced zero rows")
    df = pd.DataFrame(rows)
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise ValueError(f"missing required columns: {missing}")
    return df[required_columns].copy()


def _validate_with_ge(df: pd.DataFrame, expectations: List[Callable]) -> Dict:
    if ge is None:
        raise ImportError("great_expectations package is not installed")
    dataset = ge.from_pandas(df)  # type: ignore[attr-defined]
    for expectation in expectations:
        expectation(dataset)
    result = dataset.validate()
    result_dict = result.to_json_dict()
    stats = result_dict.get("statistics", {})
    return {
        "success": bool(result.success),
        "statistics": stats,
        "evaluated_expectations": stats.get("evaluated_expectations"),
        "successful_expectations": stats.get("successful_expectations"),
        "unsuccessful_expectations": stats.get("unsuccessful_expectations"),
    }


def _urban_expectations(dataset):
    for column in ("district", "ulb", "ward"):
        dataset.expect_column_values_to_not_be_null(column)
    dataset.expect_column_values_to_be_unique("composite_key")
    dataset.expect_table_row_count_to_be_between(1, None)


def _geography_expectations(dataset):
    for column in ("district", "block", "gram_panchayat", "village"):
        dataset.expect_column_values_to_not_be_null(column)
    dataset.expect_column_values_to_be_unique("composite_key")
    dataset.expect_table_row_count_to_be_between(1, None)


SUITES = [
    {
        "name": "urban_ge",
        "builder": build_cg_urban_excel_dataset,
        "required_columns": ["district", "ulb", "ward", "composite_key"],
        "expectation_func": _urban_expectations,
    },
    {
        "name": "geography_excel_ge",
        "builder": build_cg_geo_excel_dataset,
        "required_columns": [
            "district",
            "block",
            "gram_panchayat",
            "village",
            "composite_key",
        ],
        "expectation_func": _geography_expectations,
    },
]


def _run_suite(spec: Dict) -> Dict:
    name = spec["name"]
    builder = spec["builder"]
    required_columns = spec["required_columns"]
    expectation_func = spec["expectation_func"]

    try:
        df = _load_dataframe(builder(), required_columns)
        summary = _validate_with_ge(df, [expectation_func])
        status = "passed" if summary["success"] else "failed"
        return {
            "suite": name,
            "status": status,
            "details": {
                "row_count": int(df.shape[0]),
                **summary,
            },
        }
    except Exception as exc:  # noqa: BLE001 - we want to capture for report
        return {
            "suite": name,
            "status": "error",
            "error": str(exc),
        }


def run_all(json_out: Optional[str] = None, respect_flag: bool = True) -> Dict:
    """Run all GE suites and return a structured summary."""
    output_path = Path(json_out) if json_out else DEFAULT_OUTPUT_PATH

    if respect_flag and not _flag_enabled():
        summary = {
            "status": "skipped",
            "success": True,
            "results": [],
            "reason": "FLAG_DATA_VALIDATION disabled",
        }
        _ensure_output_dir(output_path)
        output_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
        return summary

    results = [_run_suite(spec) for spec in SUITES]
    success = all(r.get("status") == "passed" for r in results)
    summary = {
        "status": "completed",
        "success": success,
        "results": results,
    }
    _ensure_output_dir(output_path)
    output_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    return summary


def _cli(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run Great Expectations suites for Dhruv datasets")
    parser.add_argument(
        "--json-out",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Path to write summary JSON (default: data/validations/ge-summary.json)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ignore FLAG_DATA_VALIDATION and run regardless",
    )
    args = parser.parse_args(argv)

    summary = run_all(json_out=args.json_out, respect_flag=not args.force)
    if summary.get("status") == "skipped":
        print("Data validation skipped (FLAG_DATA_VALIDATION off)")
        return 0
    if not summary.get("success"):
        print("Great Expectations validation failed")
        return 1
    print("Great Expectations validation passed")
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(_cli())
