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