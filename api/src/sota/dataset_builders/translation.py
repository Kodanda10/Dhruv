# Project_Dhruv/api/src/sota/dataset_builders/translation.py
# -*- coding: utf-8 -*-
"""
translation.py — Deterministic name translation utility for geography dataset

Purpose
- Convert English names (Gram Panchayat, Village) to:
  - hindi (correct Devanagari spelling)
  - nukta_hindi (canonicalized Devanagari with nukta forms normalized)
  - transliteration (ascii-friendly Latin; lowercased)
  - english (as given)
- Enforce integrity by preferring curated mappings committed to the repo.
- Optionally attempt external translation behind a feature flag (off by default).
- Record unmapped names to a "missing" artifact for curation.

Key idea
- Excel contains GP/Village names in English. We must save both the English and
  the correct Hindi/nukta-Hindi spellings, plus a transliteration.
- The only reliable way to match official Hindi spellings is a curated mapping
  (or verified translation) — not heuristics.
- This module loads mappings from data/name_mappings/* and uses them first.
- If a name is missing from the mapping, we optionally try an external translator
  (feature-flagged; no secrets; best-effort), and otherwise emit a placeholder
  with english + transliteration-from-hindi-if-known (or english-based fallback),
  and log the missing item for later curation.

Mapping formats supported
- JSON (object) form:
  {
    "village": {
      "barchha": { "hindi": "बरछा", "nukta_hindi": "बरछा" },
      ...
    },
    "gram_panchayat": {
      "mehdauli": { "hindi": "मेहदौली", "nukta_hindi": "मेहदौली" },
      ...
    }
  }

- NDJSON (line-delimited JSON) form:
  { "kind": "village", "english": "Barchha", "hindi": "बरछा", "nukta_hindi": "बरछा" }
  { "kind": "gram_panchayat", "english": "Mehdauli", "hindi": "मेहदौली", "nukta_hindi": "मेहदौली" }
  ...

Outputs
- A dict of variants:
  {
    "english": "Barchha",
    "hindi": "बरछा",
    "nukta_hindi": "बरछा",
    "transliteration": "barchha"
  }

Feature flags (configurable in api/src/config/feature_flags.py)
- ENABLE_RICH_TRANSLITERATION: use indic-transliteration if available (optional)
- ENABLE_EXTERNAL_TRANSLATION: attempt external translation if mapping missing (default False)

Paths
- Mappings directory: <repo>/data/name_mappings/
  - geography_name_map.json (preferred combined JSON)
  - geography_name_map.ndjson (or multiple *.ndjson files)
- Missing items (append-only): <repo>/data/name_mappings/missing_names.ndjson

Usage
    from sota.dataset_builders.translation import translate_name, NameTranslator
    tx = NameTranslator()
    out = tx.translate_name(kind="village", english_name="Barchha")
    print(out["hindi"], out["nukta_hindi"], out["transliteration"])

Notes
- This module does NOT call any external services by default.
- If you enable external translation via flags and env, ensure no secrets are
  committed; configure credentials via environment variables or secret manager.
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, Iterable, Optional, Tuple, Any


# -------------------------
# Repo root & paths
# -------------------------

def _repo_root() -> str:
    # api/src/sota/dataset_builders/translation.py -> up 4 levels to repo root
    here = os.path.abspath(os.path.dirname(__file__))
    return os.path.abspath(os.path.join(here, "..", "..", "..", ".."))


def _default_mappings_dir() -> str:
    return os.path.join(_repo_root(), "data", "name_mappings")


def _default_missing_path() -> str:
    return os.path.join(_default_mappings_dir(), "missing_names.ndjson")


# -------------------------
# Nukta normalization + Transliteration (Hindi→Latin)
# -------------------------

# Basic Devanagari → Latin map (deterministic, conservative; extended as needed)
_DEV_TO_LAT = {
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
    # nukta forms (approx)
    "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f", "य़": "y",
    # diacritics / matras (approx; stripped or mapped)
    "ं": "n", "ँ": "n", "ः": "h", "़": "", "्": "",
    "ा": "a", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    # digits
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
    # danda
    "।": " ", "\u0964": " ",
}

def _normalize_ws(s: str) -> str:
    return " ".join((s or "").strip().split())

def _normalize_nukta(hindi: str) -> str:
    """Normalize nukta forms and collapse stray nukta diacritic."""
    if not hindi:
        return hindi
    # Keep composed nukta chars as-is; drop stray combining nukta "़"
    out = []
    for ch in hindi:
        if ch == "़":
            continue
        out.append(ch)
    return _normalize_ws("".join(out))

def _ascii_friendly(s: str) -> str:
    """Lowercased ascii-friendly: keep [a-z0-9-_ ] and collapse spaces."""
    if not s:
        return s
    cleaned = "".join(ch if ch.isalnum() or ch in [" ", "-", "_"] else " " for ch in s)
    return _normalize_ws(cleaned).lower()

def _transliterate_hi_to_en(hindi: str) -> str:
    """
    Transliterate Hindi/Devanagari to Latin. If rich transliteration flag is on,
    try indic-transliteration; else fallback to deterministic internal map.
    """
    if not hindi:
        return hindi
    # Try feature-flagged rich transliteration (optional)
    try:
        from config.feature_flags import FLAGS  # local import to avoid import cycles
        if getattr(FLAGS, "ENABLE_RICH_TRANSLITERATION", False):
            try:
                from indic_transliteration import sanscript as _sanscript  # type: ignore
                return _normalize_ws(_sanscript.transliterate(hindi, _sanscript.DEVANAGARI, _sanscript.ITRANS))
            except Exception:
                # Fallback to internal mapping below
                pass
    except Exception:
        pass

    out = []
    for ch in hindi:
        out.append(_DEV_TO_LAT.get(ch, ch))
    return _normalize_ws("".join(out))


# -------------------------
# External translation (optional, flagged)
# -------------------------

def _external_translate_en_to_hi(text_en: str) -> Optional[Tuple[str, str]]:
    """
    Optionally translate English→Hindi via external provider (feature-flagged).
    Returns (hindi, nukta_hindi) or None if not configured/available.

    Security: No secrets are read from code. If enabled via flags, you MUST
    supply credentials via environment variables. This function intentionally
    avoids shipping provider-specific logic here; add an adapter in a secure
    environment if needed.
    """
    try:
        from config.feature_flags import FLAGS  # type: ignore
        if not getattr(FLAGS, "ENABLE_EXTERNAL_TRANSLATION", False):
            return None
    except Exception:
        return None

    # Placeholder: integrate your provider here with proper env-based keys.
    # Example shape:
    # provider = os.getenv("CG_TRANSLATE_PROVIDER")
    # api_key = os.getenv("CG_TRANSLATE_API_KEY")
    # if provider == "google" and api_key:
    #     ...
    # else:
    #     return None

    # No-op default
    return None


# -------------------------
# Mapping loader & translator
# -------------------------

def _canon_en(s: str) -> str:
    return _ascii_friendly(_normalize_ws(s or ""))

@dataclass
class NameTranslator:
    """
    Name translation orchestrator.

    - Loads curated mappings from data/name_mappings/.
    - Translates an English name to variants dict using:
        1) curated mapping (preferred),
        2) external translation (flagged; optional),
        3) fallback with english kept and transliteration derived from hindi if available
           or from english lowercased when hindi missing.
    - Records missing items to data/name_mappings/missing_names.ndjson for curation.
    """
    mappings_dir: str = field(default_factory=_default_mappings_dir)
    missing_path: str = field(default_factory=_default_missing_path)
    _map_gp: Dict[str, Dict[str, str]] = field(default_factory=dict, init=False)
    _map_vill: Dict[str, Dict[str, str]] = field(default_factory=dict, init=False)
    _loaded: bool = field(default=False, init=False)

    # Filenames we look for by default in mappings_dir
    _json_files: Tuple[str, ...] = ("geography_name_map.json",)
    _ndjson_globs: Tuple[str, ...] = ("*.ndjson",)

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        self._load_mappings()
        self._loaded = True

    def _load_mappings(self) -> None:
        """Load JSON and NDJSON mappings into memory."""
        gp: Dict[str, Dict[str, str]] = {}
        vl: Dict[str, Dict[str, str]] = {}

        # JSON file (preferred)
        for fname in self._json_files:
            path = os.path.join(self.mappings_dir, fname)
            if not os.path.exists(path):
                continue
            try:
                with open(path, "r", encoding="utf-8") as fh:
                    obj = json.load(fh)
                for kind, bucket in (("gram_panchayat", gp), ("village", vl)):
                    if kind in obj and isinstance(obj[kind], dict):
                        for en_key, payload in obj[kind].items():
                            can = _canon_en(en_key)
                            hindi = _normalize_ws(payload.get("hindi", ""))
                            nukta = _normalize_nukta(payload.get("nukta_hindi", hindi))
                            bucket[can] = {"hindi": hindi, "nukta_hindi": nukta}
            except Exception as e:
                sys.stderr.write(f"[translation] Failed to load JSON mapping {path}: {e}\n")

        # NDJSON files (only geography_name_map*.ndjson from top-level and autocurated/, ignore README and placeholders)
        try:
            dirs_to_scan = [self.mappings_dir]
            auto_dir = os.path.join(self.mappings_dir, "autocurated")
            if os.path.isdir(auto_dir):
                dirs_to_scan.append(auto_dir)
            for dpath in dirs_to_scan:
                for entry in sorted(os.listdir(dpath)):
                    # Only accept geography_name_map*.ndjson; ignore others (e.g., README.ndjson)
                    if not (entry.endswith(".ndjson") and entry.startswith("geography_name_map")):
                        continue
                    full = os.path.join(dpath, entry)
                    try:
                        with open(full, "r", encoding="utf-8") as fh:
                            for line in fh:
                                line = line.strip()
                                if not line:
                                    continue
                                try:
                                    rec = json.loads(line)
                                except Exception:
                                    continue
                                kind = _normalize_ws(str(rec.get("kind", ""))).lower()
                                en = rec.get("english")
                                if not en:
                                    continue
                                # Extract and normalize; skip placeholder/verify records
                                hindi = _normalize_ws(rec.get("hindi", ""))
                                nukta = _normalize_nukta(rec.get("nukta_hindi", hindi))
                                text_join = f"{hindi} {nukta}".lower()
                                if "<" in text_join or ">" in text_join or "verify" in text_join:
                                    continue
                                can = _canon_en(en)
                                if kind == "gram_panchayat":
                                    gp[can] = {"hindi": hindi, "nukta_hindi": nukta}
                                elif kind == "village":
                                    vl[can] = {"hindi": hindi, "nukta_hindi": nukta}
                    except Exception as e:
                        sys.stderr.write(f"[translation] Failed to load NDJSON mapping {full}: {e}\n")
        except FileNotFoundError:
            # Mappings dir may not exist initially; that's fine.
            pass

        self._map_gp = gp
        self._map_vill = vl

    def _lookup(self, kind: str, english_name: str) -> Optional[Dict[str, str]]:
        """Return {'hindi':..., 'nukta_hindi':...} if found, else None."""
        self._ensure_loaded()
        can = _canon_en(english_name)
        if kind == "gram_panchayat":
            return self._map_gp.get(can)
        if kind == "village":
            return self._map_vill.get(can)
        return None

    def _record_missing(self, kind: str, english_name: str) -> None:
        """Append missing entry to NDJSON for manual curation."""
        try:
            os.makedirs(os.path.dirname(self.missing_path), exist_ok=True)
            payload = {
                "kind": kind,
                "english": _normalize_ws(english_name),
                "why": "missing_mapping",
            }
            with open(self.missing_path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except Exception as e:
            sys.stderr.write(f"[translation] Failed to record missing mapping: {e}\n")

    def translate_name(self, kind: str, english_name: str) -> Dict[str, str]:
        """
        Translate an English name of a given kind ('village' | 'gram_panchayat')
        into variants dict: {english, hindi, nukta_hindi, transliteration}.
        """
        kind = _normalize_ws(kind).lower()
        en = _normalize_ws(english_name)

        # 1) curated mapping
        mapped = self._lookup(kind, en)
        if mapped and (mapped.get("hindi") or mapped.get("nukta_hindi")):
            hi = mapped.get("hindi", "")
            nh = _normalize_nukta(mapped.get("nukta_hindi", hi))
            translit = _ascii_friendly(_transliterate_hi_to_en(nh or hi))
            if not translit:
                translit = _ascii_friendly(en)
            return {
                "english": en,
                "hindi": hi,
                "nukta_hindi": nh or hi,
                "transliteration": translit,
            }

        # 2) optional external translation (feature-flagged)
        ext = _external_translate_en_to_hi(en)
        if ext:
            hi, nh = ext[0], _normalize_nukta(ext[1] or ext[0])
            translit = _ascii_friendly(_transliterate_hi_to_en(nh or hi))
            return {
                "english": en,
                "hindi": hi,
                "nukta_hindi": nh or hi,
                "transliteration": translit,
            }

        # 3) fallback: leave english; ask for curation; best-effort transliteration from english
        self._record_missing(kind, en)
        # We do not fabricate Hindi; that would harm integrity.
        # Transliteration fallback uses english; it’s better than empty for search.
        return {
            "english": en,
            "hindi": "",
            "nukta_hindi": "",
            "transliteration": _ascii_friendly(en),
        }


# -------------------------
# Convenience API
# -------------------------

@lru_cache(maxsize=4)
def _singleton_translator() -> NameTranslator:
    return NameTranslator()

def translate_name(kind: str, english_name: str) -> Dict[str, str]:
    """
    Module-level convenience wrapper using a cached NameTranslator instance.
    """
    return _singleton_translator().translate_name(kind=kind, english_name=english_name)


# -------------------------
# CLI (optional, human check)
# -------------------------

def _cli(argv: Optional[Iterable[str]] = None) -> int:
    import argparse
    p = argparse.ArgumentParser(description="Translate GP/Village names using curated mappings.")
    p.add_argument("--kind", "-k", choices=["village", "gram_panchayat"], required=True, help="Kind of name")
    p.add_argument("--name", "-n", required=True, help="English name to translate")
    p.add_argument("--json", action="store_true", help="Print JSON only")
    args = p.parse_args(list(argv) if argv is not None else None)

    result = translate_name(args.kind, args.name)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"English  : {result['english']}")
        print(f"Hindi    : {result['hindi'] or '(missing; recorded)'}")
        print(f"Nukta-HI : {result['nukta_hindi'] or '(missing; recorded)'}")
        print(f"Translit : {result['transliteration']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(_cli())
