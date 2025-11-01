import unicodedata
import re
from typing import Dict, List


# Minimal nukta folding map for common Devanagari variants
NUKTA_MAP: Dict[str, str] = {
    "ज़": "ज",
    "ड़": "ड",
    "ढ़": "ढ",
    "क़": "क",
    "ख़": "ख",
    "फ़": "फ",
}


def normalize_text(text: str) -> str:
    """
    Normalize text for Devanagari/Hindi processing.

    Steps:
      - Normalize to NFD, remove non-spacing marks, then recompose to NFC.
      - Fold nukta characters to their base forms using NUKTA_MAP.
      - Remove extraneous punctuation and excess whitespace.

    Note:
      - This normalization is conservative and intended for baseline text processing.
      - Hashtags (#) and mentions (@) may be removed by the punctuation filter here.
        If you require preservation for downstream extraction, run candidate
        extraction before aggressive punctuation cleanup or adapt the regex.

    Args:
      text: Input string.

    Returns:
      A normalized string suitable for downstream parsing.
    """
    if not text:
        return ""

    # Decompose to NFD, remove non-spacing marks (e.g., nukta), then recompose to NFC
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = unicodedata.normalize("NFC", text)

    # Apply nukta folding
    for nukta, base in NUKTA_MAP.items():
        text = text.replace(nukta, base)

    # Keep word chars, whitespace, and Devanagari block; strip the rest
    text = re.sub(r"[^\w\s\u0900-\u097F]", "", text)
    # Collapse consecutive whitespace
    text = re.sub(r"\s+", " ", text).strip()

    return text


def extract_candidates(text: str) -> Dict[str, List[str]]:
    """
    Extract candidate tokens from text.

    Current candidates:
      - dates: naive DD/MM/YYYY or DD-MM-YYYY patterns
      - hashtags: words starting with '#', leveraging Unicode word characters

    Args:
      text: Raw input text (preferably pre-validated).

    Returns:
      Dict with keys: 'dates' (List[str]) and 'hashtags' (List[str]).
    """
    dates = re.findall(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", text)
    hashtags = re.findall(r"#\w+", text)
    return {"dates": dates, "hashtags": hashtags}
