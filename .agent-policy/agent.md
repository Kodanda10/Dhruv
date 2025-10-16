### Prompt for Generating Atomic Tasks to Implement Parsing Logic Enhancement Outline for Smart Dataset Creation

You are a DevOps Agent operating under the Ironclad DevOps Rulebook v2.1, tasked with implementing the "Parsing Logic Enhancement Outline for Smart Dataset Creation" in Project Dhruv. This outline describes a multi-layered parsing approach for X posts, including direct extraction, internal dataset reverse search, external web search for contextual enrichment, dataset update, and error handling. Your goal is to break this implementation into approximately 50-100 atomic tasks, each sized for 1-4 hours, focusing on one concern per task. Do not implement beyond scope. Use examples from actual OP Choudhary tweets fetched (e.g., "#GSTReforms" for hashtag extraction, "रायगढ़" for location entities, "महतारी वंदन योजना" for scheme themes in "क्या").

Sprint‑1 Scope (binding):
- Bootstrap Flask API at `api/` with `/api/health`, `/api/normalize`, `/api/aliases`, `/api/aliases/reload`.
- Normalization core (nukta folding; Devanagari→Latin; Hinglish phonetics; schwa handling; dedupe) with unit tests.
- Alias store `api/data/aliases.json` with loader + hot reload; counters + logs with `traceId`.
- Feature flags: `FLAG_ALIAS_LOADER`, `FLAG_PARSE_ENGINE`, `FLAG_SEMANTIC` (default off).
- TDD, coverage 95/70, p95 `/api/health` ≤ 300ms.

Keep the output in a diff-like format with + for added lines, sections like Epics and Atomic Tasks (e.g., Epic E1 with tasks DP-01, etc.). Architecture: Retain Next.js frontend; add Python/Flask API at `api/`, parsing module in `api/src/parsing/`, unit tests in `api/tests/unit/test_parsing/`. Internal dataset at `api/data/internal_dataset.csv`. Dependencies (fixed): pandas, indic-nlp-library, requests, Flask, python-dotenv (via `api/requirements.txt`). Feature Flags: External enrichment behind `FLAG_WEB_ENRICH` (checked via `config.is_flag_enabled('FLAG_WEB_ENRICH')`).

Adhere strictly to the following constraints:
- **Data Variant Discipline:** All parsing data, vector data, graph data, scraped data, and fetched data saved into datasets must be stored in four variants at all times: Hindi, Nukta-Hindi, English, and Transliteration. Pipelines must deterministically generate any missing variants, and validations must assert presence of all four variants before data is accepted.
- **Scope Lock**: Extract an acceptance checklist from the outline. Implement only items in the checklist. Refuse any drift or additions.
- **Atomicity**: Each task must address a single, local change (e.g., one function, one test, one file modification). No bundling of concerns.
- **TDD Cycle**: For each task, follow red-green-refactor: Write failing tests first (unit/integration/acceptance), implement minimal code to pass, then refactor for security, accessibility, performance, and observability. Coverage targets: lines >= 95%, branches >= 70%.
- **CI Gates**: Assume tasks will be validated via lint, typecheck, unit tests (95% line coverage), security scans (e.g., TruffleHog), performance budgets (LCP <= 2.5s via Lighthouse), accessibility (WCAG 2.1 AA via axe-core), and SBOM/license checks.
- **Tools and Dependencies**: Use Python (e.g., re for regex, indic-nlp-library for Hindi tokenization, pandas for dataset handling). Integrate web search tools for enrichment. No new package installations; rely on available environments.
- **Reversibility**: Guard risky changes (e.g., web search integration) with feature flags (e.g., env.FLAG_WEB_ENRICH = 'on'). Include rollback steps (<=10 min).
- **Documentation**: Update inline docs, README, and runbook per task.
- **Execution Loop per Task**: 
  1. Emit checklist mapping (criterion -> tests -> files).
  2. Write failing tests.
  3. Implement minimal code.
  4. Refactor and self-critique.
  5. Produce artifacts (diffs, reports: e.g., coverage %, Lighthouse/axe results).
  6. Await CI (simulate locally, deploy to Vercel for verification).
- **Output Format**: For each atomic task, provide:
  - Task ID and Title.
  - Acceptance Criteria: Brief description.
  - Test Plan (Red): Failing test description.
  - Implementation Plan (Green): Minimal implementation steps/code snippet.
  - Refinement Scope (Refactor): Improvements (e.g., error handling).
  - Deliverables: New/updated files; minimal code + passing test.

Generate the full list of atomic tasks based on the outline sections: Initial Direct Parsing, Internal Dataset Reverse Search, External Web Search, Dataset Update, and Error Handling. Ensure tasks are sequenced logically (e.g., base parsing before enrichment). Prioritize Hindi/Devanagari support in parsing logic. If `gh` is unavailable, use the GitHub Actions UI and link logs in PR comments. Include post-deploy audits via Vercel (Lighthouse for perf, axe-core for a11y).
Import: /Users/abhijita/Projects/Project_Dhruv/.agent-policy/ironclad-bootstrap.mdc (repo path: `.agent-policy/ironclad-bootstrap.mdc`). All Ironclad DevOps Rulebook v2.1 policies in this file are binding and supersede where applicable. No deviation is permitted; enforce CI gates, TDD, coverage, and documentation per policy.
Ironclad Bootstrap (v2.1) — Binding Excerpt
- Principles: Scope lock; 1–4h atomic tasks; TDD (red→green→refactor); shift‑left security/privacy; WCAG 2.1 AA; performance budgets (Web LCP ≤ 2.5s, API p95 ≤ 300ms); observability (/health, logs, metrics); progressive delivery (flags/canary, ≤10 min rollback); SBOM/licensing; IaC policy.
- Mandatory CI: lint, typecheck, unit + integration + e2e, coverage gate, security (secrets/CodeQL), a11y (axe), perf (Lighthouse/k6), SBOM/license, IaC, audit artifact.
- Guardrails: No secrets; consistent naming; docs required; reversible by feature flags; reject PRs that exceed scope or violate gates.
