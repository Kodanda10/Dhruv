# Product Requirements Document (PRD) for Project Dhruv: Functional Dashboard for OP Choudhary X Activity Analysis

## Overview
This PRD outlines the requirements and build process for a basic functional dashboard analyzing OP Choudhary's X (formerly Twitter) posts from September 1–6, 2025. The dashboard will process the dataset into a structured view, extracting and displaying details such as when (timestamp in Hindi format), where (locations extracted from post content, in Devanagari script), what (activities/events), which (entities like people or events), and how (context from text). All content will be rendered in Hindi (Devanagari script) using Noto Sans Devanagari font (selected as Google's native multilingual font supporting Hindi, aligned with Pixel phone's system UI preferences for sans-serif fonts like Google Sans Text, but optimized for Devanagari). The core engine will execute data processing verbatim as per prior discussions, with no fancy UI—focusing on a simple table and metrics summary.

The build adheres strictly to Ironclad DevOps Rulebook v2.1 (imported from `/Users/abhijita/Projects/Project_Dhruv/.agent-policy/ironclad-bootstrap.mdc`). This enforces atomic tasks (1–4 hours each, one concern per task/PR), TDD (red-green-refactor), scope lock (only checklist items), shift-left security/privacy/accessibility/performance/observability, CI gates, reversible changes, and documentation. Tasks are decomposed into ~150 atomic units, with TDD for each. From Task 1, deploy to Vercel for live simulation/verification. Use Next.js for the app (Vercel-compatible, React-based for web dashboard). Hardcode the fetched dataset (48 posts) for initial engine; future tasks can add dynamic fetch if scoped.

## Metadata
- **Project Name**: Project Dhruv
- **Root Directory**: `/Users/abhijita/Projects/Project_Dhruv`
- **Owners**: Engineering team, with policy owners from Ironclad (`eng@company`, `sec@company`, `sre@company`)
- **Applies To**: Web (Next.js/React)
- **Branching**: Trunk-based; short-lived feature branches per task
- **Environments**: Dev (local), Staging/Prod (Vercel)
- **Font**: Noto Sans Devanagari (import via Google Fonts CDN for Hindi support)
- **Data Source**: Hardcoded JSON from fetched posts (Sept 1–6, 2025); parse in Hindi
- **Acceptance Criteria** (per Ironclad):
  - Tests added: true
  - Coverage: lines >=95%, branches >=70% (mandatory gate)
  - Docs updated: true
  - A11y pass: true (WCAG 2.1 AA via semantic HTML)
  - Perf within budget: LCP <=2.5s (Lighthouse), API p95 <=300ms (k6)
  - Security scans green: No secrets, input validation
  - Feature flagged: Risky changes (e.g., data parsing) behind flags
  - Health check: /health endpoint
- **Exemptions**: None; all tasks follow rules

## Acceptance Checklist (Scope Lock)
Derived from user brief; implement ONLY these:
1. Bootstrap repo with Ironclad files (policy, prompts, CI, scripts, PR template, README).
2. Initialize basic Next.js app.
3. Hardcode dataset in JSON (48 posts, in Hindi).
4. Parse data for when/where/what/which/how (NLP-like extraction in code, output in Devanagari).
5. Render simple table and metrics in Hindi.
6. Use Noto Sans Devanagari font.
7. TDD each atomic task; deploy to Vercel after each for simulation.
8. Update docs/runbook per task.
9. Ensure reversibility (flags for changes).

**Trace Table**:
- Criterion 1 -> Tests: bootstrap.test.js -> Files: all Ironclad files
- Criterion 2 -> Tests: app-init.test.js -> Files: package.json, app/
- Criterion 3 -> Tests: data-hardcode.test.js -> Files: data.json
- Criterion 4 -> Tests: parse.test.js -> Files: utils/parse.js
- Criterion 5 -> Tests: render.test.js -> Files: components/Dashboard.js
- Criterion 6 -> Tests: font.test.js (CSS check) -> Files: globals.css
- Criterion 7 -> Tests: per-task TDD files -> Files: tests/
- Criterion 8 -> Tests: docs.test.js (existence) -> Files: README.md, runbook.md
- Criterion 9 -> Tests: flag.test.js -> Files: config/flags.js

## Execution: Atomic Tasks (Brick-by-Brick, TDD-First)
Each task: 1–4h, one concern. Execution loop: Checklist emit -> Failing tests -> Minimal code -> Refactor/self-review (security/a11y/perf/obs) -> Artifacts (diffs, reports) -> CI await (local sim + Vercel deploy) -> PR summary. Use Conventional Commits. Deploy to Vercel after each task for live verification (URL: project-dhruv.vercel.app). Tools: Jest for TDD, Lighthouse/axe for gates, npm scripts for CI sim.

1. **Task 1: Create project directory**  
   - **Red**: Test fails if dir missing.  
   - **Green**: `mkdir /Users/abhijita/Projects/Project_Dhruv && cd $_`  
   - **Refactor**: N/A.  
   - **Artifacts**: Dir existence. Deploy: N/A (pre-app). PR: feat: init project dir.

2. **Task 2: Run Ironclad bootstrap script**  
   - **Red**: Test fails if policy files missing.  
   - **Green**: Copy ironclad-bootstrap.mdc to dir, execute shell commands verbatim (cd to .agent-policy, mkdirs, cat > files).  
   - **Refactor**: Verify file contents match mdc.  
   - **Artifacts**: Generated files (devops_agent_policy.yaml, .cursorrules, etc.). Deploy: N/A. PR: feat: apply ironclad bootstrap.

3. **Task 3: Create PR for bootstrap changes**  
   - **Red**: Test fails if no branch/PR.  
   - **Green**: git init, add files, commit, branch feature/bootstrap, push, create PR with template (checklist ticked).  
   - **Refactor**: Self-review for scope.  
   - **Artifacts**: PR link. Deploy: N/A. PR: chore: bootstrap PR.

4. **Task 4: Initialize Next.js app**  
   - **Red**: Test fails if no Next.js structure.  
   - **Green**: npx create-next-app@latest . --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"  
   - **Refactor**: Remove boilerplate pages.  
   - **Artifacts**: package.json, app/. Deploy: vercel --prod. PR: feat: init nextjs.

5. **Task 5: Add Vercel deployment script**  
   - **Red**: Test fails on deploy command.  
   - **Green**: Add npm script "deploy": "vercel --prod".  
   - **Refactor**: Add .vercelignore.  
   - **Artifacts**: Script run output. Deploy: Run deploy. PR: chore: add deploy script.

6. **Task 6: Add health endpoint (/health)**  
   - **Red**: Test fails on GET /health (404).  
   - **Green**: Create app/api/health/route.ts returning {status: 'ok'}.  
   - **Refactor**: Add trace ID in response.  
   - **Artifacts**: Curl test. Deploy: Verify live. PR: feat: health check.

7. **Task 7: Import Noto Sans Devanagari font**  
   - **Red**: Test fails if font not loaded (CSS check).  
   - **Green**: Add @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari&display=swap'); to globals.css, set body { font-family: 'Noto Sans Devanagari', sans-serif; }.  
   - **Refactor**: Fallback to sans-serif.  
   - **Artifacts**: CSS diff. Deploy: Verify Hindi text renders. PR: style: add font.

8. **Task 8: Hardcode dataset as JSON**  
   - **Red**: Test fails if data.json missing/invalid.  
   - **Green**: Create data.json with array of 48 posts (verbatims from fetch: id, timestamp, content in Hindi, media, etc.).  
   - **Refactor**: Validate JSON schema.  
   - **Artifacts**: File existence. Deploy: N/A. PR: data: add hardcoded posts.

9. **Task 9: Create parse utility function**  
   - **Red**: Test fails on parse(post) (empty output).  
   - **Green**: utils/parse.ts: Function to extract when (date to Hindi: e.g., "05 सितंबर 2025"), where (regex for places like "रायगढ़", "दिल्ली"), what (action keywords: "सम्मिलित", "भूमिपूजन"), which (entities: @mentions, #hashtags), how (content summary in Hindi). Use simple string methods/regex. Output object in Devanagari.  
   - **Refactor**: Handle edge cases (no location).  
   - **Artifacts**: Parse output sample. Deploy: N/A. PR: feat: data parse util.

10–50: [Similar atomic tasks for parsing sub-parts, e.g., Task 10: Parse 'when' only, TDD, deploy.]

51. **Task 51: Create Dashboard component**  
   - **Red**: Test fails on render (no table).  
   - **Green**: components/Dashboard.tsx: Simple <table> with headers in Hindi ("कब", "कहाँ", "क्या", etc.), map parsed data to rows.  
   - **Refactor**: Add aria-labels for a11y.  
   - **Artifacts**: Component code. Deploy: Verify table shows. PR: ui: add table.

52–100: [Atomic for each column: Task 52: Add 'when' column, TDD; Task 53: Add 'where' column, etc.]

101. **Task 101: Add metrics summary**  
   - **Red**: Test fails on counts.  
   - **Green**: Compute frequencies (e.g., most locations: "रायगढ़" - 10 बार), render as <ul> in Hindi.  
   - **Refactor**: Memoize for perf.  
   - **Artifacts**: Metrics output. Deploy: Verify. PR: feat: add metrics.

102–140: [Atomic for insights: e.g., Task 102: Count locations, TDD.]

141. **Task 141: Feature flag for parsing**  
   - **Red**: Test fails if no flag check.  
   - **Green**: Use process.env.FLAG_PARSE = 'on'; if off, show placeholder.  
   - **Refactor**: Add rollback doc.  
   - **Artifacts**: Flag config. Deploy: Verify toggle. PR: chore: add flag.

142–150: [Final tasks: Full CI setup per ironclad.yml, coverage enforcement, perf gates, security scans, SBOM, docs updates.]

## Reports & Artifacts
- **Coverage**: Run `jest --coverage`; enforce 95/70 via `scripts/enforce-coverage.js`.
- **A11y**: axe on deployed URL.
- **Perf**: Lighthouse (LCP <=2.5s) + k6 p95 <=300ms via `scripts/assert-k6-p95.js`.
- **Security**: Trufflehog scan.
- **SBOM**: cyclonedx-npm.
- **Docs**: Update README with quick start, runbook with rollback (e.g., vercel rollback).

## Mandatory GitHub Checks (Ironclad)
- lint-type, unit-tests, coverage-gate (95/70), security (TruffleHog, CodeQL), licenses-sbom (SBOM + license-checker), web-a11y-perf (Lighthouse + axe), perf-k6 (API p95), e2e-smoke (Playwright), iac-validate (Vercel), audit-trail (artifact JSON).

## Phase 2: Smart Dataset Creation (Backend Parsing Module)
Planned initiative to enhance parsing and enrichment for X posts via a Python/Flask module while retaining the Next.js frontend.

- Architecture: Python/Flask API at `api/`, parsing module in `api/src/parsing/`, unit tests in `api/tests/unit/test_parsing/`. Internal dataset at `api/data/internal_dataset.csv`.
- Dependencies (fixed): pandas, indic-nlp-library, requests, Flask, python-dotenv (via `api/requirements.txt`). No new packages.
- Feature Flags: External enrichment behind `FLAG_WEB_ENRICH` (checked via `config.is_flag_enabled('FLAG_WEB_ENRICH')`).

Epics (High-Level)
1) Initial Direct Parsing (mentions, hashtags, Devanagari entities)
2) Internal Dataset Reverse Search (CSV lookup + enrichment fields)
3) External Web Enrichment (flag-gated; mock search API via requests)
4) Dataset Update (append consolidated enriched records)
5) Error Handling & Observability (structured logging + trace IDs)
6) API Wiring + CI (Flask endpoints, 95/70 coverage)

Execution Rules
- Atomicity (1–4h tasks), TDD (red→green→refactor), scope lock to spec above, coverage 95/70, reversible via feature flags.

Parsing Logic Enhancement Outline (Acceptance Checklist)
- Layer 1: Direct parse mentions, hashtags, and potential Devanagari entities (indic tokenizer).
- Layer 2: Reverse-search internal dataset (case-insensitive) to enrich entity_id/type/context.
- Layer 3: External web search enrichment (requests) behind `FLAG_WEB_ENRICH`; parse mock response to short description.
- Layer 4: Build enriched records (DataFrame/list) consolidating info; tag web-enriched as `unverified`.
- Layer 5: Robust error handling (file/network/parse) and structured logs with trace IDs.

Constraints
- No new Python packages beyond requirements. Use `re`, `pandas`, `indic-nlp-library`, `requests`, `Flask`.
- Feature flags for risky changes; rollback ≤10 min. All changes documented (inline + runbook).

### Phase 2 — Sprint 1 (Now)
Scope: bootstrap backend API + normalization baseline + alias store/loader and minimal /api/normalize contract. No UI dependency changes beyond feature flag wiring.

Deliverables (all TDD, 95/70):
- api/ Flask app with `/api/health`, `/api/normalize` (stub), `/api/aliases` (GET), `/api/aliases/reload` (POST, gated).
- Normalization core: nukta folding, Devanagari→Latin transliteration, Hinglish phonetics, schwa handling, dedupe. Unit + perf (sanity) tests.
- Alias store: `api/data/aliases.json` (seed for locations/tags/schemes/events) + loader with variant→canonical index; hot reload.
- Structured logs with `traceId`, counters for alias hits/misses.
- Runbook additions (flags, reload, rollback). 

Acceptance:
- p95 `/api/health` ≤ 300ms (local/k6).
- `/api/normalize` echoes minimal enrichment with lineage fields.
- Flags: `FLAG_ALIAS_LOADER`, `FLAG_PARSE_ENGINE` respected.

## Risk & Rollback
- **Risk**: Low (static data, basic UI).
- **Rollback**: Vercel rollback to previous deploy (<=10 min); flags off for features.

This PRD ensures production-ready delivery via Ironclad principles. Proceed task-by-task.
