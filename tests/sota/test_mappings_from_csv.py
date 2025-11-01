# -*- coding: utf-8 -*-
"""
Unit tests for mappings_from_csv helper — matching and canonicalization logic.
"""

import os
import sys
import json
import textwrap
import io
import csv
import pytest

# Ensure api/src is importable
THIS_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(THIS_DIR, "..", ".."))
API_SRC = os.path.join(REPO_ROOT, "api", "src")
if API_SRC not in sys.path:
    sys.path.insert(0, API_SRC)

from sota.dataset_builders.tools.mappings_from_csv import (  # type: ignore
    load_missing_ndjson,
    load_curated_csv,
    match_curated_to_missing,
    _canon_en,  # for deterministic key assertions
)


def write_file(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def test_match_curated_to_missing_basic(tmp_path):
    # Arrange: missing_names.ndjson with three entries
    missing_path = tmp_path / "missing_names.ndjson"
    missing_lines = [
        {"kind": "village", "english": "Badwahi", "why": "missing_mapping"},
        {"kind": "gram_panchayat", "english": "Karri", "why": "missing_mapping"},
        {"kind": "village", "english": "Kuwarpur", "why": "missing_mapping"},
    ]
    write_file(str(missing_path), "\n".join(json.dumps(x, ensure_ascii=False) for x in missing_lines) + "\n")

    # Curated CSV with case/space variants that should canonically match missing
    curated_csv = tmp_path / "curated.csv"
    rows = [
        # Headers
        ["kind", "english", "hindi", "nukta_hindi", "source"],
        # Values (case/space variations)
        ["village", "BADWAHI", "बडवाही", "बड़वाही", "https://src"],
        ["gram_panchayat", "  Karri  ", "करी", "", "https://src"],  # nukta defaults to hindi
        ["village", "KuwaR   Pur", "कुवारपुर", "कुवारपुर", "https://src"],  # internal space collapse
    ]
    with open(curated_csv, "w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerows(rows)

    # Act
    missing_map = load_missing_ndjson(str(missing_path))
    curated_rows = load_curated_csv(str(curated_csv))
    selected, summary = match_curated_to_missing(missing_map, curated_rows, include_all_curated=False)

    # Assert: all three missing entries matched
    assert summary.missing_total == 3
    assert summary.loaded_curated == 3
    assert summary.matched == 3
    assert summary.unmatched_missing == 0
    assert summary.unmatched_curated == 0
    assert summary.deduped_curated == 0

    # Verify keys present using canonicalization
    assert ("village", _canon_en("Badwahi")) in selected
    assert ("gram_panchayat", _canon_en("Karri")) in selected
    assert ("village", _canon_en("Kuwarpur")) in selected

    # Verify content normalization behaviors
    r_badwahi = selected[("village", _canon_en("Badwahi"))]
    assert r_badwahi.hindi == "बडवाही"
    assert r_badwahi.nukta_hindi == "बड़वाही"

    r_karri = selected[("gram_panchayat", _canon_en("Karri"))]
    # nukta_hindi should default to hindi when empty in CSV
    assert r_karri.hindi == "करी"
    assert r_karri.nukta_hindi == "करी"

    r_kuwarpur = selected[("village", _canon_en("Kuwarpur"))]
    # English retains original CSV value (whitespace stripped happens on serialization, matching uses canonical form)
    assert "KuwaR" in r_kuwarpur.english


def test_dedup_and_include_all_curated_behavior(tmp_path):
    # Arrange: missing with one entry
    missing_path = tmp_path / "missing.ndjson"
    write_file(
        str(missing_path),
        json.dumps({"kind": "village", "english": "Bela", "why": "missing_mapping"}, ensure_ascii=False) + "\n",
    )

    # Curated CSV has duplicate keys for Bela (last should win) and one extra row not in missing
    curated_csv = tmp_path / "curated.csv"
    rows = [
        ["kind", "english", "hindi", "nukta_hindi"],
        ["village", "Bela", "बेला_v1", ""],
        ["village", "Bela", "बेला_v2", ""],  # last-wins correction
        ["village", "NotInMissing", "नॉटइनमिसिंग", ""],
    ]
    with open(curated_csv, "w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerows(rows)

    # Act: include_all_curated = False (default)
    missing_map = load_missing_ndjson(str(missing_path))
    curated_rows = load_curated_csv(str(curated_csv))
    selected_default, summary_default = match_curated_to_missing(missing_map, curated_rows, include_all_curated=False)

    # Assert: only the missing entry is selected, last occurrence wins
    assert summary_default.missing_total == 1
    assert summary_default.loaded_curated == 3
    assert summary_default.matched == 1
    assert summary_default.unmatched_missing == 0
    assert summary_default.unmatched_curated == 1  # NotInMissing is not included
    assert summary_default.deduped_curated == 1  # Bela duplicated in curated CSV

    key_bela = ("village", _canon_en("Bela"))
    assert key_bela in selected_default
    assert selected_default[key_bela].hindi == "बेला_v2"  # last occurrence used
    assert selected_default[key_bela].nukta_hindi == "बेला_v2"  # defaults to hindi

    # Act: include_all_curated = True
    selected_all, summary_all = match_curated_to_missing(missing_map, curated_rows, include_all_curated=True)

    # Assert: now both Bela and NotInMissing should be included
    assert summary_all.matched == 2
    assert summary_all.unmatched_missing == 0  # the single missing (Bela) is covered
    assert summary_all.unmatched_curated == 0  # flag includes all curated
    assert key_bela in selected_all
    assert ("village", _canon_en("NotInMissing")) in selected_all


def test_load_curated_with_default_kind_when_missing_column(tmp_path):
    # Arrange: CSV without a 'kind' column; default-kind provided via arg
    curated_csv = tmp_path / "curated_no_kind.csv"
    rows = [
        ["english", "hindi", "nukta_hindi"],
        ["Badwahi", "बडवाही", "बड़वाही"],
        ["Karri", "करी", ""],  # nukta defaults to hindi
    ]
    with open(curated_csv, "w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerows(rows)

    # Act
    curated_rows = load_curated_csv(str(curated_csv), default_kind="village")

    # Assert
    assert len(curated_rows) == 2
    assert all(r.kind == "village" for r in curated_rows)
    # Ensure nukta default is applied in loader
    karri = next(r for r in curated_rows if _canon_en(r.english) == _canon_en("Karri"))
    assert karri.nukta_hindi == "करी"
