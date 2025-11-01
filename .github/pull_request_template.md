# Pull Request — Ironclad DevOps Rulebook v2.1

Use this template to enforce atomic scope, TDD-first delivery, and CI policy gates. PRs without all required boxes ticked will not be approved.

## Summary
- Checklist/Ticket ID(s): <!-- e.g., I6-05a, SOTA-2-02 -->
- Scope (single concern): <!-- what exactly changes and why -->
- Type: <!-- feat | fix | chore | docs | refactor | test | ci | perf | a11y | revert -->

## Ironclad Gates (REQUIRED)
- [ ] TDD: failing tests first → minimal code to green → refactor (list test IDs in “Evidence”)
- [ ] Lint + Typecheck pass (CI jobs: lint-type)
- [ ] Coverage gate green (as configured in CI)
  - Lines ≥ 95%, Branches ≥ 70% (enforced by scripts/enforce-coverage.js)
  - Evidence attached (coverage/coverage-summary.json or CI artifact)
- [ ] Security: no secrets; SAST/SCA green; CodeQL analysis completed
- [ ] Privacy: PII minimized; data map updated; delete/export tests added where applicable
- [ ] Accessibility: axe/pa11y show 0 violations (CI job: web-a11y-perf)
- [ ] Performance:
  - Web: Lighthouse CI meets preset (no regressions in key metrics)
  - API: k6 p95 ≤ 300ms (scripts/assert-k6-p95.js)
- [ ] Observability: structured logs, trace IDs, RED/USE metrics; health endpoint present (/api/health or /health)
- [ ] SBOM/Licenses: generated and scanned (sbom.json; license-checker summary)
- [ ] Feature Flags/Delivery Safety:
  - Risky code behind a flag (off by default) OR canaried
  - Rollback strategy ≤ 10 minutes documented (see below)
- [ ] Docs updated: inline code comments + README/CHANGELOG/runbook as needed

## Evidence (attach links, short snippets, or CI artifacts)
- Tests added/updated (by ID): <!-- e.g., tests/sota/embedding-normalizer.test.ts (AC1–AC17) -->
- Coverage summary (lines/branches): <!-- paste key numbers -->
- Lighthouse CI link or summary: <!-- URL or lhci output -->
- axe/pa11y summary: <!-- e.g., Axe: no violations -->
- k6 result: <!-- p95 from k6-summary.json -->
- SBOM & license: <!-- sbom.json; license-checker summary -->
- Security scans: <!-- CodeQL run link; trufflehog result -->

## Risk & Rollback
- Risk level: <!-- low | medium | high and rationale -->
- Rollback plan:
  - Steps: <!-- exact commands or actions -->
  - Flags: <!-- name and default state -->
  - Data/DB: <!-- any reversible migrations; confirm reversibility -->

## Acceptance Mapping (Scope Lock)
- Acceptance checklist IDs → tests → files:
  - <!-- e.g., I6-05a → embedding-normalizer.test.ts → src/sota/embeddings/embeddingNormalizer.ts -->

## Breaking Changes
- [ ] None
- [ ] Yes (describe impact and mitigation): <!-- contracts, API routes, events, DB schemas -->

## Deployment/Runbook Notes
- Migrations: <!-- N/A or steps with rollback -->
- Feature flags: <!-- name(s), default, owner -->
- SLO/Synthetic checks: <!-- updated or added -->
- Post-deploy audits: <!-- vercel post-audits (LHCI/axe) expected results -->

## Reviewer Notes
- How to test locally:
  - npm ci && npm run typecheck && npm test
  - npm run build && npm start
  - Optional: set env flags (e.g., NEXT_PUBLIC_FLAG_HUMAN_REVIEW=on) and verify UI paths

<!--
Guidance:
- Keep PRs atomic (1 concern). Refuse scope drift.
- Do not weaken tests to pass CI.
- Attach links to CI run(s) where applicable.
-->