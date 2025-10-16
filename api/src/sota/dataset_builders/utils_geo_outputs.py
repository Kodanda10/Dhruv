#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
utils_geo_outputs.py

Utilities to:
- Write partitioned NDJSON exports by district (or any key)
- Compute and persist a summary JSON (totals, uniques)
- Stream safely with low memory usage
- Provide a small CLI to partition and summarize from an NDJSON file

Design goals:
- No heavy dependencies (stdlib only)
- UTF-8 safe, ensure_ascii=False
- Deterministic, append-safe, atomic writes for summary
- Clear counters and diagnostics returned to caller
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from typing import Dict, Iterable, Iterator, Optional, TextIO, Union, Any


Record = Dict[str, Any]
RecordLike = Union[str, Record]


def ensure_dir(path: str) -> None:
    """Create parent directory for a file path or a directory path."""
    base = path if os.path.splitext(path)[1] == "" else os.path.dirname(path)
    if base:
        os.makedirs(base, exist_ok=True)


def atomic_write_json(path: str, data: Any) -> None:
    """Atomically write JSON to a path."""
    ensure_dir(path)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def sanitize_segment(seg: str) -> str:
    """
    Make a safe filename segment:
    - Lowercase
    - Replace non-alnum with hyphen
    - Collapse repeats and strip hyphens
    """
    if seg is None:
        seg = ""
    s = str(seg).strip().lower()
    out_chars = []
    prev_dash = False
    for ch in s:
        if ch.isalnum():
            out_chars.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                out_chars.append("-")
            prev_dash = True
    slug = "".join(out_chars).strip("-")
    return slug or "unknown"


@dataclass
class PartitionStats:
    total_records: int = 0
    missing_key: int = 0
    per_file_counts: Dict[str, int] = field(default_factory=dict)

    def inc(self, fname: str) -> None:
        self.total_records += 1
        self.per_file_counts[fname] = self.per_file_counts.get(fname, 0) + 1

    def inc_missing(self) -> None:
        self.missing_key += 1
        self.total_records += 1


class PartitionWriter:
    """
    Streaming partition writer that writes one NDJSON file per unique key value.
    """

    def __init__(
        self,
        out_dir: str,
        key: str = "district",
        filename_template: str = "{district}.ndjson",
        mode: str = "a",
        encoding: str = "utf-8",
    ) -> None:
        self.out_dir = out_dir
        self.key = key
        self.filename_template = filename_template
        self.mode = mode
        self.encoding = encoding
        self._open_files: Dict[str, TextIO] = {}
        self.stats = PartitionStats()
        ensure_dir(out_dir)

    def _file_for(self, key_value: str) -> TextIO:
        safe = sanitize_segment(key_value)
        filename = self.filename_template.format(**{self.key: safe})
        full = os.path.join(self.out_dir, filename)
        if full not in self._open_files:
            ensure_dir(full)
            self._open_files[full] = open(full, self.mode, encoding=self.encoding)
        return self._open_files[full]

    def write(self, record: Record) -> Optional[str]:
        """
        Write a record to its partition file as NDJSON.
        Returns the file path used, or None if key missing.
        """
        if self.key not in record or record[self.key] in (None, ""):
            self.stats.inc_missing()
            return None
        key_val = str(record[self.key])
        f = self._file_for(key_val)
        line = json.dumps(record, ensure_ascii=False)
        f.write(line + "\n")
        self.stats.inc(f.name)
        return f.name

    def close(self) -> None:
        for f in self._open_files.values():
            try:
                f.flush()
                os.fsync(f.fileno())
            except Exception:
                # best-effort; continue closing
                pass
            try:
                f.close()
            except Exception:
                pass
        self._open_files.clear()


@dataclass
class SummaryState:
    districts: set = field(default_factory=set)
    blocks: set = field(default_factory=set)
    gps: set = field(default_factory=set)
    villages: set = field(default_factory=set)
    rows: int = 0

    def update(self, rec: Record) -> None:
        d = rec.get("district") or ""
        b = rec.get("block") or rec.get("vikaskhand") or ""
        g = rec.get("gram_panchayat") or rec.get("panchayat") or ""
        v = rec.get("village") or ""

        # Normalize to strings
        d, b, g, v = str(d).strip(), str(b).strip(), str(g).strip(), str(v).strip()

        if d:
            self.districts.add(d)
        if d and b:
            self.blocks.add(f"{d}::{b}")
        if d and b and g:
            self.gps.add(f"{d}::{b}::{g}")
        if d and b and g and v:
            self.villages.add(f"{d}::{b}::{g}::{v}")
        self.rows += 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "totals": {
                "districts": len(self.districts),
                "blocks": len(self.blocks),
                "panchayats": len(self.gps),
                "villages": len(self.villages),
                "rows": self.rows,
            }
        }


def iter_records(stream: Iterable[RecordLike]) -> Iterator[Record]:
    """
    Iterate over a stream of RecordLike -> Record (dict). Strings are json.loads-ed.
    Lines that fail to parse are skipped.
    """
    for item in stream:
        if isinstance(item, dict):
            yield item
        else:
            s = str(item).strip()
            if not s:
                continue
            try:
                yield json.loads(s)
            except Exception:
                # Skip malformed line
                continue


def write_partitioned_by_key(
    records: Iterable[RecordLike],
    out_dir: str,
    key: str = "district",
    filename_template: str = "{district}.ndjson",
    compute_summary: bool = True,
) -> Dict[str, Any]:
    """
    Partition an iterable of records/NDJSON lines by `key`.

    Returns:
        dict with:
            - stats: PartitionStats as dict
            - summary: optional summary dict if compute_summary
            - files: list of file paths written
    """
    writer = PartitionWriter(out_dir=out_dir, key=key, filename_template=filename_template)
    summary = SummaryState() if compute_summary else None
    written_files: set = set()

    try:
        for rec in iter_records(records):
            path = writer.write(rec)
            if path:
                written_files.add(path)
            if summary is not None:
                summary.update(rec)
    finally:
        writer.close()

    result = {
        "stats": {
            "total_records": writer.stats.total_records,
            "missing_key": writer.stats.missing_key,
            "per_file_counts": writer.stats.per_file_counts,
        },
        "files": sorted(written_files),
    }
    if summary is not None:
        result["summary"] = summary.to_dict()
    return result


def write_summary(summary: Dict[str, Any], path: str) -> None:
    """Persist a summary dict as pretty JSON (atomic)."""
    atomic_write_json(path, summary)


def load_ndjson_file(path: str) -> Iterator[Record]:
    """Yield dict records from an NDJSON file path."""
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                continue


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Partition NDJSON by district (or another key) and write a summary.")
    parser.add_argument("--input", "-i", type=str, required=False, default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "datasets", "chhattisgarh_geography.ndjson")), help="Path to input NDJSON file (default: repo data/datasets/chhattisgarh_geography.ndjson)")
    parser.add_argument("--out-dir", "-o", type=str, required=False, default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "datasets", "by_district")), help="Directory to write partitioned NDJSON files (default: repo data/datasets/by_district)")
    parser.add_argument("--summary", "-s", type=str, required=False, default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data", "datasets", "chhattisgarh_geography.summary.json")), help="Path to write summary JSON (default: repo data/datasets/chhattisgarh_geography.summary.json)")
    parser.add_argument("--key", "-k", type=str, default="district", help="Partition key (default: district)")
    parser.add_argument("--template", "-t", type=str, default="{district}.ndjson", help="Filename template (use {district} placeholder or {key})")
    args = parser.parse_args(list(argv) if argv is not None else None)

    key_placeholder = "{" + args.key + "}"
    template = args.template
    if key_placeholder not in template:
        # If user passed a template without the right placeholder, fix it.
        template = f"{key_placeholder}.ndjson"

    print(f"[utils_geo_outputs] Loading input: {args.input}", file=sys.stderr)
    records = load_ndjson_file(args.input)

    print(f"[utils_geo_outputs] Writing partitions to: {args.out_dir} (key={args.key}, template={template})", file=sys.stderr)
    result = write_partitioned_by_key(records, out_dir=args.out_dir, key=args.key, filename_template=template, compute_summary=True)

    if args.summary:
        print(f"[utils_geo_outputs] Writing summary to: {args.summary}", file=sys.stderr)
        write_summary(result.get("summary", {}), args.summary)

    # Brief report to stdout (machine-readable)
    print(json.dumps({
        "ok": True,
        "stats": result["stats"],
        "files_written": len(result["files"]),
        "summary_path": args.summary or None,
    }, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
