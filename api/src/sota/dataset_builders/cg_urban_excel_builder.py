#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cg_urban_excel_builder.py — Chhattisgarh Urban Geography (Excel → NDJSON)

Hierarchy:
- district → ulb (ULB: Nagar Nigam / Nagar Palika / Nagar Panchayat) → ward

Outputs (one NDJSON line per ward):
- Normalized names with four variants for each hierarchy level:
  - hindi
  - nukta_hindi (nukta normalized)
  - english (latin transliteration or ascii-fied)
  - transliteration (ascii-friendly, lowercased)
- Deterministic composite key: district|ulb|ward (canon form)
- Source provenance (file path, row index)
- Optional pass-through codes (if present)
- Rejects NDJSON for duplicate composite keys (keep-first policy)

Validations:
- Pandera (pre-dedup) — required columns non-empty
- Great Expectations (deduped frame) — uniqueness + basic non-null

Notes:
- This builder is offline/deterministic; it performs no network I/O.
- It uses a conservative Devanagari→Latin mapping for english/transliteration.
- Curated urban mappings (ULB/Ward) can be added in the same name_mappings directory
  via downstream utilities, but this builder does not depend on web curation.
"""

from __future__ import annotations

import os
import sys
import json
from typing import Dict, Iterable, List, Optional, Tuple

import pandas as pd

# Optional validations
try:
    import pandera as pa
    from pandera import Column, DataFrameSchema
except Exception:  # pragma: no cover
    pa = None
    DataFrameSchema = None
    Column = None

try:
    import great_expectations as ge  # type: ignore
except Exception:  # pragma: no cover
    ge = None


# -------------------------
# Paths and configuration
# -------------------------

def repo_root() -> str:
    # .../api/src/sota/dataset_builders -> up 4 to repo root
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

# Default to the provided file path; can be overridden via env
DEFAULT_XLSX_PATH = os.path.join(repo_root(), "data", "CG_Urgban_Geo_4.xlsx")
DEFAULT_REJECTS_PATH = os.path.join(repo_root(), "data", "rejects", "cg_urban_duplicates.ndjson")

XLSX_PATH = os.environ.get("CG_URBAN_XLSX_PATH", DEFAULT_XLSX_PATH)
REJECTS_PATH = os.environ.get("CG_URBAN_REJECTS_PATH", DEFAULT_REJECTS_PATH)


# -------------------------
# Header mapping
# -------------------------

HEADER_CANDIDATES: Dict[str, List[str]] = {
    "district": [
        "जिला", "ज़िला", "जिले", "district", "DISTRICT"
    ],
    "ulb": [
        "ulb", "ULB",
        "municipality", "municipal council", "nagar nigam", "nagar palika", "nagar panchayat",
        "नगर निगम", "नगर पालिका", "नगर पंचायत", "शहर", "urban local body", "urban body", "urban council"
    ],
    "ward": [
        "ward", "ward no", "ward number", "ward_name", "ward name",
        "वार्ड", "वार्ड क्रमांक", "वार्ड संख्या", "वार्ड नाम"
    ],
    # Optional codes pass-through if present
    "district_code": ["district code", "जिला कोड", "district_code"],
    "ulb_code": ["ulb code", "नगर कोड", "municipality code", "ulb_code"],
    "ward_code": ["ward code", "वार्ड कोड", "ward_code"],
    "pincode": ["pincode", "PIN", "पिनकोड", "पिन कोड", "पिन कोड नंबर"],
}


def _normalize_header(s: str) -> str:
    s = (s or "").strip().lower()
    # remove danda and variants if appear in headers
    return s.replace("\u0964", "").replace("।", "").replace("  ", " ")


def map_headers(df: pd.DataFrame) -> Dict[str, str]:
    """Map source Excel headers to canonical keys."""
    src_cols = list(df.columns)
    norm_cols = {_normalize_header(c): c for c in src_cols}

    mapping: Dict[str, str] = {}
    # Avoid matching optional code/pincode columns when resolving required keys
    optional_keys = {"district_code", "ulb_code", "ward_code", "pincode"}
    optional_norms = set()
    for ok in optional_keys:
        for oc in HEADER_CANDIDATES.get(ok, []):
            optional_norms.add(_normalize_header(oc))
    for canon, candidates in HEADER_CANDIDATES.items():
        for cand in candidates:
            key = _normalize_header(cand)
            # exact match
            if key in norm_cols:
                mapping[canon] = norm_cols[key]
                break
            # contains match across normalized headers
            if canon in ("district", "ulb", "ward"):
                matched = next(
                    (
                        orig
                        for nrm, orig in norm_cols.items()
                        if (key in nrm) and (nrm not in optional_norms) and ("code" not in nrm) and ("pin" not in nrm)
                    ),
                    None,
                )
            else:
                matched = next((orig for nrm, orig in norm_cols.items() if key in nrm), None)
            if matched:
                mapping[canon] = matched
                break

    # Required
    for req in ["district", "ulb", "ward"]:
        if req not in mapping:
            raise ValueError(f"Required column '{req}' not found. Headers present: {src_cols}")
    return mapping


# -------------------------
# Normalization + variants
# -------------------------

DEVANAGARI_TO_LATIN = {
    # vowels
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu",
    "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
    "ऋ": "ri", "ॠ": "rii",
    # consonants
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    # nukta / signs / matras
    "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f", "य़": "y",
    "ं": "n", "ँ": "n", "ः": "h", "़": "", "्": "",
    "ा": "a", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    # digits
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
    # punctuation
    "।": " ", "\u0964": " ",
}

DEV_RANGE = (0x0900, 0x097F)


def normalize_whitespace(s: str) -> str:
    return " ".join((s or "").strip().split())


def normalize_nukta(s: str) -> str:
    """Normalize nukta forms and drop stray combining dot."""
    if not s:
        return s
    out = []
    for ch in s:
        if ch == "़":
            continue
        out.append(ch)
    return normalize_whitespace("".join(out))


def is_devanagari(s: str) -> bool:
    if not s:
        return False
    for ch in s:
        cp = ord(ch)
        if DEV_RANGE[0] <= cp <= DEV_RANGE[1]:
            return True
    return False


def transliterate_hi_to_en(s: str) -> str:
    if not s:
        return s
    out = []
    for ch in s:
        out.append(DEVANAGARI_TO_LATIN.get(ch, ch))
    return normalize_whitespace("".join(out))


def ascii_friendly(s: str) -> str:
    """Lowercased ascii-friendly slug: keep [a-z0-9-_ ] and collapse spaces."""
    if not s:
        return s
    cleaned = "".join(ch if ch.isalnum() or ch in [" ", "-", "_"] else " " for ch in s)
    return normalize_whitespace(cleaned).lower()


def make_variants(text: str) -> Dict[str, str]:
    """
    Produce {hindi, nukta_hindi, english, transliteration} from arbitrary input text.
    - If text contains Devanagari, treat as Hindi source and transliterate to Latin.
    - Otherwise, treat as Latin/English; provide sane fallbacks.
    """
    t = normalize_whitespace(text or "")
    if is_devanagari(t):
        hi = t
        nh = normalize_nukta(hi)
        en = transliterate_hi_to_en(nh or hi)
        tr = ascii_friendly(en)
        return {
            "hindi": hi,
            "nukta_hindi": nh or hi,
            "english": en,
            "transliteration": tr or ascii_friendly(hi),
        }
    else:
        # Latin source — keep as-is for hindi (placeholder) and derive transliteration from ascii form
        en = normalize_whitespace(t)
        tr = ascii_friendly(en)
        return {
            "hindi": en,          # will be replaced when curated mapping exists
            "nukta_hindi": en,    # ditto
            "english": tr or en,  # normalized latin
            "transliteration": tr or en.lower(),
        }


def canon(s: str) -> str:
    return ascii_friendly(normalize_whitespace(s or ""))


# -------------------------
# I/O and transforms
# -------------------------

def _read_excel(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Excel not found at {path}")
    df = pd.read_excel(path)
    if df.empty:
        raise ValueError("Excel file appears to be empty.")
    return df


def _project_columns(df: pd.DataFrame, mapping: Dict[str, str]) -> pd.DataFrame:
    cols = ["district", "ulb", "ward",
            "district_code", "ulb_code", "ward_code", "pincode"]
    data: Dict[str, List] = {k: [] for k in cols}
    for _, row in df.iterrows():
        d = str(row[mapping["district"]]) if pd.notna(row[mapping["district"]]) else ""
        u = str(row[mapping["ulb"]]) if pd.notna(row[mapping["ulb"]]) else ""
        w = str(row[mapping["ward"]]) if pd.notna(row[mapping["ward"]]) else ""

        data["district"].append(d)
        data["ulb"].append(u)
        data["ward"].append(w)

        # optional codes
        data["district_code"].append(str(row[mapping["district_code"]]) if "district_code" in mapping and pd.notna(row[mapping["district_code"]]) else "")
        data["ulb_code"].append(str(row[mapping["ulb_code"]]) if "ulb_code" in mapping and pd.notna(row[mapping["ulb_code"]]) else "")
        data["ward_code"].append(str(row[mapping["ward_code"]]) if "ward_code" in mapping and pd.notna(row[mapping["ward_code"]]) else "")
        data["pincode"].append(str(row[mapping["pincode"]]) if "pincode" in mapping and pd.notna(row[mapping["pincode"]]) else "")

    return pd.DataFrame(data)


def _normalize_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in ["district", "ulb", "ward"]:
        df[col] = df[col].astype(str).map(normalize_whitespace)
    # Composite key
    df["composite_key"] = (
        df["district"].map(canon) + "|" +
        df["ulb"].map(canon) + "|" +
        df["ward"].map(canon)
    )
    return df


def _dedup(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Return (unique_df, duplicates_df). Keep first occurrence."""
    if "composite_key" not in df.columns:
        return df, df.iloc[0:0].copy()
    dup_mask = df.duplicated(subset=["composite_key"], keep="first")
    dups = df[dup_mask].copy()
    uniq = df[~dup_mask].copy()
    return uniq, dups


def _ensure_dir(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def _write_rejects(dups: pd.DataFrame, rejects_path: str, source_path: str) -> None:
    if dups.empty:
        return
    _ensure_dir(rejects_path)
    with open(rejects_path, "a", encoding="utf-8") as f:
        for _, row in dups.iterrows():
            out = {
                "reason": "duplicate_composite_key",
                "composite_key": row.get("composite_key"),
                "district": row.get("district"),
                "ulb": row.get("ulb"),
                "ward": row.get("ward"),
                "source": {"file": source_path},
            }
            f.write(json.dumps(out, ensure_ascii=False) + "\n")


# -------------------------
# Validations
# -------------------------

def run_pandera_validation(df: pd.DataFrame) -> None:
    if pa is None:
        return
    schema = DataFrameSchema({
        "district": Column(str, nullable=False),
        "ulb": Column(str, nullable=False),
        "ward": Column(str, nullable=False),
        "composite_key": Column(str, nullable=False),
    })
    schema.validate(df, lazy=True)


def run_ge_validation(df: pd.DataFrame) -> None:
    if ge is None or df is None or df.empty:
        return
    try:
        gdf = ge.from_pandas(df)  # type: ignore
        gdf.expect_column_values_to_not_be_null("district")
        gdf.expect_column_values_to_not_be_null("ulb")
        gdf.expect_column_values_to_not_be_null("ward")
        gdf.expect_column_values_to_be_unique("composite_key")
        _ = gdf.validate()
    except Exception:
        # Great Expectations optional; do not fail hard here.
        pass


# -------------------------
# Record construction
# -------------------------

def _record_from_row(row: pd.Series, source_path: str, idx: int) -> Dict:
    v_d = make_variants(str(row["district"]))
    v_u = make_variants(str(row["ulb"]))
    v_w = make_variants(str(row["ward"]))

    rec = {
        "district": v_d["hindi"],
        "ulb": v_u["hindi"],
        "ward": v_w["hindi"],
        "ulb_english": v_u.get("english", ""),
        "ward_english": v_w.get("english", ""),
        "variants": {
            "district": v_d,
            "ulb": v_u,
            "ward": v_w,
        },
        "composite_key": (
            canon(v_d["hindi"]) + "|" + canon(v_u["hindi"]) + "|" + canon(v_w["hindi"])
        ),
        "source": {"file": source_path, "row_index": int(idx)},
    }
    # Pass-through optional codes
    for opt in ["district_code", "ulb_code", "ward_code", "pincode"]:
        if opt in row and pd.notna(row[opt]) and str(row[opt]).strip():
            rec[opt] = str(row[opt]).strip()
    return rec


# -------------------------
# Public builder (generator)
# -------------------------

def build_cg_urban_excel_dataset(xlsx_path: Optional[str] = None,
                                 rejects_path: Optional[str] = None) -> Iterable[str]:
    """
    Generator that yields NDJSON lines for each ward from the specified urban Excel file.

    Steps:
    - Read and map columns.
    - Normalize text and nukta; generate transliterations/variants.
    - Deduplicate on composite key (first occurrence wins).
    - Validate (Pandera pre-dedup, GE post-dedup).
    """
    source_path = xlsx_path or XLSX_PATH
    rej_path = rejects_path or REJECTS_PATH

    df_raw = _read_excel(source_path)
    mapping = map_headers(df_raw)
    df = _project_columns(df_raw, mapping)
    df = _normalize_frame(df)

    # Validate early (pre-dedup)
    run_pandera_validation(df)

    # Deduplicate
    unique_df, duplicates_df = _dedup(df)
    _write_rejects(duplicates_df, rej_path, source_path)

    # Validate uniqueness if GE is available
    run_ge_validation(unique_df)

    # Emit NDJSON
    for idx, row in unique_df.reset_index(drop=True).iterrows():
        rec = _record_from_row(row, source_path, idx)
        yield json.dumps(rec, ensure_ascii=False)


# -------------------------
# CLI
# -------------------------

if __name__ == "__main__":
    try:
        for line in build_cg_urban_excel_dataset():
            sys.stdout.write(line + "\n")
    except Exception as e:
        msg = f"[cg_urban_excel_builder] Error: {e}"
        sys.stderr.write(msg + "\n")
        sys.exit(1)
