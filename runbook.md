# Project Dhruv Runbook

## Deploy & Rollback
- Deploy: Merge to `main` triggers Vercel Production (via Vercel GitHub App). CLI deploy workflow is skipped on PRs and non-main pushes.
- Preview: PRs auto-deploy to Vercel Preview (see "Vercel" check on PR for URL).
- Rollback: `vercel rollback <deployment-url-or-id>` restores last good build. Target the Production deployment for fast rollback (< 10 min).

## Feature Flags
- `FLAG_PARSE`: Controls parsing pipeline.
  - Production default: OFF (enable via Vercel env).
  - Dev/Test default: ON (set `FLAG_PARSE=off` to disable).
- `ENABLE_SOTA_DATASET_BUILDER`: Controls SOTA dataset ETL (builders/validations).
  - Default: OFF (enable in dev/test to run ETL and validations)
- `ENABLE_SOTA_POST_PARSER`: Controls SOTA post parser.
  - Default: OFF (enable only after staging verification)
- `FLAG_HUMAN_REVIEW`: Controls manual review UI.
  - Default: OFF (set `NEXT_PUBLIC_FLAG_HUMAN_REVIEW=on` to enable)
- `FLAG_DATA_VALIDATION`: Gates Pandera/Great Expectations validations.
  - Default: OFF. Turn ON to enforce Pandera validations in CI and locally.
  - Local: `export FLAG_DATA_VALIDATION=on` then `python -m api.validations.pandera.run_all --json-out validation/pandera-summary.json`
  - CI: set repository variable `FLAG_DATA_VALIDATION=on` to enable the “Data Validation (Pandera)” job.
- `ENABLE_VISION`: Controls vision processing (OCR, face detection).
  - Default: OFF (text-only mode).
  - Enable: `export ENABLE_VISION=true` for multi-modal parsing.
- `ENABLE_VIDEO`: Controls video processing (keyframes, OCR).
  - Default: OFF (text-only mode).
  - Enable: `export ENABLE_VIDEO=true` for video parsing.
- `ENABLE_EMBEDDINGS`: Controls embedding generation and vector storage.
  - Default: ON (enable for similarity search).
  - Disable: `export ENABLE_EMBEDDINGS=false` for text-only.
- Proposed (planning): `ENABLE_SOTA_KG`, `ENABLE_SOTA_MLOPS`, `ENABLE_SOTA_UNIFIED_QUERY` — default OFF until Phase 5 implementation.
- Change flags in Vercel Project → Settings → Environment Variables.

## Infra Setup
- **Local Development**: Navigate to `infra/` and run `docker-compose up -d` to start Postgres (port 5432) and Neo4j (ports 7474/7687).
- **Health Checks**: Run `python scripts/health_check.py` to verify connectivity to both databases.
- **ADR**: See `infra/DECISION_RECORDS.md` for database architecture decisions (Neo4j as SoR, Postgres as mirror).
- **CI Parity**: Services are spun up in GitHub Actions for integration tests.

## Text Preprocessor
- **Purpose**: Normalizes Hindi/Devanagari text, handles nukta variants, and extracts candidates (dates, hashtags) for parsing.
- **Location**: `api/src/parsing_engine/text_preprocessor.py`
- **Key Functions**:
  - `normalize_text(text)`: Applies Unicode normalization, removes nukta variants, cleans punctuation.
  - `extract_candidates(text)`: Extracts dates and hashtags using regex.
- **Usage**: Called early in the parsing pipeline to prepare text for reasoning.
- **Tests**: Unit tests in `api/tests/unit/test_text_preprocessor.py` using samples from `data/posts.json`.

## Health & Monitoring
- API: `/api/health` returns `{status:'ok', traceId, flags}` (includes `FLAG_DATA_VALIDATION`, `FLAG_PARSE`, etc.).
- Synthetic checks via CI: k6 (p95 <= 300ms), Lighthouse (perf), axe (a11y).

## CI Quality Gates
- Coverage: lines >= 95%, branches >= 70% (temporarily 85/70 for PR 38 to unblock; restore to 95/70 in follow-up coverage-hardening PR).
- Required checks: lint, type, unit, coverage gate, security, SBOM/licenses, web-a11y-perf, perf-k6, e2e, IaC, audit.

## UI Theme (PR #37)
- Theme: Teal glassmorphism with high-contrast text.
- Components: `Card`, `SoftButton`, `Chip`; Amita heading font enforced via `next/font`.
- Accessibility: Correct heading order; table separators; improved placeholders.


## Incident Playbook
1) Identify failing check in GitHub Actions (use `./scripts/ci-watch.sh`).
2) Reproduce locally; create minimal fix with tests (TDD), push.
3) If Production issue, disable via flag or `vercel rollback`.
4) Follow-up PR to re-enable with root-cause fixes.

## SOTA Parsing Engine (Planning)
- **Status**: Planning only; no implementation yet.
- **Brain**: `Brains 🧠/parsing_engine_sota_prompt.md` (canonical system prompt).
- **Checklist**: `Brains 🧠/sota_checklist.md` (acceptance criteria).
- **Observability Plan**: `docs/sota_observability.md` (metrics/traces/logs).
- **Rollback & Canary**: `docs/sota_rollback_plan.md` (strategies).
- **Risk Register**: `docs/sota_risks.md` (mitigations).
- **Lineage & Governance**: `docs/sota_lineage.md` (ETL/data map).
- NEW: **Data Validation Plan**: `docs/sota_data_validation.md` (Great Expectations/Pandera contracts and CI hooks).
- NEW: **Knowledge Graph Plan**: `docs/sota_kg_plan.md` (Neo4j schema, ingestion, Cypher queries).
- NEW: **MLOps Plan**: `docs/sota_mlops.md` (experiment tracking, registry, drift, promotion).
- NEW: **Unified Query Layer Plan**: `docs/sota_unified_query.md` (router across Postgres/Milvus/Neo4j).
- **Note**: Ops procedures/placeholders for KG, MLOps, and Unified Query will be added in Phase 5 implementation.

## Data Validation (Pandera/GE)
- Scope: Initial Pandera validator for the aliases dataset (derived from `api/data/aliases.json`), feature-flagged via `FLAG_DATA_VALIDATION`.
- Local usage:
  - Run: `export FLAG_DATA_VALIDATION=on && python -m api.validations.pandera.run_all --json-out validation/pandera-summary.json`
  - Run: `export FLAG_DATA_VALIDATION=on && python -m api.validations.great_expectations --json-out data/validations/ge-summary.json`
  - Output: JSON summaries written to the specified paths (skip when flag off).
  - Disable: `export FLAG_DATA_VALIDATION=off` (validator skips and exits 0).
- CI:
  - Job: “Data Validation (Pandera)” runs in CI.
  - Enable by setting repository variable `FLAG_DATA_VALIDATION=on` (skips when `off`).
  - Artifacts: `pandera-validation-summary` uploaded for inspection.

## Heavy Dependency Testing (Opt-in, prod-like)

- Purpose: exercise real dependencies and production-like paths (pymilvus, torch, transformers, datasets, accelerate, etc.).
- CI (enable via repository variables):
  - Set `RUN_HEAVY_TESTS=on` to run the API Heavy Tests (unit+integration) — optional job.
  - Set `RUN_MILVUS_INTEGRATION=on` to attempt Milvus integration tests.
- What the job does:
  - Installs heavy deps: `pip install -r api/requirements.txt`
  - Runs unit tests: `pytest -q api/tests/unit`
  - Runs integration tests: `pytest -q api/tests/integration` (skips gracefully if Milvus/pymilvus unavailable)
- Milvus requirements for integration tests:
  - Milvus reachable at `127.0.0.1:19530` (defaults used by `MilvusEngine`)
  - If not reachable, tests are skipped; when reachable, they create a temp collection and perform insert/search/query.
- Local reproduction:
  - `python -m venv .venv && source .venv/bin/activate`
  - `pip install -r api/requirements.txt`
  - Optional: start Milvus locally; then `export RUN_MILVUS_INTEGRATION=on`
  - `pytest -q api/tests/unit`
  - `pytest -q api/tests/integration`
- Notes:
  - Integration tests include retry-and-fail coverage for an unreachable Milvus to exercise error paths.
  - Keep this job optional to control CI runtime/cost; for pre-release hardening, enable both flags.
