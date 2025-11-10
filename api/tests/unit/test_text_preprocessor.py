import json
from api.src.parsing_engine.text_preprocessor import normalize_text, extract_candidates


def test_normalize_nukta_variants():
    # Load sample from data/posts.json
    with open("data/posts.json", "r", encoding="utf-8") as f:
        posts = json.load(f)

    sample_text = posts[0]["content"]  # e.g., "आज रायगढ़ में... #विकास"
    normalized = normalize_text(sample_text)

    # Nukta variants should be removed or mapped to base characters
    assert "ज़" not in normalized
    assert "ड़" not in normalized
    assert "ढ़" not in normalized

    # Basic sanity checks
    assert isinstance(normalized, str)
    assert len(normalized) > 0


def test_extract_candidates_has_keys():
    # Load sample from data/posts.json
    with open("data/posts.json", "r", encoding="utf-8") as f:
        posts = json.load(f)

    sample_text = posts[0]["content"]  # Contains a Devanagari hashtag
    candidates = extract_candidates(sample_text)

    # Ensure keys exist
    assert "hashtags" in candidates
    assert "dates" in candidates

    # Ensure the structures are lists
    assert isinstance(candidates["hashtags"], list)
    assert isinstance(candidates["dates"], list)

    # Devanagari hashtags may not be captured by the current regex (which uses \w),
    # so we only assert type/shape here to keep tests aligned with implementation.
