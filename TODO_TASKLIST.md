# Project Dhruv — Task List (Atomic, TDD)

Legend: [ ] pending • [~] in_progress • [x] completed (UTC timestamps)

---

## Legacy Plan (Phases 1 & 2)
*All tasks below are considered complete or superseded by the Phase 3 Enhancement Plan.*

### Phase 1 — Web Dashboard
- [x] P1-02: Expand place/entity lexicon (completed: 2025-09-06T00:00:00Z)
- [x] P1-03: Expand activity lexicon (completed: 2025-09-06T00:00:00Z)
- [x] P1-04: Improve “में” heuristic (completed: 2025-09-06T00:00:00Z)
- [x] P1-06: Date range filter (from/to) (completed: 2025-09-07T14:20:28Z)
- [x] P1-07: Reset/clear filters + clickable summaries + parsing badge + chips (completed: 2025-09-07T16:45:00Z)
- [x] P1-08: Tag/mention quick filter + robust Hindi/Hinglish/English matching (completed: 2025-09-07T16:58:20Z)

### Phase 2 — Sprint 1 (Backend API & Aliases)
- [x] A-01: Scaffold Flask API (`api/`) with `/api/health`
- [x] A-02: requirements + pytest config
- [x] A-03: Parsing package skeleton `api/src/parsing/`
- [x] E-01: Contract tests for `/api/normalize`
- [x] E-02: Minimal `/api/normalize` returning normalized tokens
- [x] L-01: Define `aliases.json` schema + validator
- [x] L-02: Seed `api/data/aliases.json` (locations/tags/events)
- [x] L-03: Loader + variant→canonical index
- [x] L-05: Hot reload endpoint `/api/aliases/reload` (flagged)
- [x] N-01..N-04: Normalization (nukta, translit, phonetics, schwa) with tests
- [x] O-01..O-03: Structured logs + metrics counters

### Phase 2 — Upcoming (Sprint 2+)
- [x] Discovery pipeline (discover_aliases.py) + artifact
- [x] Admin approval UI (secure) + hot reload
- [x] API p95 ≤300ms load test + alerts
- [x] Docs & Runbook deep updates

---

## Phase 3 — Core Engine Enhancement (LangExtract + Milvus)

### Epic CMS: Solidify the Backend CMS

- [ ] CMS-01: **Enhance Admin Features**:
  - [ ] CMS-01.1: Implement user authentication for CMS access.
  - [ ] CMS-01.2: Add progress tracking for post review/labeling.
  - [ ] CMS-01.3: Implement bulk actions (e.g., approve/reject multiple posts).
- [ ] CMS-02: **Improve Review UI**:
  - [ ] CMS-02.1: Add filters to the review interface (by status, date, content).
  - [ ] CMS-02.2: Create an "Export Reviewed Data" feature to download labeled JSON.
- [ ] CMS-03: **Vercel Training Integration**:
  - [ ] CMS-03.1: Set up serverless functions for basic parsing and progress tracking.
  - [ ] CMS-03.2: Design workflow to pull reviewed data for full ML model training.
- [ ] CMS-04: **Prepare for Future Frontend**:
  - [ ] CMS-04.1: Ensure all data (raw posts, reviewed data, model metrics) is available via modular API endpoints.

### Epic E1: LangExtract Integration

- [x] LE-01: **Setup LangExtract dependency** (completed: 2025-09-08T23:06:04Z)
- [x] LE-02: **Create Initial Parser Class** (completed: 2025-09-08T23:08:34Z)
- [x] LE-03: **Develop Few-Shot Prompts** (completed: 2025-09-08T23:11:17Z)
- [x] LE-04: **Integrate Prompts into Parser** (completed: 2025-09-08T23:13:35Z)
- [x] LE-05: **Call LangExtract Model** (completed: 2025-09-08T23:16:16Z)

### Epic E2: Milvus Setup

- [x] ME-01: **Update Milvus Schema** (completed: 2025-09-08T23:28:48Z)
- [x] ME-02: **Update Data Insertion for New Schema** (completed: 2025-09-08T23:31:33Z)
- [x] ME-03: **Execute and Validate Training/Insertion Script** (completed: 2025-09-09T01:25:10Z)

### Epic E3: ML Training (IndicBERT)

- [ ] ML-01: **Data Labeling Pipeline**

### Epic E4: Flask API Wiring

- [ ] API-01: **Create `/parse` Endpoint**

### Epic E5: Dashboard (CMS) Integration

- [ ] DI-01: **Integrate `/parse` Endpoint**

### Epic E6: Validation and Audits

- [x] VA-01: **TDD for LangExtract Parser** (completed: 2025-09-09T00:55:12Z)

## Phase 4 — SOTA Parsing Engine (Planning Only — No Implementation Yet)

*Scope:* Planning acknowledgment of the canonical SOTA Parsing Engine brain (`Brains 🧠/parsing_engine_sota_prompt.md`) and decomposition of future work into atomic, gated tasks. No dataset building, semantic linking, Milvus ingestion, or event JSON parsing logic is to be implemented in this phase. Only documentation alignment, flags, test placeholders, and branch/worktree isolation planning.

### Epic S1: SOTA Parsing Engine Bootstrap (Planning)

- [x] S1-01: Add dedicated checklist file `Brains 🧠/sota_checklist.md` enumerating all acceptance criteria from the SOTA brain prompt (source-of-truth sync).
- [x] S1-02: Create isolated branch `feature/sota-parsing-engine-bootstrap` and add Git worktree (`git worktree add ../Project_Dhruv_sota feature/sota-parsing-engine-bootstrap`) (completed: branch created, pushed to GitHub, branch protection rules set for main requiring all Ironclad CI gates: lint-type, unit-tests, coverage-gate, security, licenses-sbom, web-a11y-perf, api-contract, perf-k6, e2e-smoke; strict mode enabled, 1 approving review required).
- [x] S1-03: Add placeholder failing test `tests/sota/parsing-brain-link.test.ts` verifying existence + hash of `parsing_engine_sota_prompt.md`.
- [x] S1-04: Feature flag placeholders added (config/flags.ts) for `ENABLE_SOTA_DATASET_BUILDER`, `ENABLE_SOTA_POST_PARSER` (default off).
- [x] S1-05: Draft minimal OpenAPI stub (no handlers) for future endpoints: `/api/sota/parse`, `/api/sota/datasets` (gated by flags).
- [x] S1-06: Author observability plan doc (`docs/sota_observability.md`) defining metrics: accuracy@1/@3, taxonomy_F1, date_accuracy, oov_rate, drift, RED (req_rate/errors/duration), Milvus query latency. (completed: 2025-09-10T12:00:00Z)
- [x] S1-07: Author rollback & canary strategy doc (`docs/sota_rollback_plan.md`) linking feature flags and ≤10 min rollback path. (completed: 2025-09-10T12:00:00Z)
- [x] S1-08: Add risk register entry (`docs/sota_risks.md`) covering data quality drift, ambiguous geo hierarchy, festival date resolution variance. (completed: 2025-09-10T12:00:00Z)
- [x] S1-09: Define data governance & lineage note (`docs/sota_lineage.md`) listing monthly ETL sources and checksum workflow (planned). (completed: 2025-09-10T12:00:00Z)
- [x] S1-10: Update runbook (`runbook.md`) with SOTA section pointer (no ops procedures yet). (completed: 2025-09-10T12:00:00Z)

### Phase 4 Notes
- Any attempt to implement parsing, embedding retrieval, deterministic/semantic linking, or JSON normalization before Phase 5 will violate scope lock.
- Completion Criterion for Phase 4: All planning artifacts + flags + placeholder tests merged (green CI) with zero runtime logic added.

### PR 38 — CI Checks Tracking (feat: SOTA Parsing Engine Bootstrap (Planning Phase))
- [ ] PR38-01: Temporarily enforce coverage gate at 85/70 to unblock; schedule restoration to 95/70 post-hardening.
- [ ] PR38-02: Resolve axe-core accessibility contrast issues on homepage/review links (WCAG 2.1 AA).
- [ ] PR38-03: Verify typed routes for `/review` and keyboard-focus styles; keep feature-flagged.
- [ ] PR38-04: Monitor all CI jobs and ensure green (lint, typecheck, unit, coverage, security, SBOM, web-a11y-perf, perf-k6, e2e, IaC, audit).
- [ ] PR38-05: Update PR template checklist and attach required artifacts.
- [ ] PR38-06: Add enhancement planning tasks (S1-11..S1-14) and docs tasks (DU-01..DU-06) to this TODO list.

### Epic S1.1 — Enhancements Planning (No Implementation)
- [ ] S1-11: Draft data validation plan (Great Expectations/Pandera) for ETL (ENABLE_SOTA_DATASET_BUILDER).
- [ ] S1-12: Draft knowledge graph plan (Neo4j) mapping Parsed Event JSON → nodes/edges; query exemplars.
- [ ] S1-13: Draft MLOps plan (MLflow or Weights & Biases): experiments, metrics, model registry, drift triggers.
- [ ] S1-14: Draft unified query layer plan (LlamaIndex/LangChain) across Postgres/Milvus/Neo4j; router design.

### Docs To Author/Update (Local + GitHub)
- [ ] DU-01: docs/sota_data_validation.md — data contracts, expectations, CI hooks.
- [ ] DU-02: docs/sota_kg_plan.md — graph schema, ingestion strategy, Cypher query examples.
- [ ] DU-03: docs/sota_mlops.md — experiment tracking, lineage, promotion workflow.
- [ ] DU-04: docs/sota_unified_query.md — routing, retrieval plan, synthesis patterns.
- [ ] DU-05: runbook.md — add MLOps/KG/unified-query ops notes and rollback hooks.
- [ ] DU-06: AGENTS.md/README — reflect new gates/tools, link docs.

### Appendix A — Understanding & Benefits (Summary)
- Automated Data Quality (Great Expectations/Pandera): shifts validation left with explicit data contracts; blocks bad data pre-ingest; produces living docs and stable analytics substrates.
- Knowledge Graph (Neo4j): formalizes rich relations for fast multi-hop queries that are cumbersome in SQL; leverages existing relations schema; unlocks advanced analytics.
- MLOps (MLflow/W&B): reproducible, auditable runs; drift-triggered retraining; model registry for safe promotion/rollback.
- Unified Query Layer (LlamaIndex/LangChain): NL to multi-store queries with routing to Postgres, Milvus, and Neo4j; lowers barrier for analysts; synthesizes coherent answers.

## Phase 5 — SOTA Parsing Engine Implementation

*Scope:* Begin actual implementation of SOTA Parsing Engine components. Enable feature flags gradually, start with dataset builders, then semantic linking, parser integration. Strict TDD, atomic tasks, CI gates. No premature enabling of production traffic.

### Epic I5: Dataset Builders Implementation

- [x] I5-01: Implement geography dataset builder (NDJSON output for State→District→AC→Block→GP→Village hierarchies). (completed: 2025-09-10T12:00:00Z)
- [x] I5-02: Implement festival dataset builder (NDJSON with lunar/solar rules, year_dates resolution). (completed: 2025-09-10T12:00:00Z)
- [x] I5-03: Implement POI dataset builder (NDJSON for temples, venues with lat/lon, OSM integration). (completed: 2025-09-10T12:00:00Z)
- [x] I5-04: Add ETL pipeline skeleton (monthly refresh, checksum validation). (completed: 2025-09-10T12:00:00Z)
- [x] I5-02.1: Implement Chhattisgarh Govt Schemes dataset builder (NDJSON with eligibility, benefits, application process). (completed: 2025-09-10T12:00:00Z) - Added 3 schemes with JSON structure, unit tests, ETL integration
- [x] I5-02.2: Implement Central Govt Schemes dataset builder (NDJSON with eligibility, benefits, application process). (completed: 2025-09-10T12:00:00Z) - Added 4 schemes with JSON structure, unit tests, ETL integration
- [x] I5-05: Wire dataset builders to Postgres dims (fact_event, bridges). (completed: 2025-09-10T12:00:00Z)
- [x] I5-06: Enable ENABLE_SOTA_DATASET_BUILDER flag for testing. (completed: 2025-09-10T12:00:00Z)

### Epic I6: Semantic Linking & Milvus Integration

- [x] I6-01: Implement deterministic linker (exact/alias/phonetic/admin-code matches). (completed: 2025-09-10T12:00:00Z)
- [x] I6-02: Implement semantic linker (Milvus Top-K with embeddings). (completed: 2025-09-10T12:00:00Z)
- [x] I6-03: Add disambiguation logic (hierarchy consistency, geo/PIN proximity). (completed: 2025-09-10T12:00:00Z)
- [x] I6-04: Integrate vector store (kb_embed partitions by type). (completed: 2025-09-10T12:00:00Z)
- [ ] I6-05: Add embedding generation for Hindi-first variants.
- [ ] I6-06: Enable ENABLE_SOTA_POST_PARSER flag for testing.

### Epic I7: Parser & Event JSON

- [ ] I7-01: Implement post preprocessor (language detection, transliteration).
- [ ] I7-02: Implement context inference (what/why/where/when, festival detection).
- [ ] I7-03: Generate normalized Event JSON (schema-compliant with audit).
- [ ] I7-04: Add low-confidence safety notes + review_required logic.
- [ ] I7-05: Wire to /api/sota/parse endpoint (flag-gated).
- [ ] I7-06: Add human-review queue integration.

### Epic I8: Observability & Monitoring Wiring

- [ ] I8-01: Implement metrics emission (accuracy@1/@3, taxonomy_F1, etc.).
- [ ] I8-02: Add trace spans for stages (parse.preprocess, etc.).
- [ ] I8-03: Implement structured logging with trace_id.
- [ ] I8-04: Wire /health extensions for SOTA components.
- [ ] I8-05: Add drift detection (embedding centroid, OOV rate).

### Epic I9: Rollback & Resilience

- [ ] I9-01: Implement flag-based rollbacks (≤10 min).
- [ ] I9-02: Add circuit breakers for Milvus/link failures.
- [ ] I9-03: Implement canary deployment logic.
- [ ] I9-04: Add retry/backoff for external calls.
- [ ] I9-05: Test rollback scenarios in staging.

### Epic I10: SOTA Enhancements Implementation
- [ ] I10-01: Integrate data validation (Great Expectations/Pandera) in ETL; gate via ENABLE_SOTA_DATASET_BUILDER; add CI checks.
- [ ] I10-02: Add Neo4j knowledge graph ingestion from Parsed Event JSON; feature-flag; contract tests with Cypher.
- [ ] I10-03: Wire MLOps (MLflow/W&B): experiment tracking, metrics, model registry; drift-triggered retraining workflow.
- [ ] I10-04: Implement unified query router (LlamaIndex/LangChain) across Postgres, Milvus, Neo4j; e2e tests; p95 ≤ 300ms.
- [ ] I10-05: Extend observability: metrics and /health for KG and query layer; traces across stores.
- [ ] I10-06: Security, privacy, SBOM/license checks for new dependencies.

### Phase 5 Notes
- Enable flags only after green CI + manual review.
- Start with internal testing (1% traffic), ramp to canary.
- All tasks: TDD red→green→refactor, coverage ≥85% lines/70% branches.
- If any gate fails, stop and fix before proceeding.
- Completion: Full pipeline tested E2E, metrics stable, rollback verified.