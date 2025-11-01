# 🧱 Ironclad Implementation Checklist (v2.1)
**Mode:** TDD-first · Atomic · Secure · Observable · Accessible · Reversible  
**Applies To:** Backend + API + UI + Infra  
**Compliance Baseline:** Ironclad DevOps Rulebook v2.1 — “It Just Works.”

---

## 🔹 Phase 0 — Task Framing (TDD Red Stage)

| Step | Action | Evidence |
|------|---------|----------|
| ✅ 0.1 | Extract acceptance criteria → map to test IDs | Checklist table in PR |
| ✅ 0.2 | Define scope lock (1 concern, ≤4h) | Task.md / commit message |
| ✅ 0.3 | Write failing unit & integration tests | Jest / Pytest output |
| ✅ 0.4 | CI run should fail initially (expected) | Red test logs |

---

## 🔹 Phase 1 — Implementation (Green Stage)

| Step | Action | Tool/Test | Gate |
|------|---------|-----------|------|
| ✅ 1.1 | Implement minimal logic to pass tests | Jest/pytest | Unit test |
| ✅ 1.2 | No global edits; only local scope | Diff check | CI linter |
| ✅ 1.3 | Secure I/O — param queries, validate inputs | ESLint / Bandit | Security |
| ✅ 1.4 | Implement structured logs, trace IDs | Winston / Pino / OpenTelemetry | Observability |
| ✅ 1.5 | Add `/health` and synthetic ping endpoint | curl + k6 | Liveness |

---

## 🔹 Phase 2 — Refactor (Refactor Stage)

| Step | Action | Check |
|------|---------|-------|
| ✅ 2.1 | Refactor for clarity, DRY, abstraction | Code diff |
| ✅ 2.2 | Run lint & typecheck | `npm run lint:typecheck` |
| ✅ 2.3 | Re-run tests (should pass all) | ✅ Green |
| ✅ 2.4 | Review error handling & retries | Chaos test |
| ✅ 2.5 | Apply accessibility, performance, and audit checks | axe / Lighthouse / k6 / audit JSON |

---

## 🔹 Phase 3 — CI/CD Validation

| Step | Job | Command | Criteria |
|------|------|----------|----------|
| ✅ 3.1 | Lint / Type | `npm run lint && npm run typecheck` | No warnings |
| ✅ 3.2 | Unit & Integration | `npm test --ci` | 100% passing |
| ✅ 3.3 | Coverage | `npm run test:coverage` | ≥85% lines / ≥70% branches |
| ✅ 3.4 | Security | `trufflehog`, `CodeQL` | No secrets, SAST/DAST pass |
| ✅ 3.5 | SBOM & License | `cyclonedx-npm`, `license-checker` | No high/CVE or license violation |
| ✅ 3.6 | Perf | `k6 run perf/api-smoke.js` | p95 ≤ 300ms |
| ✅ 3.7 | A11y | `npx @axe-core/cli` | 0 violations |
| ✅ 3.8 | Observability | `/health`, logs/traces | Metrics OK |
| ✅ 3.9 | Release Safety | Feature flags + rollback plan | Canary ready |

---

## 🔹 Phase 4 — Security & Resilience

| Area | Checklist | Required Proof |
|-------|------------|----------------|
| 🔒 Security | No secrets; param queries; AuthZ | trufflehog/CodeQL logs |
| 🧩 Privacy | Data map; delete/export tests | GDPR/DPDP proof |
| 🧠 Reliability | Error handling, retries, backoff | Unit tests / chaos test |
| 🧱 Scalability | Stateless design; DB pool singleton | Load test metrics |
| 🚀 Performance | Budgets met (Web/API/Mobile) | Lighthouse/k6 report |
| ♿ Accessibility | WCAG 2.1 AA compliant | axe/pa11y report |

---

## 🔹 Phase 5 — Audit & Documentation

| Step | Artifact | Evidence |
|------|-----------|-----------|
| ✅ 5.1 | Audit JSON (CI artifact) | includes commit, run id, test stats |
| ✅ 5.2 | Update README & CHANGELOG | diff |
| ✅ 5.3 | Add/Update Runbook | rollback steps ≤10 min |
| ✅ 5.4 | Add Feature Flag Doc | `feature_flags.md` |
| ✅ 5.5 | PR Template completed | `.github/pull_request_template.md` |

---

## 🔹 Phase 6 — Regression & Monitoring

| Test Type | Tool | Success Criteria |
|------------|------|------------------|
| Unit / Integration | Jest / Pytest | Green |
| Perf | k6 | p95 ≤ 300ms |
| A11y | axe / pa11y | 0 issues |
| Smoke | Playwright / Cypress | Pass |
| Health | curl / uptime monitor | OK |
| CI | GitHub Actions | ✅ all jobs green |
| Observability | Grafana / BetterStack | Metrics within SLO |

---

## 🔹 Phase 7 — Final Verification Before Merge

| Gate | Check |
|------|-------|
| ✅ Coverage ≥85/70 | Pass |
| ✅ Perf budgets | Pass |
| ✅ A11y (WCAG 2.1 AA) | Pass |
| ✅ Security scans (SAST/DAST/SCA) | Pass |
| ✅ SBOM / License | Generated |
| ✅ Canary & Rollback Plan | Documented |
| ✅ Docs Updated | README / CHANGELOG |
| ✅ Runbook Updated | Recovery ≤10 min |

---

## ✅ Done When
- All **green CI gates** ✅  
- Audit log exists 🧾  
- Rollback tested ⏪  
- Docs + Runbook updated 📖  
- Commit message follows **Conventional Commits** (e.g. `fix(db): reuse pgPool via globalThis singleton`)  

---

### 📘 Notes
- Follow TDD: **Red → Green → Refactor** per atomic task.  
- Each subtask must pass all gates independently.  
- CI/CD is the single source of truth — local green ≠ done.  
