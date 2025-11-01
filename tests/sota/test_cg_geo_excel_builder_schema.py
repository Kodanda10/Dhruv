# -*- coding: utf-8 -*-
"""
Tests for Excel-driven Chhattisgarh geography builder:
- Header mapping (Hindi/English variants)
- Variants generation (Hindi/Nukta-Hindi/English/Transliteration)
- Deduplication on composite key
- Pandera/GE validation presence (smoke)
- End-to-end generation via monkeypatched Excel reader (no real file I/O)
"""

import os
import sys
import json
import types
import pandas as pd
import pytest

# Ensure api/src is importable
THIS_DIR = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(THIS_DIR, "..", ".."))
API_SRC = os.path.join(REPO_ROOT, "api", "src")
if API_SRC not in sys.path:
    sys.path.insert(0, API_SRC)

# Import module under test
from sota.dataset_builders import cg_geo_excel_builder as mod  # type: ignore


def test_map_headers_hindi():
    # Arrange: Hindi headers
    df = pd.DataFrame(
        [["रायपुर", "धरसीवां", "पंचायत A", "ग्राम X"]],
        columns=["जिला", "विकास खण्ड", "ग्राम पंचायत", "ग्राम"],
    )

    # Act
    mapping = mod.map_headers(df)

    # Assert
    assert mapping["district"] == "जिला"
    assert mapping["block"] == "विकास खण्ड"
    assert mapping["gram_panchayat"] == "ग्राम पंचायत"
    assert mapping["village"] == "ग्राम"


def test_make_variants_properties():
    # Arrange
    text = "छत्तीसगढ़"

    # Act
    v = mod.make_variants(text)

    # Assert: keys exist and are non-empty
    for k in ["hindi", "nukta_hindi", "english", "transliteration"]:
        assert k in v
        assert isinstance(v[k], str)
        assert v[k].strip() != ""

    # Transliteration should be lowercase ascii-friendly
    assert v["transliteration"] == v["transliteration"].lower()


def test_dedup_logic_on_composite_key():
    # Arrange: 3 rows with 1 duplicate (same normalized composite)
    data = [
        {"district": "रायपुर", "block": "धरसीवां", "gram_panchayat": "पंचायत A", "village": "ग्राम X"},
        {"district": "रायपुर", "block": "धरसीवां", "gram_panchayat": "पंचायत A", "village": "ग्राम Y"},
        {"district": "रायपुर ", "block": "  धरसीवां", "gram_panchayat": "पंचायत  A", "village": "ग्राम X"},  # duplicate of row 0 after normalization
    ]
    df = pd.DataFrame(data)

    # Act
    norm = mod._normalize_frame(df)  # internal by design
    uniq, dups = mod._dedup(norm)

    # Assert: 2 uniques, 1 duplicate
    assert len(uniq) == 2
    assert len(dups) == 1

    # Composite keys exist and are non-empty
    assert "composite_key" in norm.columns
    assert all(isinstance(x, str) and x for x in uniq["composite_key"])


@pytest.mark.skipif(pytest.importorskip("pandera", minversion=None) is None, reason="pandera not available")
def test_pandera_validation_smoke():
    # Arrange: valid minimal frame
    df = pd.DataFrame(
        [
            {"district": "रायपुर", "block": "धरसीवां", "gram_panchayat": "पंचायत A", "village": "ग्राम X"},
            {"district": "रायपुर", "block": "धरसीवां", "gram_panchayat": "पंचायत A", "village": "ग्राम Y"},
        ]
    )
    df = mod._normalize_frame(df)

    # Act / Assert: should not raise
    mod.run_pandera_validation(df)


def test_builder_yields_records_and_variants(monkeypatch, tmp_path):
    # Arrange: sample in-memory "Excel" DataFrame with 3 rows (1 duplicate)
    df_excel = pd.DataFrame(
        [
            ["रायपुर", "धरसीवां", "पंचायत A", "ग्राम X", "492001"],
            ["रायपुर", "धरसीवां", "पंचायत A", "ग्राम Y", "492001"],
            ["रायपुर ", "  धरसीवां", "पंचायत  A", "ग्राम X", "492001"],  # duplicate of row 0 after normalization
        ],
        columns=["जिला", "विकास खण्ड", "ग्राम पंचायत", "ग्राम", "पिनकोड"],
    )

    # Monkeypatch the Excel reader to avoid file I/O
    monkeypatch.setattr(mod, "_read_excel", lambda path: df_excel)

    # Capture rejects into a temp file
    rejects_file = tmp_path / "rejects.ndjson"
    monkeypatch.setattr(mod, "REJECTS_PATH", str(rejects_file))

    # Optional: stub _write_rejects to ensure call path works but still writes to temp file
    original_write_rejects = mod._write_rejects

    def _write_rejects_wrapper(dups_df, rp, sp):
        return original_write_rejects(dups_df, str(rejects_file), sp)

    monkeypatch.setattr(mod, "_write_rejects", _write_rejects_wrapper)

    # Act
    lines = list(mod.build_cg_geo_excel_dataset(xlsx_path="ignored.xlsx", rejects_path=str(rejects_file)))

    # Assert: 2 unique records emitted
    assert len(lines) == 2

    # Validate shape of records and variants presence
    for line in lines:
        rec = json.loads(line)
        # Required fields
        for f in ["district", "block", "gram_panchayat", "village", "variants", "composite_key", "source"]:
            assert f in rec
        # Variants per level
        for lvl in ["district", "block", "gram_panchayat", "village"]:
            assert lvl in rec["variants"]
            v = rec["variants"][lvl]
            for k in ["hindi", "nukta_hindi", "english", "transliteration"]:
                assert k in v
                assert isinstance(v[k], str)
                assert v[k].strip() != ""

        # Composite key should be non-empty
        assert isinstance(rec["composite_key"], str) and rec["composite_key"].strip() != ""

    # Rejects file should have 1 line (duplicate)
    if rejects_file.exists():
        with open(rejects_file, "r", encoding="utf-8") as fh:
            rejects = [ln for ln in fh.read().splitlines() if ln.strip()]
        assert len(rejects) == 1
