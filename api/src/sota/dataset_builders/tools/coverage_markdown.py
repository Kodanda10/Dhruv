#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
coverage_markdown.py — Render web-curation coverage JSON as GitHub Markdown for PR bodies

Reads a JSON summary produced by coverage_report.py and emits a concise Markdown
summary suitable for inclusion in an automated PR body.

Input schema (abbrev):
{
  "ok": true,
  "paths": { "missing": "data/name_mappings/missing_names.ndjson", "json_map": "data/name_mappings/geography_name_map.json" },
  "missing": { "total_lines": 51626, "unique": { "village": 13539, "gram_panchayat": 9046, "overall": 22585 } },
  "mapping_json": { "entries": { "village": 1, "gram_panchayat": 2, "overall": 3 } },
  "coverage": {
    "village": { "covered": 1, "total": 13539, "percent": 0.01 },
    "gram_panchayat": { "covered": 2, "total": 9046, "percent": 0.02 },
    "overall": { "covered": 3, "total": 22585, "percent": 0.01 }
  },
  "unmapped_samples": { "village": ["..."], "gram_panchayat": ["..."] }
}

Usage:
  python api/src/sota/dataset_builders/tools/coverage_markdown.py \
    --json coverage/web-curation-coverage.json \
    --max-samples 10 \
    --title "Chhattisgarh Geography — Mapping Coverage"

- Pass "-" to --json to read from stdin.
- Use --out to write to a file (default: stdout).
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
from typing import Any, Dict, List, Optional


def _fmt_int(v: Any) -> str:
    try:
        return f"{int(v):,}"
    except Exception:
        return str(v)


def _fmt_pct(v: Any) -> str:
    try:
        return f"{float(v):.2f}%"
    except Exception:
        return str(v)


def _get(d: Dict[str, Any], path: List[str], default: Any = None) -> Any:
    cur: Any = d
    try:
        for key in path:
            if not isinstance(cur, dict):
                return default
            cur = cur.get(key)
            if cur is None:
                return default
        return cur if cur is not None else default
    except Exception:
        return default


def _take_prefix(xs: Optional[List[str]], n: int) -> List[str]:
    if not xs:
        return []
    n = max(0, int(n))
    return xs[:n]


def render_markdown(summary: Dict[str, Any], title: Optional[str] = None, max_samples: int = 10) -> str:
    title = title or "Chhattisgarh Geography — Mapping Coverage"

    # Paths
    path_missing = _get(summary, ["paths", "missing"], "data/name_mappings/missing_names.ndjson")
    path_json = _get(summary, ["paths", "json_map"], "data/name_mappings/geography_name_map.json")

    # Missing (unique)
    uniq_v = _get(summary, ["missing", "unique", "village"], 0)
    uniq_g = _get(summary, ["missing", "unique", "gram_panchayat"], 0)
    uniq_o = _get(summary, ["missing", "unique", "overall"], 0)

    # Mapping JSON counts
    map_v = _get(summary, ["mapping_json", "entries", "village"], 0)
    map_g = _get(summary, ["mapping_json", "entries", "gram_panchayat"], 0)
    map_o = _get(summary, ["mapping_json", "entries", "overall"], 0)

    # Coverage
    cov_v = {
        "covered": _get(summary, ["coverage", "village", "covered"], 0),
        "total": _get(summary, ["coverage", "village", "total"], 0),
        "percent": _get(summary, ["coverage", "village", "percent"], 0.0),
    }
    cov_g = {
        "covered": _get(summary, ["coverage", "gram_panchayat", "covered"], 0),
        "total": _get(summary, ["coverage", "gram_panchayat", "total"], 0),
        "percent": _get(summary, ["coverage", "gram_panchayat", "percent"], 0.0),
    }
    cov_o = {
        "covered": _get(summary, ["coverage", "overall", "covered"], 0),
        "total": _get(summary, ["coverage", "overall", "total"], 0),
        "percent": _get(summary, ["coverage", "overall", "percent"], 0.0),
    }

    # Samples
    samples_v = _take_prefix(_get(summary, ["unmapped_samples", "village"], []), max_samples)
    samples_g = _take_prefix(_get(summary, ["unmapped_samples", "gram_panchayat"], []), max_samples)

    lines: List[str] = []
    lines.append("<!-- web-curation-coverage:start -->")
    lines.append(f"### {title}")
    lines.append("")
    lines.append("- Sources:")
    lines.append(f"  - Missing (NDJSON): `{path_missing}`")
    lines.append(f"  - Mapping (JSON): `{path_json}`")
    lines.append("- Totals:")
    lines.append(f"  - Unique missing — village: {_fmt_int(uniq_v)}, gram_panchayat: {_fmt_int(uniq_g)}, overall: {_fmt_int(uniq_o)}")
    lines.append(f"  - Mapping JSON entries — village: {_fmt_int(map_v)}, gram_panchayat: {_fmt_int(map_g)}, overall: {_fmt_int(map_o)}")
    lines.append("")
    lines.append("| Kind | Covered | Total | Coverage |")
    lines.append("|---|---:|---:|---:|")
    lines.append(f"| Village | {_fmt_int(cov_v['covered'])} | {_fmt_int(cov_v['total'])} | {_fmt_pct(cov_v['percent'])} |")
    lines.append(f"| Gram Panchayat | {_fmt_int(cov_g['covered'])} | {_fmt_int(cov_g['total'])} | {_fmt_pct(cov_g['percent'])} |")
    lines.append(f"| Overall | {_fmt_int(cov_o['covered'])} | {_fmt_int(cov_o['total'])} | {_fmt_pct(cov_o['percent'])} |")
    lines.append("")

    if samples_v:
        lines.append(f"<details><summary>Sample unmapped Village names (first {len(samples_v)})</summary>\n")
        for s in samples_v:
            lines.append(f"- {s}")
        lines.append("\n</details>\n")

    if samples_g:
        lines.append(f"<details><summary>Sample unmapped Gram Panchayat names (first {len(samples_g)})</summary>\n")
        for s in samples_g:
            lines.append(f"- {s}")
        lines.append("\n</details>\n")

    lines.append("_Note: This summary is generated automatically from the nightly web-curation workflow. Coverage is computed on unique missing names (canonical English) matched against curated mappings._")
    lines.append("<!-- web-curation-coverage:end -->")

    return "\n".join(lines)


def _load_json(path: str) -> Dict[str, Any]:
    if path == "-" or path.strip() == "":
        try:
            data = sys.stdin.read()
            return json.loads(data)
        except Exception as e:
            raise SystemExit(f"[coverage_markdown] Failed to read JSON from stdin: {e}")
    try:
        with io.open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        raise SystemExit(f"[coverage_markdown] File not found: {path}")
    except Exception as e:
        raise SystemExit(f"[coverage_markdown] Failed to parse JSON: {e}")


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Render coverage JSON as GitHub Markdown for PR body.")
    p.add_argument("--json", default="coverage/web-curation-coverage.json", help="Path to JSON summary (from coverage_report.py) or '-' for stdin")
    p.add_argument("--out", default="-", help="Output path (default: '-' for stdout)")
    p.add_argument("--max-samples", type=int, default=10, help="Max unmapped samples per kind to include")
    p.add_argument("--title", default=None, help="Custom title for the summary")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    ap = _build_arg_parser()
    args = ap.parse_args(argv)

    summary = _load_json(args.json)
    md = render_markdown(summary, title=args.title, max_samples=args.max_samples)

    if args.out == "-" or args.out.strip() == "":
        print(md)
        return 0

    out_path = args.out
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    tmp = out_path + ".tmp"
    with io.open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(md)
        fh.write("\n")
    os.replace(tmp, out_path)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        sys.stderr.write("Interrupted\n")
        raise SystemExit(130)
