# Chhattisgarh Geography Dataset (Excel-Driven, NDJSON)
Tip (batch): To process multiple rural Excel files together, run:
- PYTHONPATH=api/src python api/src/sota/dataset_builders/cg_geo_excel_batch.py --xlsx data/CG_Geo_1.xlsx --xlsx data/CG_Geo_2.xlsx --xlsx data/CG_Geo_3.xlsx --out data/datasets/chhattisgarh_geography.ndjson --rejects data/rejects/cg_geo_duplicates.ndjson
Note: Urban Excel files (e.g., data/CG_Urgban_Geo_4.xlsx) are not handled by this rural builder; process them via the urban pipeline/scraper.

This document describes the Excel-driven geography dataset builder that emits a normalized, deduplicated rural hierarchy for Chhattisgarh:
District → Block (Vikas Khand/Janpad) → Gram Panchayat → Village.

It covers input format, normalization, four-variant naming, validations (Pandera + Great Expectations), output artifacts, ETL wiring, operations, and rollback.

--------------------------------------------------------------------------------
1) Source and Scope
--------------------------------------------------------------------------------
- Source file: data/CG_Geo_1.xlsx
- Expected rows: 5,000+ (one row per village)
- Hierarchy levels:
  - district (जिला)
  - block (विकास खण्ड / विकासखण्ड / जनपद)
  - gram_panchayat (ग्राम पंचायत)
  - village (ग्राम/गांव/गाँव)
- Out of scope:
  - Urban wards/ULBs (handled by a separate urban pipeline/scraper)
  - Inferring AC/PC codes unless present in Excel
  - Geocoding (lat/lon) unless present in Excel

--------------------------------------------------------------------------------
2) Builder Overview
--------------------------------------------------------------------------------
- Module: api/src/sota/dataset_builders/cg_geo_excel_builder.py
- Public generator:
  - build_cg_geo_excel_dataset(xlsx_path: Optional[str] = None, rejects_path: Optional[str] = None) -> Iterable[str]
  - Yields NDJSON lines, one per unique village.
- Environment overrides:
  - CG_GEO_XLSX_PATH: path to Excel (defaults to data/CG_Geo_1.xlsx)
  - CG_GEO_REJECTS_PATH: path to rejects file (defaults to data/rejects/cg_geo_duplicates.ndjson)
- ETL registration:
  - Registered under dataset_name = "geography_excel"
  - Integrated in the monthly ETL runner (api/src/sota/etl_pipeline.py)

--------------------------------------------------------------------------------
3) Header Mapping
--------------------------------------------------------------------------------
The builder maps real Excel headers (Hindi/English) to canonical keys with a tolerant matcher.

Required canonical columns:
- district
  - candidates: ["जिला", "ज़िला", "जिले", "district", "DISTRICT"]
- block
  - candidates: ["विकास खण्ड", "विकासखण्ड", "जनपद", "block", "BLOCK", "tehsil", "tahsil"]
- gram_panchayat
  - candidates: ["ग्राम पंचायत", "ग्राम  पंचायत", "ग्रामपंचायत", "ग्राम.पंचायत", "gram panchayat", "panchayat", "GP", "gp"]
- village
  - candidates: ["ग्राम", "गांव", "गाँव", "village", "VILLAGE"]

Optional pass-throughs (if present):
- district_code, block_code, gram_panchayat_code, village_code, pincode

Fail-fast: If any required column cannot be mapped, the builder raises an error with the available headers listed.

--------------------------------------------------------------------------------
4) Normalization and Four Variants
--------------------------------------------------------------------------------
Each hierarchy text is normalized and enriched with four variants:

- hindi: trimmed, whitespace-collapsed text
- nukta_hindi: hindi with consistent nukta normalization (e.g., ज़, क़)
- english: best-effort deterministic Devanagari→Latin transliteration (no diacritics)
- transliteration: ascii-friendly, lowercased slug-like transliteration (safe for keys/search)

Deterministic canonicalization function (canon) is used for deduplication keys:
canon = ascii_friendly(nukta_normalize(collapse_whitespace(text)))

--------------------------------------------------------------------------------
5) Deduplication Strategy (Data Duplication Handling)
--------------------------------------------------------------------------------
Problem: The Excel is known to contain duplicates because it was extracted from another dataset.

Solution:
- Composite key: district|block|gram_panchayat|village (after canonicalization)
- Keep-first policy: the first occurrence is retained; subsequent duplicates are written to rejects
- Rejects artifact:
  - Path: data/rejects/cg_geo_duplicates.ndjson (append-only)
  - One line per duplicate with:
    - reason = "duplicate_composite_key"
    - composite_key
    - district, block, gram_panchayat, village
    - source.file and (logical) row_index

This ensures a stable, deduplicated output and transparent accounting of removed rows.

--------------------------------------------------------------------------------
6) Validations (Shift-Left Data Quality)
--------------------------------------------------------------------------------
Two layers of validation:

A) Pandera schema (Python)
- Required columns non-null: district, block, gram_panchayat, village
- Type coercion to str and post-normalization whitespace collapse
- Fail-fast: schema violations raise with actionable messages

B) Great Expectations (optional, if installed)
- Column non-null checks for required fields
- Uniqueness on composite_key
- Table row count ≥ 1 sanity check
- Strict mode: if GE is present and any expectation fails, the builder raises

Validation artifacts:
- At this stage, validations are run in-process. Future enhancement can persist a JSON validation result under data/validations/cg_geo_excel.json.

--------------------------------------------------------------------------------
7) Output Artifacts
--------------------------------------------------------------------------------
Primary dataset (NDJSON):
- Path: data/datasets/chhattisgarh_geography.ndjson (produced by ETL from builder)
- One line per unique village
- Example record (one line, pretty-printed here):

{
  "district": "रायपुर",
  "block": "धरसीवां",
  "gram_panchayat": "पंचायत A",
  "village": "ग्राम X",
  "variants": {
    "district": {
      "hindi": "रायपुर",
      "nukta_hindi": "रायपुर",
      "english": "raipur",
      "transliteration": "raipur"
    },
    "block": {
      "hindi": "धरसीवां",
      "nukta_hindi": "धरसीवां",
      "english": "dharasivan",
      "transliteration": "dharasivan"
    },
    "gram_panchayat": {
      "hindi": "पंचायत A",
      "nukta_hindi": "पंचायत A",
      "english": "panchayat a",
      "transliteration": "panchayat a"
    },
    "village": {
      "hindi": "ग्राम X",
      "nukta_hindi": "ग्राम X",
      "english": "gram x",
      "transliteration": "gram x"
    }
  },
  "composite_key": "raipur|dharasivan|panchayat a|gram x",
  "pincode": "492001",
  "source": {
    "file": "data/CG_Geo_1.xlsx",
    "row_index": 0
  }
}

Partitioned exports (optional, future):
- data/datasets/chhattisgarh_geography_by_district/<district>.ndjson

Summary (optional, future):
- data/datasets/chhattisgarh_geography.summary.json (counts for districts/blocks/gps/villages, duplicates, rejects path, validation status)

Rejects:
- data/rejects/cg_geo_duplicates.ndjson (append-only log, see section 5)

Checksums (managed by ETL):
- data/dataset_checksums.json (dataset_name → SHA256)

--------------------------------------------------------------------------------
8) ETL Integration and Idempotency
--------------------------------------------------------------------------------
- The builder is registered with dataset_name = "geography_excel".
- The ETL orchestrator:
  - Collects generator lines into a string blob
  - Computes checksum (SHA256)
  - If checksum unchanged since last run, skips updates (idempotent)
  - On change, writes to Postgres dims (if connected) and updates files
- Insert policy (database):
  - ON CONFLICT DO NOTHING on (state, district, village) as a minimal guard (tune as needed)
- File safety:
  - Recommended pattern: write to temp file → validate → move to final path
  - ETL will continue to evolve to ensure atomic writes

--------------------------------------------------------------------------------
9) Tests (TDD)
--------------------------------------------------------------------------------
Fail-first unit tests validate:
- Header mapping for Hindi/English label variants
- Variant generation coverage and properties
- Dedup correctness (composite_key)
- Pandera validation smoke
- Full generator path with in-memory DataFrame (no real I/O), including rejects emission

Reference tests:
- tests/sota/test_cg_geo_excel_builder_schema.py

Coverage target:
- Lines ≥ 85%, Branches ≥ 70%

--------------------------------------------------------------------------------
10) Operations
--------------------------------------------------------------------------------
Run locally (examples):
- Generate NDJSON to stdout:
  - python api/src/sota/dataset_builders/cg_geo_excel_builder.py > data/datasets/chhattisgarh_geography.ndjson
- Monthly ETL (includes other datasets):
  - python api/src/sota/etl_pipeline.py
- Override source/paths:
  - CG_GEO_XLSX_PATH=/custom/path.xlsx CG_GEO_REJECTS_PATH=/tmp/rejects.ndjson python api/src/sota/etl_pipeline.py

Observability:
- Builder logs structured messages (counts, duplicates) via stdout.
- Future: write audit artifact under data/audits/cg_geo_excel.audit.json with:
  - started_at, ended_at, input checksum, rows_in, rows_out, duplicates, validation_status.

Performance:
- 5k+ rows fits in memory comfortably; single-pass operations in pandas.
- For larger files, switch to chunked read or pyarrow for improved performance.

--------------------------------------------------------------------------------
11) Failure Modes and Remediation
--------------------------------------------------------------------------------
- Missing required header → builder fails with header list; fix mapping or column names in Excel.
- Pandera/GE validation fail → builder fails; inspect offending records, fix source or relax expectations (with justification).
- Duplicate flood (very high duplicates) → output remains deduped; rejects log grows; investigate upstream source process.
- Path not found (Excel) → set CG_GEO_XLSX_PATH correctly or place file under data/.

--------------------------------------------------------------------------------
12) Rollback and Re-runs
--------------------------------------------------------------------------------
- Rollback: Use previous dataset version (checksums tracked; artifacts should be kept under version control or backups).
- Re-run: After fixing source/headers, re-run builder/ETL; checksum will change and pipeline will update downstream.
- SLA/SLO (recommended):
  - Monthly refresh due by day 3 of the month
  - Validation pass rate 100% (strict)
  - Zero duplicate leakage into primary NDJSON (enforced via composite_key uniqueness)

--------------------------------------------------------------------------------
13) Data Governance and Lineage
--------------------------------------------------------------------------------
- Input lineage:
  - source.file = data/CG_Geo_1.xlsx (or env override), row_index recorded per output record
- Transform lineage:
  - Normalization (whitespace/nukta), transliteration algorithms described in this doc
- Output lineage:
  - NDJSON lines, composite_key generation rules in section 4
  - Checksums stored in data/dataset_checksums.json

--------------------------------------------------------------------------------
14) Security and Privacy
--------------------------------------------------------------------------------
- No secrets; local file read only.
- No PII expected; dataset describes public administrative units.
- License of derivatives should align with upstream dataset license; add attribution if required.

--------------------------------------------------------------------------------
15) Roadmap / Enhancements
--------------------------------------------------------------------------------
- Persist Great Expectations result JSON under data/validations/cg_geo_excel.json
- District-level partitions plus summary file
- Add constituency enrichment if Excel includes AC/PC codes
- Optional transliteration library swap (e.g., indic-transliteration) for higher fidelity, behind a feature flag
- Add CLI flags for dry-run, sample N rows, and district filters

--------------------------------------------------------------------------------
Appendix A — Quick Reference
--------------------------------------------------------------------------------
- Builder: api/src/sota/dataset_builders/cg_geo_excel_builder.py
- Tests: tests/sota/test_cg_geo_excel_builder_schema.py
- Primary output: data/datasets/chhattisgarh_geography.ndjson
- Rejects: data/rejects/cg_geo_duplicates.ndjson
- ETL: api/src/sota/etl_pipeline.py (dataset_name = "geography_excel")
- Env overrides:
  - CG_GEO_XLSX_PATH
  - CG_GEO_REJECTS_PATH

--------------------------------------------------------------------------------
16) Curation & Mapping Helper
--------------------------------------------------------------------------------
Purpose:
- Populate authoritative Hindi and Nukta-Hindi spellings for Gram Panchayat and Village names.
- The translator records unmapped names to data/name_mappings/missing_names.ndjson.

Inputs and Locations:
- Missing log (append-only): data/name_mappings/missing_names.ndjson
- Curated CSV template: data/name_mappings/curated_names.template.csv
- Curated JSON/NDJSON destination:
  - data/name_mappings/geography_name_map.json
  - data/name_mappings/geography_name_map.ndjson

Helper CLI:
- Script: api/src/sota/dataset_builders/tools/mappings_from_csv.py

Usage examples:
- Dry-run summary:
  - python api/src/sota/dataset_builders/tools/mappings_from_csv.py --csv data/name_mappings/curated_names.csv --dry-run
- Append NDJSON mappings (default path):
  - python api/src/sota/dataset_builders/tools/mappings_from_csv.py --csv data/name_mappings/curated_names.csv --out-ndjson
- Overwrite NDJSON and merge into JSON:
  - python api/src/sota/dataset_builders/tools/mappings_from_csv.py --csv data/name_mappings/curated_names.csv --out-ndjson data/name_mappings/geography_name_map.ndjson --overwrite-ndjson --out-json data/name_mappings/geography_name_map.json --merge-json
- If your CSV lacks a kind column but all rows are villages:
  - python api/src/sota/dataset_builders/tools/mappings_from_csv.py --csv data/name_mappings/curated_names.csv --default-kind village --out-ndjson

Autonomous web curation (no human action):
- Script: api/src/sota/dataset_builders/tools/web_curation.py
- Purpose: Search/scrape only authoritative portals (gov/nic/census/egramswaraj, etc.), extract Devanagari candidates, verify via transliteration match, and auto-write mappings when confidence is high (no manual step).
- Flags (api/src/config/feature_flags.py):
  - ENABLE_AUTONOMOUS_WEB_CURATION: enable autonomous curation
  - ENABLE_SEARCH_AUTOMATION and/or ENABLE_WEB_SCRAPING: allow web search/fetch
  - ENABLE_WEB_CACHE: cache search/page results locally for repeatable runs
- Environment (optional):
  - GOOGLE_CSE_ID, GOOGLE_API_KEY for Google Custom Search
  - BING_SEARCH_KEY for Bing Web Search fallback
- Allowlisted domains (subset): .gov.in, .nic.in, cgstate.gov.in, rural.cg.gov.in, prd.cg.nic.in, egramswaraj.gov.in, censusindia.gov.in, panchayat.gov.in (extend in code as needed)
- Outputs:
  - NDJSON: data/name_mappings/autocurated/geography_name_map.ndjson
  - Auto-merge: data/name_mappings/geography_name_map.json (unless --no-merge)
- Usage examples:
  - Dry run (no writes):
    - python api/src/sota/dataset_builders/tools/web_curation.py --dry-run
  - Batch curate and auto-merge:
    - python api/src/sota/dataset_builders/tools/web_curation.py --auto-merge
  - Single name curation:
    - python api/src/sota/dataset_builders/tools/web_curation.py --kind village --name "Badwahi" --auto-merge
- Notes:
  - When flags are disabled, the helper exits; pass --force to override for testing only.

CSV columns (case-insensitive):
- Required: english
- Recommended: kind ("village"|"gram_panchayat"), hindi
- Optional: nukta_hindi, district, block, source, verified_by, verified_on (YYYY-MM-DD), notes

Notes:
- Do not guess Hindi spellings; use authoritative sources (state portal, Gazette, ULB/GP sites).
- nukta_hindi will default to hindi when not provided; combining nukta is normalized to precomposed forms.
- After adding mappings, re-run the builder/ETL; missing entries will stop appearing and variants will populate.