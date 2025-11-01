#!/usr/bin/env python3
"""
Script for data merging, processing, and storage.
Merges village data with constituency mappings, normalizes four variants, handles discrepancies, and saves processed data.
"""

import json
import os
from typing import List, Dict, Any
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

def load_data(file_path: str) -> Dict[str, Any]:
    """Load JSON data."""
    if not os.path.exists(file_path):
        return {}
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def normalize_variants(village: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize four variants: generate missing ones."""
    hindi = village.get("hindi", village.get("name", ""))
    english = village.get("english", village.get("name_english", ""))
    if not english and hindi:
        english = transliterate(hindi, sanscript.DEVANAGARI, sanscript.ITRANS)
    nukta_hindi = hindi  # Placeholder for diacritics
    transliteration = english if english else transliterate(hindi, sanscript.DEVANAGARI, sanscript.ITRANS)

    village.update({
        "hindi": hindi,
        "nukta_hindi": nukta_hindi,
        "english": english,
        "transliteration": transliteration
    })
    return village

def merge_with_constituencies(villages: List[Dict[str, Any]], constituencies: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Merge villages with constituency data (simple match by district)."""
    merged = []
    for village in villages:
        district = village.get("district", "")
        # Simple lookup; enhance with fuzzy matching if needed
        constituency = constituencies.get(district, {})
        village["assembly_constituency"] = constituency.get("assembly", "")
        village["parliamentary_constituency"] = constituency.get("parliamentary", "")
        merged.append(village)
    return merged

def handle_discrepancies(villages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Handle discrepancies (e.g., normalize names, log issues)."""
    processed = []
    for village in villages:
        # Normalize district names (e.g., handle variations)
        district = village.get("district", "").strip()
        if "रायपुर" in district:
            village["district"] = "रायपुर"
        # Log discrepancies
        if not village.get("english"):
            print(f"Warning: Missing English for {village.get('hindi', 'Unknown')}")
        processed.append(village)
    return processed

def save_processed_data(data: List[Dict[str, Any]], output_file: str):
    """Save processed data."""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def main():
    draft_file = "data/draft_cg_data.json"
    geocoded_file = "data/geocoded_villages.json"
    constituencies_file = "data/constituencies.json"  # Placeholder for constituency data
    output_file = "data/processed_villages.json"

    # Load data
    draft_data = load_data(draft_file)
    geocoded_data = load_data(geocoded_file)
    constituencies = load_data(constituencies_file)

    villages = draft_data.get("sample_data", []) + geocoded_data  # Merge sources

    # Process
    normalized = [normalize_variants(v) for v in villages]
    merged = merge_with_constituencies(normalized, constituencies)
    processed = handle_discrepancies(merged)

    # Save
    save_processed_data(processed, output_file)
    print(f"Processed {len(processed)} villages; saved to {output_file}")

if __name__ == "__main__":
    main()
