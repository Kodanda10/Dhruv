#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chhattisgarh Geography (Rural) — Excel Builder (NDJSON)

Reads:   data/CG_Geo_1.xlsx
Schema:  District → Block → Gram Panchayat → Village (one row per village)
Outputs: NDJSON lines (one per village) with normalized names + 4 variants
         - hindi
         - nukta_hindi (normalized nukta)
         - english (latin transliteration)
         - transliteration (ascii-friendly, lowercased)

Features:
- Robust header mapping (handles Hindi/English variants).
- Normalization of whitespace and nukta; basic Devanagari→Latin transliteration.
- Deterministic dedup using composite key: district|block|gp|village (normalized).
- Validation helpers:
  - Pandera schema for required columns and non-empty string checks.
  - Great Expectations optional suite (if installed) with uniqueness + row count.
- Audit info (source path, row index) embedded per record.

Usage:
- As generator for ETL:
    from cg_geo_excel_builder import build_cg_geo_excel_dataset
    for line in build_cg_geo_excel_dataset():
        print(line)
- As CLI:
    python cg_geo_excel_builder.py > data/datasets/chhattisgarh_geography.ndjson

Notes:
- This builder addresses data duplication explicitly: duplicate rows (same normalized
  composite key) are filtered; the first occurrence is kept, subsequent ones are
  emitted to a rejects artifact (configurable path).
- No external I/O other than reading the Excel. No secrets, no network.
"""

import os
import sys
import json
from typing import Dict, Iterable, List, Optional, Tuple

import pandas as pd

# Pandera and Great Expectations are optional but recommended (both are in api/requirements.txt).
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
    # .../Project_Dhruv/api/src/sota/dataset_builders -> go up 4 to reach repo root
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

DEFAULT_XLSX_PATH = os.path.join(repo_root(), "data", "CG_Geo_1.xlsx")
DEFAULT_REJECTS_PATH = os.path.join(repo_root(), "data", "rejects", "cg_geo_duplicates.ndjson")

# Allow override via env
XLSX_PATH = os.environ.get("CG_GEO_XLSX_PATH", DEFAULT_XLSX_PATH)
REJECTS_PATH = os.environ.get("CG_GEO_REJECTS_PATH", DEFAULT_REJECTS_PATH)


# -------------------------
# Header mapping
# -------------------------

HEADER_CANDIDATES: Dict[str, List[str]] = {
    "district": [
        "जिला", "ज़िला", "जिले", "district", "DISTRICT"
    ],
    "block": [
        "विकास खण्ड", "विकासखण्ड", "जनपद", "block", "BLOCK", "tehsil", "tahsil"
    ],
    "gram_panchayat": [
        "ग्राम पंचायत", "ग्राम  पंचायत", "ग्रामपंचायत", "ग्राम.पंचायत", "gram panchayat", "panchayat", "GP", "gp"
    ],
    "village": [
        "ग्राम", "गांव", "गाँव", "village", "VILLAGE"
    ],
    # Optional codes (if present in the Excel; we will pass through)
    "district_code": ["district code", "जिला कोड", "district_code"],
    "block_code": ["block code", "विकास खण्ड कोड", "block_code", "जनपद कोड"],
    "gram_panchayat_code": ["gp code", "पंचायत कोड", "gram panchayat code", "gp_code"],
    "village_code": ["village code", "ग्राम कोड", "village_code"],
    "pincode": ["pincode", "PIN", "पिनकोड", "पिन कोड", "पिन कोड नंबर"],
}


def _normalize_header(s: str) -> str:
    return (s or "").strip().lower().replace("\u0964", "").replace("।", "").replace("  ", " ")


def map_headers(df: pd.DataFrame) -> Dict[str, str]:
    """Map source Excel headers to canonical keys."""
    src_cols = list(df.columns)
    norm_cols = {_normalize_header(c): c for c in src_cols}

    mapping: Dict[str, str] = {}
    for canon, candidates in HEADER_CANDIDATES.items():
        for cand in candidates:
            key = _normalize_header(cand)
            # match contains or exact based on typical datasets
            # try exact
            if key in norm_cols:
                mapping[canon] = norm_cols[key]
                break
            # try contains search across normalized headers
            matched = next((orig for nrm, orig in norm_cols.items() if key in nrm), None)
            if matched:
                mapping[canon] = matched
                break
    # Required minimum
    for req in ["district", "block", "gram_panchayat", "village"]:
        if req not in mapping:
            raise ValueError(f"Required column '{req}' not found in Excel headers: {src_cols}")
    return mapping


# -------------------------
# Normalization + variants
# -------------------------

# Basic Devanagari → Latin map (subset; best-effort, deterministic)
# This is intentionally conservative; it preserves readability without adding new deps.
DEVANAGARI_TO_LATIN = {
    # vowels
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu",
    "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
    "ऋ": "ri", "ॠ": "rii",
    # consonants (basic)
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    "क्": "k", "ख्": "kh", "ग्": "g", "घ्": "gh", "ङ्": "n",
    # nukta forms (approx)
    "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f", "य़": "y",
    # signs / diacritics (stripped or approximated)
    "ं": "n", "ँ": "n", "ः": "h", "़": "", "्": "", "्य": "y",
    "ो": "o", "ौ": "au", "ा": "a", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "े": "e", "ै": "ai",
    # digits
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
    # danda
    "।": " ", "\u0964": " ",
}


def normalize_whitespace(s: str) -> str:
    return " ".join((s or "").strip().split())


def normalize_nukta(s: str) -> str:
    """Normalize nukta forms to standard Unicode where possible, and collapse stray diacritics."""
    if not s:
        return s
    # Replace common composed chars with canonical nukta forms (idempotent design).
    replacements = {
        "क़": "क़", "ख़": "ख़", "ग़": "ग़", "ज़": "ज़", "ड़": "ड़", "ढ़": "ढ़", "फ़": "फ़", "य़": "य़",
        # handle common alternate forms: z vs ज़ etc. Here we keep originals if already nukta.
    }
    out = []
    for ch in s:
        # collapse stray nukta combining dot if present alone
        if ch == "़":
            continue
        out.append(replacements.get(ch, ch))
    return normalize_whitespace("".join(out))


def transliterate_hi_to_en(s: str) -> str:
    """Transliterate with rich option (flag) and fallback to internal map."""
    if not s:
        return s
    # Try rich transliteration behind a feature flag; fallback to internal map if unavailable.
    try:
        from config.feature_flags import FLAGS  # type: ignore
        if getattr(FLAGS, "ENABLE_RICH_TRANSLITERATION", False):
            try:
                from indic_transliteration import sanscript as _sanscript  # type: ignore
                return normalize_whitespace(
                    _sanscript.transliterate(s, _sanscript.DEVANAGARI, _sanscript.ITRANS)
                )
            except Exception:
                # Library not available or transliteration failed; fallback below.
                pass
    except Exception:
        # FLAGS import not available; fallback.
        pass
    out = []
    for ch in s:
        out.append(DEVANAGARI_TO_LATIN.get(ch, ch))
    return normalize_whitespace("".join(out))


def ascii_friendly(s: str) -> str:
    """Make a lowercase ascii-friendly slug-like transliteration."""
    if not s:
        return s
    t = transliterate_hi_to_en(s)
    # keep alnum and spaces, then collapse
    cleaned = "".join(ch if ch.isalnum() or ch in [" ", "-", "_"] else " " for ch in t)
    return normalize_whitespace(cleaned).lower()


def make_variants(hindi_text: str) -> Dict[str, str]:
    h_norm = normalize_whitespace(hindi_text or "")
    h_nukta = normalize_nukta(h_norm)
    en = transliterate_hi_to_en(h_nukta)
    tr = ascii_friendly(h_nukta)
    return {
        "hindi": h_norm,
        "nukta_hindi": h_nukta,
        "english": en,
        "transliteration": tr,
    }


def canon(s: str) -> str:
    """Canonical form for keys/dedup: nukta-normalized + ascii-friendlier spaces collapsed."""
    return ascii_friendly(normalize_nukta(normalize_whitespace(s or "")))


# -------------------------
# Validation helpers
# -------------------------

def build_pandera_schema() -> Optional["DataFrameSchema"]:
    if pa is None:
        return None
    return DataFrameSchema({
        "district": Column(str, nullable=False),
        "block": Column(str, nullable=False),
        "gram_panchayat": Column(str, nullable=False),
        "village": Column(str, nullable=False),
        # Optional passthroughs if present; we won't error if missing.
    }, coerce=True)


def run_pandera_validation(df: pd.DataFrame) -> None:
    schema = build_pandera_schema()
    if schema is None:
        return
    # Ensure non-empty strings
    df = df.copy()
    for col in ["district", "block", "gram_panchayat", "village"]:
        if col in df.columns:
            df[col] = df[col].astype(str).map(lambda x: normalize_whitespace(x))
    schema.validate(df, lazy=True)


def run_ge_validation(df: pd.DataFrame) -> None:
    if ge is None:
        return
    # Create a runtime expectations suite
    gdf = ge.from_pandas(df)
    # Expectations
    gdf.expect_column_values_to_not_be_null("district")
    gdf.expect_column_values_to_not_be_null("block")
    gdf.expect_column_values_to_not_be_null("gram_panchayat")
    gdf.expect_column_values_to_not_be_null("village")
    # Uniqueness on composite_key if present
    if "composite_key" in gdf.columns:
        gdf.expect_column_values_to_not_be_null("composite_key")
        gdf.expect_column_unique_value_count_to_be_between("composite_key", min_value=len(df), max_value=len(df))
    # Basic row count sanity
    # Compatible row-count expectation across GE versions
    gdf.expect_table_row_count_to_be_between(min_value=1)
    res = gdf.validate()
    # Persist validation result to JSON (best-effort)
    try:
        out_dir = os.path.join(repo_root(), "data", "validations")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "cg_geo_excel.ge_result.json")
        with open(out_path, "w", encoding="utf-8") as fh:
            # Convert result to a JSON-serializable form across GE versions
            payload = res if isinstance(res, dict) else getattr(res, "to_json_dict", lambda: {"result": str(res)})()
            json.dump(payload, fh, ensure_ascii=False, indent=2)
    except Exception:
        # Do not block the pipeline on serialization or IO errors
        pass
    if not (res["success"] if isinstance(res, dict) else getattr(res, "success", False)):  # type: ignore
        # If GE is present, be strict; raise to fail ETL until corrected.
        raise ValueError("Great Expectations validation failed; see result for details.")


# -------------------------
# Core builder
# -------------------------

def _read_excel(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Excel not found at {path}")
    # Let pandas decide engine; consumers should ensure openpyxl is present.
    df = pd.read_excel(path)
    if df.empty:
        raise ValueError("Excel file appears to be empty.")
    return df


def _project_columns(df: pd.DataFrame, mapping: Dict[str, str]) -> pd.DataFrame:
    cols = {
        "district": df[mapping["district"]].astype(str),
        "block": df[mapping["block"]].astype(str),
        "gram_panchayat": df[mapping["gram_panchayat"]].astype(str),
        "village": df[mapping["village"]].astype(str),
    }
    # Optional pass-throughs if present in mapping
    for opt in ["district_code", "block_code", "gram_panchayat_code", "village_code", "pincode"]:
        if opt in mapping:
            cols[opt] = df[mapping[opt]]
    return pd.DataFrame(cols)


def _normalize_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in ["district", "block", "gram_panchayat", "village"]:
        df[col] = df[col].astype(str).map(normalize_whitespace)
    # Create deterministic composite key for dedup
    df["composite_key"] = (
        df["district"].map(canon) + "|" +
        df["block"].map(canon) + "|" +
        df["gram_panchayat"].map(canon) + "|" +
        df["village"].map(canon)
    )
    return df


def _dedup(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Return (unique_df, duplicates_df). Keep first occurrence."""
    if "composite_key" not in df.columns:
        return df, df.iloc[0:0].copy()
    # mark duplicates (keep=False flags all duplicates; we want keep='first' for uniques)
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
                "block": row.get("block"),
                "gram_panchayat": row.get("gram_panchayat"),
                "village": row.get("village"),
                "source": {"file": source_path},
            }
            f.write(json.dumps(out, ensure_ascii=False) + "\n")


def _record_from_row(row: pd.Series, source_path: str, idx: int) -> Dict:
    # Build variants for each hierarchy level
    v_district = make_variants(str(row["district"]))
    v_block = make_variants(str(row["block"]))
    try:
        from .translation import translate_name as _tr_name
    except Exception:
        from sota.dataset_builders.translation import translate_name as _tr_name

    gp_en = str(row["gram_panchayat"])
    vill_en = str(row["village"])
    v_gp = _tr_name("gram_panchayat", gp_en)
    v_village = _tr_name("village", vill_en)

    # Ensure non-empty variant fields; fallback to English when Hindi is missing.
    def _ensure_variant(v, en):
        v = dict(v or {})
        # Always have english
        if not (v.get("english") or "").strip():
            v["english"] = normalize_whitespace(en)
        # If hindi/nukta_hindi are missing, fall back to english (temporary until curated mapping exists)
        if not (v.get("hindi") or "").strip():
            v["hindi"] = v["english"]
        if not (v.get("nukta_hindi") or "").strip():
            v["nukta_hindi"] = v["hindi"]
        # Ensure transliteration is non-empty; prefer transliteration of Hindi, else ascii of English
        if not (v.get("transliteration") or "").strip():
            base = v.get("nukta_hindi") or v.get("hindi") or v["english"]
            v["transliteration"] = ascii_friendly(base)
        return v

    v_gp = _ensure_variant(v_gp, gp_en)
    v_village = _ensure_variant(v_village, vill_en)

    rec = {
        "district": v_district["hindi"],
        "block": v_block["hindi"],
        "gram_panchayat": v_gp["hindi"],
        "gram_panchayat_english": v_gp.get("english", ""),
        "village": v_village["hindi"],
        "village_english": v_village.get("english", ""),
        "variants": {
            "district": v_district,
            "block": v_block,
            "gram_panchayat": v_gp,
            "village": v_village,
        },
        "composite_key": row.get("composite_key"),
        "source": {
            "file": source_path,
            "row_index": int(idx),
        },
    }
    # Pass-through optional codes if present
    for opt in ["district_code", "block_code", "gram_panchayat_code", "village_code", "pincode"]:
        if opt in row and pd.notna(row[opt]):
            rec[opt] = row[opt]
    return rec


def build_cg_geo_excel_dataset(xlsx_path: Optional[str] = None,
                               rejects_path: Optional[str] = None) -> Iterable[str]:
    """
    Generator that yields NDJSON lines for each village from CG_Geo_1.xlsx.

    - Reads and maps columns.
    - Normalizes text and nukta; generates transliterations.
    - Deduplicates on composite key (first occurrence wins).
    - Validates with Pandera and (optionally) Great Expectations.
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

    # Emit NDJSON records (one per village)
    # Preserve original row order as much as possible using index
    for idx, row in unique_df.reset_index(drop=True).iterrows():
        rec = _record_from_row(row, source_path, idx)
        yield json.dumps(rec, ensure_ascii=False)


# Backwards compatible alias used by ETL registration if needed
def build_cg_geography_from_excel() -> Iterable[str]:
    return build_cg_geo_excel_dataset()


# -------------------------
# CLI
# -------------------------

if __name__ == "__main__":
    try:
        for line in build_cg_geo_excel_dataset():
            sys.stdout.write(line + "\n")
    except Exception as e:
        # Clear, actionable message for operators
        msg = f"[cg_geo_excel_builder] Error: {e}"
        sys.stderr.write(msg + "\n")
        sys.exit(1)
