import os
from dataclasses import dataclass

def _bool_env(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")

@dataclass
class FeatureFlags:
    ENABLE_VISION: bool = False
    ENABLE_VIDEO: bool = False
    ENABLE_EMBEDDINGS: bool = True
    ENABLE_SOTA_DATASET_BUILDER: bool = True
    ENABLE_RICH_TRANSLITERATION: bool = False
    ENABLE_SOTA_POST_PARSER: bool = False
    # Autonomous web verification/curation (network I/O guarded by flags)
    ENABLE_EXTERNAL_TRANSLATION: bool = False
    ENABLE_AUTONOMOUS_WEB_CURATION: bool = False
    ENABLE_WEB_SCRAPING: bool = False
    ENABLE_SEARCH_AUTOMATION: bool = False
    ENABLE_WEB_CACHE: bool = True

def build_flags_from_env() -> FeatureFlags:
    base = FeatureFlags()
    # Web curation/search/cache overrides via environment variables
    base.ENABLE_AUTONOMOUS_WEB_CURATION = _bool_env("ENABLE_AUTONOMOUS_WEB_CURATION", base.ENABLE_AUTONOMOUS_WEB_CURATION)
    base.ENABLE_WEB_SCRAPING = _bool_env("ENABLE_WEB_SCRAPING", base.ENABLE_WEB_SCRAPING)
    base.ENABLE_SEARCH_AUTOMATION = _bool_env("ENABLE_SEARCH_AUTOMATION", base.ENABLE_SEARCH_AUTOMATION)
    base.ENABLE_WEB_CACHE = _bool_env("ENABLE_WEB_CACHE", base.ENABLE_WEB_CACHE)
    # Optional related flags
    base.ENABLE_EXTERNAL_TRANSLATION = _bool_env("ENABLE_EXTERNAL_TRANSLATION", base.ENABLE_EXTERNAL_TRANSLATION)
    base.ENABLE_RICH_TRANSLITERATION = _bool_env("ENABLE_RICH_TRANSLITERATION", base.ENABLE_RICH_TRANSLITERATION)
    return base

FLAGS = build_flags_from_env()
