# Project Dhruv — Data and Mapping README

This repository powers a Next.js dashboard and data pipeline to build and visualize a reliable, verified dataset for Chhattisgarh villages and their electoral/administrative mappings.

Focus:
- Real, official-source data (no simulation for production datasets)
- Strict multilingual data variant discipline
- Safe, rate‑limited geocoding with MapmyIndia
- Reproducible scripts and auditable artifacts

--------------------------------------------------------------------------------
Four‑Variant Data Rule (MANDATORY)
--------------------------------------------------------------------------------

All parsing data, vector data, graph data, scraped data, and fetched data that is saved into datasets MUST be stored in four variants at all times:

1) Hindi (Devanagari) — example: रायपुर
2) Nukta-Hindi (Devanagari with diacritics when applicable) — example: ज़िला (if applicable)
3) English (Roman) — example: Raipur
4) Transliteration (deterministic Romanization of Hindi) — example: Rāypur

Requirements:
- Every record that represents a human‑readable place/entity name must include the fields:
  - hindi
  - nukta_hindi
  - english
  - transliteration
- Pipelines must deterministically generate any missing variants (e.g., transliteration) while preserving original fields from the source.
- Validation must assert presence and non‑empty values for all four variants before a dataset row is accepted into “final” artifacts.
- Where the source only has English/Hindi, pipelines must still compute the missing variants.
- Never drop original script forms when normalizing.

Recommended generation approach:
- Transliteration: Use a deterministic library (e.g., indic‑transliteration ITRANS/ISO scheme) for repeatable results.
- Nukta handling: Preserve nukta where present; if source lacks nukta but the canonicalized form requires it, generate the nukta_hindi variant accordingly.

--------------------------------------------------------------------------------
Datasets (paths and intent)
--------------------------------------------------------------------------------

Data directory: data/

Primary artifacts (real data):
- data/villages_portal_full.json
  - Output of the portal scraper (SuShasan portal).
  - Includes normalized rows with, at minimum:
    - mode: "ग्रामीण" | "शहरी"
    - district, block, panchayat, village, ward, ulb (as applicable by row)
    - raw: original header→value map for auditability
  - Four variants must be present on name‑like fields during downstream processing (e.g., village).

- data/processed_villages.json
  - Processed/normalized dataset merged with constituency linkages and validated for four variants.

- data/geocoded_villages.json
  - Geocoding enrichment results (MapmyIndia), appended to records as a “geo” object (e.g., eLoc, lat/lng, admin levels).
  - Respect rate limits (see Geocoding section).

Draft or working artifacts (used during development iteration):
- data/draft_cg_data.json
  - Small extracts for limited testing of parsers or selectors (not for production).

Developer-only (do not use for production):
- data/full_villages.json
  - Synthetic generator output used for UI/dev tests only. Do not use or publish as “real” data.

Sample minimal record shape (downstream):
  {
    "hindi": "रायपुर",
    "nukta_hindi": "रायपुर",
    "english": "Raipur",
    "transliteration": "Rāypur",
    "district": "रायपुर",
    "block": "रायपुर",
    "panchayat": "रायपुर",
    "village": "रायपुर",
    "assembly_constituency": "रायपुर शहर उत्तर",
    "parliamentary_constituency": "रायपुर",
    "geo": {
      "eLoc": "XXXXXX",
      "latitude": 21.2514,
      "longitude": 81.6296,
      "geocodeLevel": "village"
    },
    "raw": { "...": "source row as scraped for auditability" }
  }

--------------------------------------------------------------------------------
Scripts (data pipeline)
--------------------------------------------------------------------------------

All scripts are designed to be run stepwise. Always validate that four variants are present before promoting artifacts.

1) Scrape real data (preferred source)
   Script: scripts/scrape_cg_portal.js
   Description:
   - Launches Chromium via Playwright.
   - Discovers Districts and iterates both filters: ग्रामीण and शहरी.
   - Extracts the largest/primary table, supports pagination.
   - Normalizes core keys: district, block, panchayat, village, ward, ulb.
   - Saves incrementally for resilience.

   Usage (examples):
   - Install (once):
     - npm i -D @playwright/test
     - npx playwright install chromium
   - Run headless full scrape:
     - node scripts/scrape_cg_portal.js
   - Run a quick subset (3 districts) in headful mode:
     - node scripts/scrape_cg_portal.js --headful true --maxDistricts 3
   - Custom output:
     - node scripts/scrape_cg_portal.js --out data/villages_portal_full.json

   Output: data/villages_portal_full.json

2) Geocode enrichment (MapmyIndia)
   Script: scripts/geocode_villages.py
   Description:
   - Authenticates using MapmyIndia OAuth (keys loaded from .env.local).
   - Geocodes village/admin names (prioritizes english; fallback to transliteration).
   - Adds geo/copResults to records; rate‑limited with polite delays/retries.
   - Caches/limits batch size to avoid exceeding quotas.

   Env variables (in .env.local):
   - MAPMYINDIA_CLIENT_ID=...
   - MAPMYINDIA_CLIENT_SECRET=...

   Usage:
   - Ensure your Python venv is active and dependencies installed.
   - python scripts/geocode_villages.py
   - Output: data/geocoded_villages.json

3) Merge / normalize / validate (four variants guaranteed)
   Script: scripts/process_village_data.py
   Description:
   - Loads portal output and geocoded results.
   - Ensures four variants exist for each name field.
   - Merges constituency mappings (when provided).
   - Normalizes district names and logs discrepancies for review.
   - Validates four variants are present before writing processed output.

   Usage:
   - python scripts/process_village_data.py
   - Output: data/processed_villages.json

4) Deterministic electoral enrichment (offline)
   Module: api/src/sota/dataset_builders/electoral_enrichment.py
   Description:
   - Reads NDJSON records (e.g. wards or villages) and attaches Assembly / Parliamentary constituencies.
   - Uses curated lookup tables in data/constituencies.json (district/block/ULB granularity).
   - Logs rejects to data/rejects/electoral_mismatches.ndjson and fails fast when strict mode is on.

   Usage:
   - python api/src/sota/dataset_builders/electoral_enrichment.py --input data/urban.ndjson --output data/urban_with_constituencies.ndjson
   - Or wrap an in-repo builder: `enrich_from_builder(build_cg_urban_excel_dataset)`

   👉 Curated name backfills (for unresolved variants) are covered in `docs/name_mapping_backfill.md` and use `mappings_from_csv.py` to emit NDJSON/JSON patches.

5) Limited/experimental extractor (optional)
   Script: scripts/extract_cg_data.py
   Description:
   - Early prototype for fetching dropdowns and a small data subset.
   - Use the Playwright scraper as the authoritative approach.

5) Developer‑only synthetic generator (do not use for production)
   Script: scripts/generate_full_dataset.py
   Description:
   - Generates 20k synthetic entries for dev/UI testing only.
   - Not an official data source.

6) Multilingual Semantic Location Linker Testing (CLI Tool)
   Module: api/src/parsing/semantic_location_linker_test.py
   Description:
   - CLI test harness for testing the multilingual semantic location linker.
   - Supports Hindi, English, and transliterated queries with configurable backends.
   - Features: auto-detection, transliteration support, Hindi synonym expansion, FAISS/Milvus backends.

   Usage examples:
   - Basic Hindi query:
     - python -m api.src.parsing.semantic_location_linker_test "रायगढ़ कलेक्टरेट"
   - English query with FAISS backend:
     - python -m api.src.parsing.semantic_location_linker_test --backend faiss "bilaspur district"
   - Multiple matches with custom threshold:
     - python -m api.src.parsing.semantic_location_linker_test --limit 5 --min-score 0.8 "कोरबा शहर"
   - Disable transliteration:
     - python -m api.src.parsing.semantic_location_linker_test --no-transliteration "रायगढ़"
   - Disable synonym expansion:
     - python -m api.src.parsing.semantic_location_linker_test --no-synonyms "बिलासपुर जिला"
   - Verbose output:
     - python -m api.src.parsing.semantic_location_linker_test --verbose "कोरबा शहर"

   Options:
   - --backend {auto,milvus,faiss}: Backend selection (default: auto)
   - --limit LIMIT: Max matches to return (default: 3)
   - --min-score MIN_SCORE: Minimum similarity threshold (default: 0.7)
   - --no-transliteration: Disable transliteration support
   - --no-synonyms: Disable Hindi synonym expansion
   - --milvus-uri MILVUS_URI: Override Milvus URI
   - --verbose, -v: Enable detailed output

   Output: Formatted results showing matched locations with similarity scores, supporting both Hindi and English queries.

--------------------------------------------------------------------------------
MapmyIndia Geocoding (rate limits & safety)
--------------------------------------------------------------------------------

- Credentials: Provided via .env.local (never committed).
- Rate limiting strategy:
  - Batch requests with a small delay (e.g., 1–2 seconds).
  - Retry on 429 with exponential backoff.
  - Cache by normalized address key to avoid re‑queries.
- Data discipline:
  - Use english for API requests; fallback to transliteration.
  - Always preserve/attach the returned eLoc and admin components.
- Observability:
  - Log successes/failures and include counts in pipeline output.

--------------------------------------------------------------------------------
App Integration (API + UI)
--------------------------------------------------------------------------------

API endpoint (Next.js):
- GET /api/villages
  - Serves data/processed_villages.json for the UI.

UI page:
- /mapping
  - Search/filter by village, district, or constituency.
  - Displays Hindi, English, and Transliteration columns at minimum.

--------------------------------------------------------------------------------
Validation & Checklist (PR readiness)
--------------------------------------------------------------------------------

Before merging any data‑related changes:
- Four‑variant rule enforced:
  - Every record includes hindi, nukta_hindi, english, transliteration.
- Provenance:
  - raw source snapshot or fields retained for auditability.
- Geocoding:
  - If included, ensure quota‑safe runs and zero secrets in code.
- Documentation:
  - Update this README or related docs with any pipeline changes.
- CI/CD (as available in project):
  - Lint, typecheck, tests, coverage.
  - Security scans; no secrets.
  - A11y and perf checks for UI changes.

--------------------------------------------------------------------------------
Quick Start (end‑to‑end)
--------------------------------------------------------------------------------

1) Prepare environment
   - Node.js ≥ 18
   - Python 3.10+ venv (if using Python scripts)
   - npm i
   - npm i -D @playwright/test && npx playwright install chromium

2) Configure secrets
   - Create/Update .env.local:
     - MAPMYINDIA_CLIENT_ID=your_client_id_here
     - MAPMYINDIA_CLIENT_SECRET=your_client_secret_here

3) Scrape real data
   - node scripts/scrape_cg_portal.js

4) Geocode enrichment (optional, if you want lat/lng/eLoc)
   - python scripts/geocode_villages.py

5) Normalize and validate (four variants guaranteed)
   - python scripts/process_village_data.py

6) Run the app
   - npm run dev
   - Visit /mapping to explore data

--------------------------------------------------------------------------------
Autonomous Web Curation (continuous)
--------------------------------------------------------------------------------

- Purpose: Nightly zero-cost curation of authoritative Hindi/Nukta-Hindi spellings for district/block/GP/village/ULB/ward from allowlisted portals (gov.in, nic.in, censusindia.gov.in, egramswaraj.gov.in, etc.).
- Schedule: Runs nightly at 02:00 UTC and can be triggered manually via the “web-curation” workflow.
- Script: api/src/sota/dataset_builders/tools/web_curation.py
- Outputs:
  - data/name_mappings/autocurated/geography_name_map.ndjson (append-only curated lines)
  - data/name_mappings/geography_name_map.json (auto-merged map)
- Flags (env/repo variables):
  - ENABLE_AUTONOMOUS_WEB_CURATION=true to allow autonomous runs
  - ENABLE_SEARCH_AUTOMATION=true and/or ENABLE_WEB_SCRAPING=true to enable providers
  - ENABLE_WEB_CACHE=true to cache results (recommended)
  - CSE_DAILY_BUDGET=100 to strictly cap Google Custom Search JSON API calls per day (never exceed free 100/day)
  - CSE_RATE_LIMIT_S=1.5 to rate-limit seconds between Google CSE calls (polite, configurable)
- Force-run (ignores flags): python api/src/sota/dataset_builders/tools/web_curation.py --limit 200 --force --cse-daily-budget 100 --cse-rate-limit-s 1.5
- Behavior:
  - Only allowlisted domains are considered; candidates are verified deterministically.
  - Placeholders and example/README mappings are ignored by loaders.
  - Unmapped names are reduced over time; once coverage reaches 100%, electoral (AC/PC) enrichment proceeds.

--------------------------------------------------------------------------------
Notes
--------------------------------------------------------------------------------

- This README is the single source of truth for the four‑variant rule and data pipeline expectations used by this project.
- If portal schema changes, update selectors in scripts/scrape_cg_portal.js and re‑run limited tests before full runs.
- Always prefer the latest official sources. Avoid simulated data for production artifacts.

