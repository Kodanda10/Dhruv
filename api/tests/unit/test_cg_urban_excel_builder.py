import json
import pandas as pd
import pytest

from api.src.sota.dataset_builders import cg_urban_excel_builder as mod
from api.src.sota.dataset_builders.cg_urban_excel_builder import (
    map_headers,
    _project_columns,
    _normalize_frame,
    _dedup,
    _record_from_row,
    canon,
)


def make_df(columns, rows):
    return pd.DataFrame(rows, columns=columns)


def test_map_headers_variants_hindi_and_english():
    # Create a DataFrame with mixed Hindi/English headers that should map to district/ulb/ward
    columns = ["जिला", "नगर निगम", "वार्ड नाम", "district code", "ulb code", "ward code", "PIN"]
    rows = [
        ["Raipur", "Raipur Nagar Nigam", "Ward 1", "001", "U001", "W001", "492001"],
    ]
    df = make_df(columns, rows)

    mapping = map_headers(df)
    # Required keys present
    assert set(["district", "ulb", "ward"]).issubset(mapping.keys())

    # Optional codes should map if present
    assert "district_code" in mapping
    assert "ulb_code" in mapping
    assert "ward_code" in mapping
    assert "pincode" in mapping

    # Ensure mapped columns point to originals
    assert mapping["district"] == "जिला"
    assert mapping["ulb"] == "नगर निगम"
    assert mapping["ward"] == "वार्ड नाम"
    assert mapping["district_code"] == "district code"
    assert mapping["ulb_code"] == "ulb code"
    assert mapping["ward_code"] == "ward code"
    assert mapping["pincode"] == "PIN"


def test_normalize_frame_composite_key_and_whitespace():
    df = pd.DataFrame(
        {
            "district": ["  Raipur  "],
            "ulb": [" Raipur  Nagar  Nigam  "],
            "ward": ["  Ward   10 "],
        }
    )
    norm = _normalize_frame(df)
    assert "composite_key" in norm.columns
    # composite key is canon(district)|canon(ulb)|canon(ward)
    expected_key = f"{canon('Raipur')}|{canon('Raipur Nagar Nigam')}|{canon('Ward 10')}"
    assert norm.loc[0, "composite_key"] == expected_key


def test_dedup_keeps_first_duplicate():
    df = pd.DataFrame(
        {
            "district": ["Raipur", "Raipur"],
            "ulb": ["Raipur Nagar Nigam", "Raipur Nagar Nigam"],
            "ward": ["Ward 10", "Ward 10"],  # duplicate
        }
    )
    norm = _normalize_frame(df)
    uniq, dups = _dedup(norm)
    assert len(uniq) == 1
    assert len(dups) == 1
    # First row should be kept
    assert uniq.iloc[0]["ward"] == "Ward 10"


def test_record_shape_contains_variants_and_source(tmp_path):
    # Build a minimal row after normalization and codes
    row = pd.Series(
        {
            "district": "Raipur",
            "ulb": "Raipur Nagar Nigam",
            "ward": "Ward 10",
            "district_code": "001",
            "ulb_code": "U001",
            "ward_code": "W010",
            "pincode": "492001",
        }
    )
    source = "/path/to/source.xlsx"
    rec = _record_from_row(row, source, 5)

    # Top-level fields
    assert "district" in rec and "ulb" in rec and "ward" in rec
    assert "variants" in rec and isinstance(rec["variants"], dict)
    assert "composite_key" in rec
    assert "source" in rec and rec["source"]["file"] == source and rec["source"]["row_index"] == 5

    # Variants should exist for each hierarchy level
    for key in ("district", "ulb", "ward"):
        assert key in rec["variants"]
        v = rec["variants"][key]
        # each variant dict should have the four fields
        for k in ("hindi", "nukta_hindi", "english", "transliteration"):
            assert k in v

    # composite key built from canon of hindi variants
    expected_key = f"{canon(rec['district'])}|{canon(rec['ulb'])}|{canon(rec['ward'])}"
    assert rec["composite_key"] == expected_key

    # Optional codes passed through
    assert rec["district_code"] == "001"
    assert rec["ulb_code"] == "U001"
    assert rec["ward_code"] == "W010"
    assert rec["pincode"] == "492001"


def test_end_to_end_generator_with_monkeypatch(monkeypatch, tmp_path):
    # Prepare a small DataFrame representing an Excel with one duplicate
    columns = ["जिला", "नगर निगम", "वार्ड"]
    rows = [
        ["Raipur", "Raipur Nagar Nigam", "Ward 1"],
        ["Raipur", "Raipur Nagar Nigam", "Ward 1"],  # duplicate row
        ["Raipur", "Raipur Nagar Nigam", "Ward 2"],
    ]
    df_excel = make_df(columns, rows)

    # Monkeypatch internal functions to avoid real I/O or heavy validations
    monkeypatch.setattr(mod, "_read_excel", lambda path: df_excel)
    monkeypatch.setattr(mod, "run_pandera_validation", lambda df: None)
    monkeypatch.setattr(mod, "run_ge_validation", lambda df: None)

    rejects_file = tmp_path / "rejects.ndjson"
    out = list(mod.build_cg_urban_excel_dataset(xlsx_path="dummy.xlsx", rejects_path=str(rejects_file)))

    # We expect duplicates removed: 3 input rows -> 2 output records
    assert len(out) == 2

    # Validate JSON structure of outputs
    recs = [json.loads(line) for line in out]
    keys = {r["ward"] for r in recs}
    assert keys == {"Ward 1", "Ward 2"}

    # Ensure ulb_english and ward_english fields are present
    for r in recs:
        assert "ulb_english" in r and "ward_english" in r
        assert isinstance(r["variants"], dict)
        assert "composite_key" in r

    # Rejects file should contain exactly one duplicate entry
    with open(rejects_file, "r", encoding="utf-8") as fh:
        rej_lines = [json.loads(l) for l in fh if l.strip()]
    assert len(rej_lines) == 1
    assert rej_lines[0]["reason"] == "duplicate_composite_key"
    assert rej_lines[0]["ward"] == "Ward 1"
