#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Append web-curation coverage metrics to a rolling history artifact.

This script reads the JSON produced by coverage_report.py and appends a compact
entry (timestamp + coverage percentages) to a history JSON file. The resulting
artifact can be published as a weekly trend attachment in CI.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_HISTORY_PATH = Path("coverage/web-curation-history.json")


def _load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _save_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    tmp.replace(path)


def _extract_metrics(summary: Dict[str, Any]) -> Dict[str, Any]:
    coverage = summary.get("coverage", {}) if isinstance(summary, dict) else {}
    missing = summary.get("missing", {}) if isinstance(summary, dict) else {}

    def _pct(section: str) -> float:
        try:
            percent = coverage.get(section, {}).get("percent", 0.0)
            return float(percent)
        except Exception:
            return 0.0

    def _safe_int(section: str) -> int:
        try:
            return int(missing.get("unique", {}).get(section, 0))
        except Exception:
            return 0

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "village_percent": _pct("village"),
        "gram_panchayat_percent": _pct("gram_panchayat"),
        "overall_percent": _pct("overall"),
        "missing_village": _safe_int("village"),
        "missing_gram_panchayat": _safe_int("gram_panchayat"),
        "missing_overall": _safe_int("overall"),
    }


def append_history(summary_path: Path, history_path: Path, max_points: int) -> Dict[str, Any]:
    summary = _load_json(summary_path)
    entry = _extract_metrics(summary)

    if history_path.exists():
        history = _load_json(history_path)
        history_list = history.get("history", []) if isinstance(history, dict) else []
    else:
        history_list = []

    history_list.append(entry)
    if max_points > 0:
        history_list = history_list[-max_points:]

    payload = {
        "updated_at": entry["timestamp"],
        "history": history_list,
    }
    _save_json(history_path, payload)
    return payload


def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Append coverage metrics to trend history")
    parser.add_argument(
        "--summary",
        required=True,
        help="Path to coverage JSON summary (from coverage_report.py)",
    )
    parser.add_argument(
        "--history",
        default=str(DEFAULT_HISTORY_PATH),
        help="History JSON output path (default: coverage/web-curation-history.json)",
    )
    parser.add_argument(
        "--max-points",
        type=int,
        default=52,
        help="Maximum history points to retain (default: 52)",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = _parse_args(argv)
    summary_path = Path(args.summary)
    history_path = Path(args.history)

    if not summary_path.exists():
        raise SystemExit(f"Summary JSON not found: {summary_path}")

    payload = append_history(summary_path, history_path, max_points=max(0, args.max_points))
    print(json.dumps({"updated_at": payload["updated_at"], "records": len(payload["history"])}, indent=2))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
