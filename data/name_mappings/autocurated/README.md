# Autocurated Hindi Name Mappings — Provenance and Allowlist
Note: The nightly web-curation workflow also computes a mapping coverage summary using `api/src/sota/dataset_builders/tools/coverage_report.py` and uploads it as an artifact (`coverage/web-curation-coverage.json`). To generate locally:
- `python api/src/sota/dataset_builders/tools/coverage_report.py --json-out coverage/web-curation-coverage.json`

This directory contains machine-verified mappings of English Gram Panchayat/Village names to Hindi and Nukta‑Hindi spellings. These entries are generated autonomously from authoritative sources and merged into the main geography name map without human intervention when confidence thresholds are met.

## What gets written here

- NDJSON batch (append-only):
  - `data/name_mappings/autocurated/geography_name_map.ndjson`
  - One JSON object per line, including source URL, title, verification date, and curator attribution.
- The autonomous curator also updates (via atomic merge) the consolidated JSON:
  - `data/name_mappings/geography_name_map.json`

All outputs are UTF‑8 and suitable for direct consumption by the translation pipeline.

## Provenance and domain allowlist

Only results from credible, authoritative domains are used. The curator enforces an allowlist and discards everything else. Current allowlist (extendable):

- `.gov.in`
- `.nic.in`
- `cgstate.gov.in`
- `rural.cg.gov.in`
- `prd.cg.nic.in`
- `prd.cgstate.gov.in`
- `egramswaraj.gov.in`
- `censusindia.gov.in`
- `panchayat.gov.in`
- `cg.nic.in`
- `cg.gov.in`

If a page is not from an allowlisted domain, it is not considered for verification.

## How verification works (no human action required)

1) Search (flag/ENV driven)
- Uses Google Custom Search (preferred) or Bing Web Search if credentials are provided.
- Queries are constrained with `site:` filters to the allowlisted domains.

2) Fetch and extract
- Fetches candidate pages (rate-limited, cached).
- Extracts visible text and collects Devanagari sequences.

3) Deterministic scoring
- Each Hindi candidate is normalized, nukta-normalized, transliterated to Latin deterministically (same method used by the dataset).
- The transliteration is compared against a canonicalized English query.
- Confidence scoring:
  - Exact transliteration match: 1.00
  - Normalized/space-insensitive match: ≥ 0.85
  - Other partial matches: lower scores
- Only candidates scoring ≥ 0.85 are accepted and written.

4) Outputs
- A line is appended to the NDJSON with:
  - `kind` (`"village"` or `"gram_panchayat"`)
  - `english`, `hindi`, `nukta_hindi`
  - `source` (URL), `source_title`
  - `verified_by` = `"web-curator"`, `verified_on` = ISO date
  - `notes` with the score

Example NDJSON line (pretty-printed for readability; actual file is one line):

    {
      "kind": "village",
      "english": "Badwahi",
      "hindi": "बड़वाही",
      "nukta_hindi": "बड़वाही",
      "source": "https://rural.cg.gov.in/...",
      "source_title": "Gram Panchayat Directory - Badwahi",
      "verified_by": "web-curator",
      "verified_on": "2025-09-13",
      "notes": "auto-verified score=0.92"
    }

## Feature flags (code-level)

Feature flags can be toggled in `api/src/config/feature_flags.py` or via environment variables:

- ENABLE_AUTONOMOUS_WEB_CURATION (default: false)
- ENABLE_SEARCH_AUTOMATION (default: false)
- ENABLE_WEB_SCRAPING (default: false)
- ENABLE_WEB_CACHE (default: true)
- ENABLE_RICH_TRANSLITERATION (optional)
- ENABLE_EXTERNAL_TRANSLATION (remains disabled for integrity)

Environment overrides (examples):

- `ENABLE_AUTONOMOUS_WEB_CURATION=true`
- `ENABLE_SEARCH_AUTOMATION=true` and/or `ENABLE_WEB_SCRAPING=true`
- `ENABLE_WEB_CACHE=true`

Optional search credentials:

- `GOOGLE_CSE_ID`, `GOOGLE_API_KEY`
- `BING_SEARCH_KEY`

## Run locally

- Dry-run (no writes):
  - `python api/src/sota/dataset_builders/tools/web_curation.py --dry-run`
- Batch curate and auto-merge:
  - `python api/src/sota/dataset_builders/tools/web_curation.py --auto-merge`
- Single name:
  - `python api/src/sota/dataset_builders/tools/web_curation.py --kind village --name "Badwahi" --auto-merge`

Outputs are idempotent with on-disk caching; repeated runs reuse search/page results to minimize network calls.

## CI automation (nightly)

A GitHub Actions workflow (`.github/workflows/web-curation.yml`) can run nightly (flag-guarded) to:
- Curate from authoritative sources
- Append NDJSON and merge JSON map
- Open an automated PR with changes under `data/name_mappings/**`

Enable it by setting repository Variables/Secrets for flags and (optionally) search keys.

## Cache and artifacts

- Web cache: `data/.web_cache/` (not committed)
- Autocurated NDJSON: append-only history of machine-verified additions
- Merged JSON: consolidated view for fast lookup by the translator

## Safety, reversibility, and allowlist changes

- Only allowlisted sources are trusted; expand the allowlist cautiously for new official portals.
- Every mapping includes its source URL/title and verification date for audit.
- To revert a mistaken mapping:
  - Remove or correct the entry in `geography_name_map.json` (and corresponding NDJSON line if desired).
  - Re-run the pipeline; downstream artifacts are deterministic and will reflect the change.
- If you observe systematic false positives for a particular domain, remove it from the allowlist.

## Notes and limitations

- Transliteration matching is conservative by design. Names with strong orthographic divergence between English and Hindi may require a broader search context or future heuristics.
- If both search and scraping flags are disabled, the curator will not make any network calls and will exit early.
- For transparency, avoid manual edits in `autocurated/` unless you are correcting an obvious error; prefer updating the merged JSON map with proper provenance.
