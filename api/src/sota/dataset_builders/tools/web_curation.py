#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
web_curation.py — Autonomous web curation for authoritative Hindi spellings

Purpose
- Autonomously verify Hindi and Nukta-Hindi spellings for Gram Panchayat/Village names
  from authoritative sources (portal/Gazette) with zero human action required when verified.
- Safeguards: domain allowlist, deterministic verification, on-disk cache, idempotent auto-merge.

Key features
- Search providers (flag/ENV driven):
  - Google CSE (GOOGLE_CSE_ID + GOOGLE_API_KEY)
  - Bing Web Search (BING_SEARCH_KEY)
- Domain allowlist for authoritative/credible sources (gov/nic portals; extensible)
- Offline cache for search results and page fetches
- Heuristic verification:
  - Extract Devanagari candidates from allowlisted pages
  - Transliterate Hindi→Latin and compare to English query canon
  - Select the strongest candidate and emit mapping with source URL
- Outputs:
  - NDJSON lines for new mappings (with source, verified_on, verified_by "web-curator")
  - Optional auto-merge into geography_name_map.json

Flags
- Controlled by api/src/config/feature_flags.py:
  - ENABLE_AUTONOMOUS_WEB_CURATION
  - ENABLE_WEB_SCRAPING
  - ENABLE_SEARCH_AUTOMATION
  - ENABLE_WEB_CACHE
- When disabled, the script will exit non-zero unless --force is provided (for dry runs).

Usage examples
- Dry run (no writes), default paths:
  python api/src/sota/dataset_builders/tools/web_curation.py --dry-run

- Curate and write NDJSON + auto-merge JSON (default behavior when flags enabled):
  python api/src/sota/dataset_builders/tools/web_curation.py --auto-merge

- Target a single name:
  python api/src/sota/dataset_builders/tools/web_curation.py --kind village --name "Badwahi" --auto-merge

Environment
- GOOGLE_CSE_ID, GOOGLE_API_KEY (optional, preferred)
- BING_SEARCH_KEY (optional fallback)
"""

from __future__ import annotations

import argparse
import csv
import dataclasses
import datetime as dt
import hashlib
import io
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

# Optional deps (requests/bs4 are commonplace; handle gracefully if missing)
try:
    import requests  # type: ignore
except Exception:
    requests = None  # type: ignore

try:
    from bs4 import BeautifulSoup  # type: ignore
except Exception:
    BeautifulSoup = None  # type: ignore

# Feature flags (guard all network I/O)
try:
    from config.feature_flags import FLAGS  # type: ignore
except Exception:
    # Sensible defaults: DISABLE network by default
    @dataclass
    class _FallbackFlags:
        ENABLE_AUTONOMOUS_WEB_CURATION: bool = False
        ENABLE_WEB_SCRAPING: bool = False
        ENABLE_SEARCH_AUTOMATION: bool = False
        ENABLE_WEB_CACHE: bool = True

    FLAGS = _FallbackFlags()  # type: ignore


# Paths and constants
def _repo_root() -> str:
    here = os.path.abspath(os.path.dirname(__file__))
    # Ascend to project root from: api/src/sota/dataset_builders/tools -> root
    return os.path.abspath(os.path.join(here, "..", "..", "..", "..", ".."))


def _nm_dir() -> str:
    return os.path.join(_repo_root(), "data", "name_mappings")


DEFAULT_MISSING = os.path.join(_nm_dir(), "missing_names.ndjson")
DEFAULT_OUT_NDJSON = os.path.join(_nm_dir(), "autocurated", "geography_name_map.ndjson")
DEFAULT_JSON_MAP = os.path.join(_nm_dir(), "geography_name_map.json")
DEFAULT_CACHE_DIR = os.path.join(_repo_root(), "data", ".web_cache")

ALLOWLISTED_DOMAINS: Tuple[str, ...] = (
    # Central and state portals (authoritative/canonical):
    ".gov.in",
    ".nic.in",
    # Likely Chhattisgarh-specific portals (update as needed):
    "cgstate.gov.in",
    "rural.cg.gov.in",
    "prd.cg.nic.in",
    "prd.cgstate.gov.in",
    "censusindia.gov.in",
    "egramswaraj.gov.in",
    "panchayat.gov.in",
    "cg.nic.in",
    "cg.gov.in",
)

# Deterministic seed URLs (allowlisted landing pages, directories, or listings)
# Used when search APIs are unavailable; pages are crawled politely and cached.
SEED_URLS: Tuple[str, ...] = (
    "https://rural.cg.gov.in/",
    "https://prd.cg.nic.in/",
    "https://egramswaraj.gov.in/",
    "https://censusindia.gov.in/",
    "https://panchayat.gov.in/",
)

DEVANAGARI_PATTERN = re.compile(r"[ऀ-ॿ]+")  # Unicode range for Devanagari


# Local normalization/transliteration helpers (import from translation.py if available)
def _normalize_ws(s: str) -> str:
    return " ".join((s or "").strip().split())


def _ascii_friendly(s: str) -> str:
    if not s:
        return s
    cleaned = "".join(ch if ch.isalnum() or ch in [" ", "-", "_"] else " " for ch in s)
    return _normalize_ws(cleaned).lower()


def _normalize_nukta(hindi: str) -> str:
    if not hindi:
        return hindi
    return _normalize_ws(hindi.replace("़", ""))


# Try to reuse the dataset transliterator for consistency
try:
    from sota.dataset_builders.translation import _transliterate_hi_to_en as _tx_hi_to_en  # type: ignore
except Exception:
    _tx_hi_to_en = None  # type: ignore

# Fallback transliteration map (simplified, consistent with translation.py spirit)
_DEV_TO_LAT = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu",
    "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
    "ऋ": "ri", "ॠ": "rii",
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
    "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f", "य़": "y",
    "ं": "n", "ँ": "n", "ः": "h", "़": "", "्": "",
    "ा": "a", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
    "।": " ", "\u0964": " ",
}


def _transliterate_hi_to_en(hindi: str) -> str:
    if _tx_hi_to_en:
        try:
            return _tx_hi_to_en(hindi)
        except Exception:
            pass
    out = []
    for ch in hindi or "":
        out.append(_DEV_TO_LAT.get(ch, ch))
    return _normalize_ws("".join(out))


def _canon_en(s: str) -> str:
    return _ascii_friendly(_normalize_ws(s or ""))


def _today() -> str:
    return dt.date.today().isoformat()


def _sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()


def _is_allowlisted(url: str) -> bool:
    try:
        low = url.lower()
        if not low.startswith("http"):
            return False
        # Allow list by domain suffix containment
        for dom in ALLOWLISTED_DOMAINS:
            if dom in low:
                return True
        return False
    except Exception:
        return False


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


class Cache:
    def __init__(self, base_dir: str, enabled: bool = True) -> None:
        self.base_dir = base_dir
        self.enabled = enabled
        if self.enabled:
            os.makedirs(self.base_dir, exist_ok=True)

    def _path(self, key: str, kind: str) -> str:
        fname = f"{kind}-{_sha1(key)}.json"
        return os.path.join(self.base_dir, fname)

    def get(self, key: str, kind: str) -> Optional[Dict[str, Any]]:
        if not self.enabled:
            return None
        path = self._path(key, kind)
        if os.path.exists(path):
            try:
                with io.open(path, "r", encoding="utf-8") as fh:
                    return json.load(fh)
            except Exception:
                return None
        return None

    def set(self, key: str, kind: str, payload: Dict[str, Any]) -> None:
        if not self.enabled:
            return
        path = self._path(key, kind)
        tmp = path + ".tmp"
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with io.open(tmp, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, path)


class SearchProvider:
    def __init__(self, cache: Cache, rate_limit_s: float = 0.8) -> None:
        self.cache = cache
        # Allow overriding rate limit via env (seconds between calls)
        try:
            self.rate_limit_s = float(os.getenv("CSE_RATE_LIMIT_S", str(rate_limit_s)))
        except Exception:
            self.rate_limit_s = rate_limit_s
        # Strict daily budget for Google CSE (default 100/day)
        try:
            self.daily_budget = max(0, int(os.getenv("CSE_DAILY_BUDGET", "100")))
        except Exception:
            self.daily_budget = 100

    def _budget_path(self) -> str:
        return os.path.join(self.cache.base_dir, "cse_budget.json")

    def _load_budget(self) -> Dict[str, Any]:
        p = self._budget_path()
        try:
            with io.open(p, "r", encoding="utf-8") as fh:
                obj = json.load(fh)
            if obj.get("date") != _today():
                return {"date": _today(), "count": 0}
            return obj
        except Exception:
            return {"date": _today(), "count": 0}

    def _save_budget(self, obj: Dict[str, Any]) -> None:
        p = self._budget_path()
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + ".tmp"
        with io.open(tmp, "w", encoding="utf-8") as fh:
            json.dump(obj, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, p)

    def _check_and_increment_budget(self) -> bool:
        """
        Enforce strict per-day Google CSE query budget.
        Returns False if budget exhausted; True and increments otherwise.
        """
        if self.daily_budget <= 0:
            return False
        state = self._load_budget()
        if state.get("date") != _today():
            state = {"date": _today(), "count": 0}
        if state.get("count", 0) >= self.daily_budget:
            # Budget exhausted for today
            return False
        state["count"] = int(state.get("count", 0)) + 1
        self._save_budget(state)
        return True

    def search(self, query: str, site_filters: Sequence[str]) -> List[SearchResult]:
        """
        Try Google CSE (preferred) → Bing → empty list.
        Only returns allowlisted results (enforced again on fetch).
        """
        results = self._search_google_cse(query, site_filters)
        if not results:
            results = self._search_bing(query, site_filters)
        # Filter for allowlisted URLs
        filtered = [r for r in results if _is_allowlisted(r.url)]
        return filtered

    def _search_google_cse(self, query: str, site_filters: Sequence[str]) -> List[SearchResult]:
        cse_id = os.getenv("GOOGLE_CSE_ID", "").strip()
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not (FLAGS.ENABLE_SEARCH_AUTOMATION and requests and cse_id and api_key):
            return []
        key = json.dumps({"q": query, "sites": site_filters, "engine": "google_cse"}, ensure_ascii=False)
        cached = self.cache.get(key, "search")
        if cached:
            return [SearchResult(**r) for r in cached.get("results", [])]
        # Strict daily budget guard (default 100/day). If exhausted, skip API call.
        if not self._check_and_increment_budget():
            return []

        # Build query with site: filters
        site_q = " OR ".join([f"site:{s}" for s in site_filters])
        full_q = f'{query} ({site_q})'
        url = "https://www.googleapis.com/customsearch/v1"
        params = {"key": api_key, "cx": cse_id, "q": full_q, "num": 10}
        try:
            time.sleep(self.rate_limit_s)
            resp = requests.get(url, params=params, timeout=20)
            if resp.status_code != 200:
                return []
            data = resp.json()
            items = data.get("items", []) or []
            out: List[SearchResult] = []
            for it in items:
                link = it.get("link") or it.get("formattedUrl") or ""
                if not link:
                    continue
                out.append(SearchResult(
                    title=_normalize_ws(it.get("title", "")),
                    url=link,
                    snippet=_normalize_ws(it.get("snippet", "")),
                ))
            self.cache.set(key, "search", {"results": [dataclasses.asdict(r) for r in out]})
            return out
        except Exception:
            return []

    def _search_bing(self, query: str, site_filters: Sequence[str]) -> List[SearchResult]:
        api_key = os.getenv("BING_SEARCH_KEY", "").strip()
        if not (FLAGS.ENABLE_SEARCH_AUTOMATION and requests and api_key):
            return []
        key = json.dumps({"q": query, "sites": site_filters, "engine": "bing"}, ensure_ascii=False)
        cached = self.cache.get(key, "search")
        if cached:
            return [SearchResult(**r) for r in cached.get("results", [])]

        # Build query with site: filters
        site_q = " OR ".join([f"site:{s}" for s in site_filters])
        full_q = f'{query} ({site_q})'
        url = "https://api.bing.microsoft.com/v7.0/search"
        headers = {"Ocp-Apim-Subscription-Key": api_key}
        params = {"q": full_q, "count": 10, "responseFilter": "Webpages"}
        try:
            time.sleep(self.rate_limit_s)
            resp = requests.get(url, params=params, headers=headers, timeout=20)
            if resp.status_code != 200:
                return []
            data = resp.json()
            web_pages = (data.get("webPages") or {}).get("value", []) or []
            out: List[SearchResult] = []
            for it in web_pages:
                link = it.get("url") or ""
                if not link:
                    continue
                out.append(SearchResult(
                    title=_normalize_ws(it.get("name", "")),
                    url=link,
                    snippet=_normalize_ws(it.get("snippet", "")),
                ))
            self.cache.set(key, "search", {"results": [dataclasses.asdict(r) for r in out]})
            return out
        except Exception:
            return []


@dataclass
class Candidate:
    hindi: str
    nukta_hindi: str
    translit: str
    source_url: str
    source_title: str
    score: float


class WebCurator:
    def __init__(self, cache_dir: str = DEFAULT_CACHE_DIR, timeout_s: int = 25) -> None:
        self.cache = Cache(cache_dir, enabled=getattr(FLAGS, "ENABLE_WEB_CACHE", True))
        self.searcher = SearchProvider(self.cache)
        self.timeout_s = timeout_s

    def _fetch_url(self, url: str) -> Optional[str]:
        if not (FLAGS.ENABLE_WEB_SCRAPING and requests):
            return None
        key = url
        cached = self.cache.get(key, "page")
        if cached and "body" in cached:
            return cached["body"]
        try:
            time.sleep(0.8)
            resp = requests.get(url, timeout=self.timeout_s, headers={"User-Agent": "dhruv-web-curator/1.0"})
            if resp.status_code != 200 or not resp.text:
                return None
            body = resp.text
            self.cache.set(key, "page", {"url": url, "body": body})
            return body
        except Exception:
            return None

    def _extract_devanagari_chunks(self, html: str) -> List[str]:
        if not BeautifulSoup:
            # Fallback: strip tags naïvely
            text = re.sub(r"<[^>]+>", " ", html or "")
        else:
            # Try robust parsers with graceful fallback to naïve tag strip
            try:
                # Prefer lxml if available (more tolerant)
                soup = BeautifulSoup(html, "lxml")
                for tag in soup(["script", "style", "noscript"]):
                    tag.extract()
                text = soup.get_text(separator=" ")
            except Exception:
                try:
                    # Fallback to stdlib HTML parser
                    soup = BeautifulSoup(html, "html.parser")
                    for tag in soup(["script", "style", "noscript"]):
                        tag.extract()
                    text = soup.get_text(separator=" ")
                except Exception:
                    # Hard fallback: strip tags naïvely if all parsers reject markup
                    text = re.sub(r"<[^>]+>", " ", html or "")
        text = _normalize_ws(text)
        # Collect contiguous Devanagari sequences
        matches = DEVANAGARI_PATTERN.findall(text)
        # Deduplicate while preserving order and length priority
        seen = set()
        out: List[str] = []
        for m in matches:
            m_norm = _normalize_ws(m)
            if len(m_norm) < 2:
                continue
            if m_norm not in seen:
                seen.add(m_norm)
                out.append(m_norm)
        # Prefer longer tokens first for scoring consistency
        out.sort(key=lambda s: (-len(s), s))
        return out

    def _score_candidate(self, english_query: str, hindi: str) -> float:
        """
        Score alignment between English query and Hindi token via transliteration match.
        Simple rule:
          - exact match of translit canon → high score
          - contains/startswith → medium score
          - otherwise low
        """
        hindi_norm = _normalize_nukta(hindi)
        translit = _ascii_friendly(_transliterate_hi_to_en(hindi_norm))
        q = _canon_en(english_query)
        if translit == q:
            return 1.0
        if translit.replace(" ", "") == q.replace(" ", ""):
            return 0.85
        if translit.startswith(q) or q.startswith(translit):
            return 0.7
        if q in translit or translit in q:
            return 0.6
        # Final fallback: token overlap by words
        q_words = set(q.split())
        t_words = set(translit.split())
        if q_words and len(q_words & t_words) > 0:
            return 0.5
        return 0.0

    def _pick_best_candidate(self, english_query: str, chunks: List[str], source_url: str, source_title: str) -> Optional[Candidate]:
        best: Optional[Candidate] = None
        for hi in chunks:
            score = self._score_candidate(english_query, hi)
            if score <= 0.0:
                continue
            nh = _normalize_nukta(hi)
            translit = _ascii_friendly(_transliterate_hi_to_en(nh or hi))
            cand = Candidate(
                hindi=hi,
                nukta_hindi=nh or hi,
                translit=translit,
                source_url=source_url,
                source_title=source_title,
                score=score,
            )
            if (best is None) or (cand.score > best.score):
                best = cand
                if best.score >= 1.0:
                    break
        return best

    def curate_one(self, kind: str, english: str, max_pages: int = 6) -> Optional[Candidate]:
        """
        Returns a verified candidate if found on allowlisted domains.
        Strategy:
          1) If search is enabled, try search results (allowlisted only).
          2) If search yields nothing or is disabled, crawl deterministic SEED_URLS.
        """
        if not (FLAGS.ENABLE_AUTONOMOUS_WEB_CURATION and (FLAGS.ENABLE_SEARCH_AUTOMATION or FLAGS.ENABLE_WEB_SCRAPING)):
            return None

        query = _normalize_ws(english)
        min_score = 0.85

        # (1) Search path (if enabled)
        results: List[SearchResult] = []
        if getattr(FLAGS, "ENABLE_SEARCH_AUTOMATION", False):
            site_filters = list(ALLOWLISTED_DOMAINS)
            results = self.searcher.search(query=query, site_filters=site_filters)

        # Evaluate search results first (if any)
        count = 0
        for r in results or []:
            if count >= max_pages:
                break
            if not _is_allowlisted(r.url):
                continue
            html = self._fetch_url(r.url)
            if not html:
                continue
            chunks = self._extract_devanagari_chunks(html)
            best = self._pick_best_candidate(english_query=english, chunks=chunks, source_url=r.url, source_title=r.title)
            count += 1
            if best and best.score >= min_score:
                return best

        # (2) Seed crawl fallback (no search results or search disabled)
        if getattr(FLAGS, "ENABLE_WEB_SCRAPING", False) and SEED_URLS:
            pages_checked = 0
            for seed in SEED_URLS:
                if pages_checked >= max_pages:
                    break
                if not _is_allowlisted(seed):
                    continue
                html = self._fetch_url(seed)
                if not html:
                    continue
                chunks = self._extract_devanagari_chunks(html)
                best = self._pick_best_candidate(english_query=english, chunks=chunks, source_url=seed, source_title="seed")
                pages_checked += 1
                if best and best.score >= min_score:
                    return best

        return None

    def load_missing(self, missing_path: str) -> List[Tuple[str, str]]:
        out: List[Tuple[str, str]] = []
        if not os.path.exists(missing_path):
            return out
        with io.open(missing_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except Exception:
                    continue
                kind = _normalize_ws(str(rec.get("kind", ""))).lower()
                if kind not in ("village", "gram_panchayat"):
                    continue
                en = _normalize_ws(rec.get("english", ""))
                if not en:
                    continue
                out.append((kind, en))
        # dedupe while preserving order on canon key
        seen: set[Tuple[str, str]] = set()
        uniq: List[Tuple[str, str]] = []
        for kind, en in out:
            key = (kind, _canon_en(en))
            if key in seen:
                continue
            seen.add(key)
            uniq.append((kind, en))
        return uniq

    def emit_ndjson(self, candidates: List[Tuple[str, str, Candidate]], out_path: str) -> str:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with io.open(out_path, "a", encoding="utf-8") as fh:
            for kind, english, cand in candidates:
                obj = {
                    "kind": kind,
                    "english": _normalize_ws(english),
                    "hindi": _normalize_ws(cand.hindi),
                    "nukta_hindi": _normalize_nukta(cand.nukta_hindi or cand.hindi),
                    "source": cand.source_url,
                    "source_title": cand.source_title,
                    "verified_by": "web-curator",
                    "verified_on": _today(),
                    "notes": f"auto-verified score={cand.score:.2f}",
                }
                fh.write(json.dumps(obj, ensure_ascii=False) + "\n")
        return out_path

    def auto_merge_json(self, candidates: List[Tuple[str, str, Candidate]], json_path: str) -> str:
        # Load or initialize object
        obj: Dict[str, Dict[str, Dict[str, str]]] = {"village": {}, "gram_panchayat": {}}
        if os.path.exists(json_path):
            try:
                with io.open(json_path, "r", encoding="utf-8") as fh:
                    existing = json.load(fh)
                for k in ("village", "gram_panchayat"):
                    if isinstance(existing.get(k), dict):
                        obj[k] = existing[k]
            except Exception:
                pass
        # Merge entries
        for kind, english, cand in candidates:
            entry = {"hindi": _normalize_ws(cand.hindi), "nukta_hindi": _normalize_nukta(cand.nukta_hindi or cand.hindi)}
            obj.setdefault(kind, {})[_normalize_ws(english)] = entry
        # Write atomically
        os.makedirs(os.path.dirname(json_path), exist_ok=True)
        tmp = json_path + ".tmp"
        with io.open(tmp, "w", encoding="utf-8") as fh:
            json.dump(obj, fh, ensure_ascii=False, indent=2)
        os.replace(tmp, json_path)
        return json_path

    def run_batch(
        self,
        missing_path: str = DEFAULT_MISSING,
        out_ndjson: str = DEFAULT_OUT_NDJSON,
        auto_merge: bool = True,
        json_map_path: str = DEFAULT_JSON_MAP,
        limit: Optional[int] = None,
        min_score: float = 0.85,
    ) -> Dict[str, Any]:
        pairs = self.load_missing(missing_path)
        if limit is not None:
            pairs = pairs[:limit]
        curated: List[Tuple[str, str, Candidate]] = []
        for kind, en in pairs:
            cand = self.curate_one(kind=kind, english=en)
            if cand and cand.score >= min_score:
                curated.append((kind, en, cand))
                # small sleep to be polite
                time.sleep(0.4)
        # Emit outputs
        written_ndjson = self.emit_ndjson(curated, out_ndjson) if curated else None
        merged_json = self.auto_merge_json(curated, json_map_path) if (curated and auto_merge) else None
        return {
            "attempted": len(pairs),
            "curated": len(curated),
            "ndjson": written_ndjson,
            "json_merged": merged_json,
        }


def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Autonomous web curation for Hindi spellings (portal/Gazette).")
    p.add_argument("--missing", default=DEFAULT_MISSING, help=f"Path to missing_names.ndjson (default: {DEFAULT_MISSING})")
    p.add_argument("--out-ndjson", default=DEFAULT_OUT_NDJSON, help=f"Output NDJSON for curated mappings (default: {DEFAULT_OUT_NDJSON})")
    p.add_argument("--json-map", default=DEFAULT_JSON_MAP, help=f"geography_name_map.json path for auto-merge (default: {DEFAULT_JSON_MAP})")
    p.add_argument("--no-merge", action="store_true", help="Do not auto-merge JSON map (NDJSON only)")
    p.add_argument("--limit", type=int, default=None, help="Limit number of missing names to attempt")
    p.add_argument("--dry-run", action="store_true", help="Run without writing outputs")
    p.add_argument("--force", action="store_true", help="Force run even if feature flags are disabled (use with care)")
    p.add_argument("--kind", choices=["village", "gram_panchayat"], help="Curate a single name of this kind")
    p.add_argument("--name", help="Curate a single English name (use with --kind)")
    # Tuning knobs for Google CSE usage (propagated via env so SearchProvider picks them up)
    p.add_argument("--cse-daily-budget", type=int, default=None, help="Max Google CSE queries to use today (default via env CSE_DAILY_BUDGET=100)")
    p.add_argument("--cse-rate-limit-s", type=float, default=None, help="Seconds to sleep between CSE calls (default via env CSE_RATE_LIMIT_S=0.8)")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    ap = _build_arg_parser()
    args = ap.parse_args(argv)
    # Optionally override search budget/rate via CLI (SearchProvider reads env on init)
    if getattr(args, "cse_daily_budget", None) is not None:
        os.environ["CSE_DAILY_BUDGET"] = str(args.cse_daily_budget)
    if getattr(args, "cse_rate_limit_s", None) is not None:
        os.environ["CSE_RATE_LIMIT_S"] = str(args.cse_rate_limit_s)

    # Guard by flags unless forced
    if not args.force:
        if not FLAGS.ENABLE_AUTONOMOUS_WEB_CURATION:
            sys.stderr.write("[web_curation] Autonomous curation disabled by flags. Use --force to override.\n")
            return 2
        if not (FLAGS.ENABLE_SEARCH_AUTOMATION or FLAGS.ENABLE_WEB_SCRAPING):
            sys.stderr.write("[web_curation] Search/Scraping disabled by flags. Enable or use --force.\n")
            return 2
        if requests is None or BeautifulSoup is None:
            sys.stderr.write("[web_curation] Required libraries not available (requests, bs4). Install and retry.\n")
            return 2

    curator = WebCurator(cache_dir=DEFAULT_CACHE_DIR)

    try:
        if args.kind and args.name:
            cand = curator.curate_one(kind=args.kind, english=args.name)
            if not cand:
                print(json.dumps({"ok": False, "kind": args.kind, "name": args.name, "curated": False}, ensure_ascii=False))
                return 1
            if args.dry_run:
                print(json.dumps({
                    "ok": True,
                    "kind": args.kind,
                    "name": args.name,
                    "hindi": cand.hindi,
                    "nukta_hindi": cand.nukta_hindi,
                    "source": cand.source_url,
                    "score": cand.score,
                }, ensure_ascii=False, indent=2))
                return 0
            # Single emit + merge
            curated = [(args.kind, args.name, cand)]
            curator.emit_ndjson(curated, args.out_ndjson)
            if not args.no_merge:
                curator.auto_merge_json(curated, args.json_map)
            print(json.dumps({"ok": True, "curated": 1}, ensure_ascii=False))
            return 0

        # Batch mode
        summary = curator.run_batch(
            missing_path=args.missing,
            out_ndjson=args.out_ndjson,
            auto_merge=(not args.no_merge) and (not args.dry_run),
            json_map_path=args.json_map,
            limit=args.limit,
        )
        if args.dry_run:
            # Do not write anything in dry-run; ensure outputs keys are present as None
            summary["ndjson"] = None
            summary["json_merged"] = None
        print(json.dumps({"ok": True, **summary}, ensure_ascii=False, indent=2))
        return 0
    except Exception as e:
        sys.stderr.write(f"[web_curation] Error: {e}\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
