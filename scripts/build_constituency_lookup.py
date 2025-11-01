#!/usr/bin/env python3
"""Generate data/constituencies.json using district-level mappings.

The data sources:
- Chhattisgarh_District_Vidhansabha List.xlsx (district → assemblies)
- CG_Geo_[1..3].xlsx for block names
- CG_Urban_Geo_5.xlsx for ULB names
- User-provided Lok Sabha → Vidhan Sabha list

Since the state does not publish block/ULB → constituency links, we capture
blocks and ULBs only as name lists and leave detailed mapping to downstream tools.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set

import pandas as pd


import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"

sys.path.append(str(REPO_ROOT / "api" / "src"))
from sota.dataset_builders.electoral_enrichment import canon, normalize_whitespace  # type: ignore

DISTRICT_RENAMES: Dict[str, str] = {
    "कबीरधाम (कवर्धा)": "कबीरधाम",
    "कांकेर (उत्तर बस्तर)": "उत्तर बस्तर कांकेर",
    "जांजगीर-चांपा": "जांजगीर-चाम्पा",
    "दंतेवाड़ा (दक्षिण बस्तर)": "दक्षिण बस्तर दंतेवाडा",
    "गौरेला-पेंड्रा-मरवाही": "गौरेला-पेण्ड्रा-मरवाही",
    "बलौदाबाजार-भाटापारा": "बलौदा बाज़ार - भाटापारा",
    "बलरामपुर-रामानुजगंज": "बलरामपुर - रामानुजगंज",
    "मोहला-मानपुर-चौकी": "मोहला-मानपुर-अंबागढ़-चौकी",
    "रायगढ़": "रायगढ़",
    "राजनांदगांव": "राजनांदगाँव",
    "कोंडागांव": "कोंडागाँव",
}

ASSEMBLY_RENAMES: Dict[str, str] = {
    "लोर्मी": "लोरमी",
    "सक्ति": "सक्ती",
    "मनेन्द्रगढ़": "मनेंद्रगढ़",
    "डौंडी लोहरा": "डोंडी लोहारा",
    "संजारी बालोद": "संजारी-बालोद",
    "बलौदा बाजार": "बलौदा बाज़ार",
    "बिंद्रावागढ़": "बिंद्रानवागढ़",
    "धरसीवा": "धरसींवा",
    "पत्थलगांव": "पथलगांव",
    "लैलुंगा": "लैलूंगा",
}

PARLIAMENT_TO_ASSEMBLIES: Dict[str, List[str]] = {
    "सरगुजा (एसटी)": ["प्रेमनगर", "भटगांव", "प्रतापपुर", "रामानुजगंज", "सामरी", "लुंड्रा", "अंबिकापुर", "सीतापुर"],
    "रायगढ़ (एसटी)": ["जशपुर", "कुनकुरी", "पथलगांव", "लैलूंगा", "रायगढ़", "सारंगढ़", "खरसिया", "धरमजयगढ़"],
    "जांजगीर-चांपा (एससी)": ["अकलतरा", "जांजगीर-चांपा", "सक्ती", "चंद्रपुर", "जैजैपुर", "पामगढ़", "बिलाईगढ़", "कसडोल"],
    "कोरबा": ["भरतपुर-सोनहत", "मनेंद्रगढ़", "बैकुंठपुर", "रामपुर", "कोरबा", "कटघोरा", "पाली-तानाखार", "मरवाही"],
    "बिलासपुर": ["कोटा", "लोरमी", "मुंगेली", "तखतपुर", "बिल्हा", "बिलासपुर", "बेलतरा", "मस्तूरी"],
    "राजनांदगांव": ["पंडरिया", "कवर्धा", "खैरागढ़", "डोंगरगढ़", "राजनांदगांव", "डोंगरगांव", "खुज्जी", "मोहला-मानपुर"],
    "दुर्ग": ["पाटन", "दुर्ग ग्रामीण", "दुर्ग शहर", "भिलाई नगर", "वैशाली नगर", "अहिवारा", "साजा", "बेमेतरा", "नवागढ़"],
    "रायपुर": ["बलौदा बाज़ार", "भाटापारा", "धरसींवा", "रायपुर शहर ग्रामीण", "रायपुर शहर पश्चिम", "रायपुर शहर उत्तर", "रायपुर शहर दक्षिण", "आरंग", "अभनपुर"],
    "महासमुंद": ["सरायपाली", "बसना", "खल्लारी", "महासमुंद", "राजिम", "बिंद्रानवागढ़", "कुरुद", "धमतरी"],
    "बस्तर (एसटी)": ["कोंडागांव", "नारायणपुर", "बस्तर", "जगदलपुर", "चित्रकोट", "दंतेवाड़ा", "बीजापुर", "कोंटा"],
    "कांकेर (एसटी)": ["सिहावा", "संजारी-बालोद", "डोंडी लोहारा", "गुंडरदेही", "अंतागढ़", "भानुप्रतापपुर", "कांकेर", "केशकाल"],
}


def sanitise_district(name: str) -> str:
    value = name.replace("_x000D_", "").strip()
    value = DISTRICT_RENAMES.get(value, value)
    return normalize_whitespace(value)


def sanitise_assembly(name: str) -> str:
    value = name.replace("_x000D_", "").strip()
    value = ASSEMBLY_RENAMES.get(value, value)
    return normalize_whitespace(value)


def load_district_assemblies() -> Dict[str, List[str]]:
    df = pd.read_excel(DATA_DIR / "Chhattisgarh_District_Vidhansabha List.xlsx")
    df.columns = [str(c).strip() if isinstance(c, str) else c for c in df.columns]
    district_col = next((c for c in df.columns if "जीले" in str(c) or "जिले" in str(c) or "district" in str(c).lower()), df.columns[1])
    assembly_col = next((c for c in df.columns if "विधानसभा" in str(c)), df.columns[-1])
    df[district_col] = df[district_col].ffill()
    mapping: Dict[str, List[str]] = {}
    for dist, group in df[[district_col, assembly_col]].dropna().groupby(district_col):
        district_name = sanitise_district(str(dist))
        assemblies = [sanitise_assembly(str(val)) for val in group[assembly_col] if isinstance(val, str) and str(val).strip()]
        mapping[district_name] = assemblies
    return mapping


def load_blocks() -> Dict[str, List[str]]:
    collected: Dict[str, Set[str]] = defaultdict(set)
    for fname in ["CG_Geo_1.xlsx", "CG_Geo_2.xlsx", "CG_Geo_3.xlsx"]:
        df = pd.read_excel(DATA_DIR / fname, usecols=[1, 2])
        df.columns = ["district", "block"]
        for dist, block in df.dropna().itertuples(index=False):
            district_name = sanitise_district(str(dist))
            block_name = normalize_whitespace(str(block).replace("_x000D_", ""))
            if district_name and block_name:
                collected[district_name].add(block_name)
    return {dist: sorted(names, key=canon) for dist, names in collected.items()}


def load_ulbs() -> Dict[str, List[str]]:
    df = pd.read_excel(DATA_DIR / "CG_Urban_Geo_5.xlsx")
    df.columns = [str(c).strip() for c in df.columns]
    mapping: Dict[str, Set[str]] = defaultdict(set)
    for dist, ulb in df[["district", "ulb"]].dropna().itertuples(index=False):
        district_name = sanitise_district(str(dist))
        ulb_name = normalize_whitespace(str(ulb))
        if district_name and ulb_name:
            mapping[district_name].add(ulb_name)
    return {dist: sorted(names, key=canon) for dist, names in mapping.items()}


def build_lookup() -> Dict[str, Dict]:
    district_assemblies = load_district_assemblies()
    blocks = load_blocks()
    ulbs = load_ulbs()
    assembly_to_pc = {canon(sanitise_assembly(ac)): pc for pc, acs in PARLIAMENT_TO_ASSEMBLIES.items() for ac in acs}

    result: Dict[str, Dict] = {}
    for district, assemblies in district_assemblies.items():
        canonical_assemblies = [sanitise_assembly(ac) for ac in assemblies]
        pcs = sorted({assembly_to_pc.get(canon(ac)) for ac in canonical_assemblies if assembly_to_pc.get(canon(ac))})
        if not pcs:
            raise ValueError(f"Missing parliamentary mapping for {district}")
        parliamentary_value = pcs[0] if len(pcs) == 1 else pcs
        result[district] = {
            "assembly": canonical_assemblies[0],
            "parliamentary": parliamentary_value,
            "assemblies": canonical_assemblies,
            "block_names": blocks.get(district, []),
            "ulb_names": ulbs.get(district, []),
        }
    return result


def main() -> None:
    lookup = build_lookup()
    payload = {"districts": lookup}
    output_path = DATA_DIR / "constituencies.json"
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {output_path} with {len(lookup)} districts")


if __name__ == "__main__":
    main()
