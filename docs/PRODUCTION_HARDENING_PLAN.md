# Production Hardening Plan – Project Dhruv

> Last updated: `2025-11-08`

This document tracks the outstanding work required to ship the public analytics dashboard with hardened admin routes, reliable data primitives, and a clear path to retire legacy experiments after GA.

---

## 1. Route/Auth Enforcement

| Item | Owner | Status |
| --- | --- | --- |
| Server-side auth guards (`getAdminSession`) for `/home`, `/review`, `/commandview` | ✅ | Live |
| Middleware to short-circuit unauthenticated hits (optional hardening) | ✅ | ✅ |
| Admin login UX: error surfacing + logout flow | Unassigned | ☐ |
| Session storage secret rotation checklist for prod | DevOps | ☐ |

**Notes**
- Current guard redirects unauthenticated users to `/analytics` from the page server components.
- Add middleware after we validate `crypto` usage in the Edge runtime or degrade to cookie existence check.

---

## 2. Review & Learning Pipeline

| Item | Description | Status |
| --- | --- | --- |
| `/api/review/update` endpoint | Validates Hindi payloads, persists to `parsed_events`, returns Hindi responses | ✅ |
| Review UI → API wiring | All Save/Approve/Reject/Skip actions call the new endpoint | ✅ |
| Queue metrics CLI for external alerts (`npm run ops:commandview`) | Prints severity + recent reviews for cron/slack hooks (exits 1 on `alert`) | ✅ |
| Reviewer audit log streaming (Papertrail/Splunk) | Pipe console logs to centralized log store | ☐ |
| Dynamic learning re-enable toggle | Flip flag once telemetry proves stable | ☐ |

**Verification commands**
```bash
npm run test -- --runTestsByPath tests/api/review/update.test.ts
```

---

## 3. Observability & System Health

| Item | Status |
| --- | --- |
| `/api/system/health` refactor (shared helper + tests) | ✅ |
| `/api/health` lightweight summary | ✅ |
| CommandView wiring to show health cards | ✅ (component renders when admin) |
| Add recent review action feed + queue stats to CommandView | ☐ |
| Hook health endpoints into external monitors (Grafana Cloud/BetterStack) | ☐ |

---

## 4. Analytics/Data Integrity

| Item | Status |
| --- | --- |
| `/api/analytics` gating to reviewed events only | ✅ |
| CSV/Excel/PDF exports sharing live payload | ✅ |
| Dashboard modules consume real metrics (Recharts) | ✅ |
| End-to-end data drill (fetch → parse → review → analytics) on prod DB | 🟡 In progress (fetch+parse done, review UI pending) |
| Coverage of Raigarh dataset freshness (cron alert) | ☐ |

**Planned validation run**
1. `python scripts/fetch_tweets.py --handle opchoudhary --resume`
2. `node scripts/parse_tweets_with_three_layer.js`
3. Review/approve a sample batch through `/review`
4. Hit `/api/analytics` + `/api/analytics/export?format=csv` and snapshot results

---

## 5. CI / Quality Gates

| Job | Action |
| --- | --- |
| `lint-type` | ✅ Guard re-enabled in `ironclad.yml`; keep lint clean locally before pushing |
| `unit-tests` | ✅ Jest suite gate re-enabled; watch for flaky tests |
| `coverage-gate` | Revisit `scripts/enforce-coverage.js` thresholds once suites restored |
| `security` | Re-enable TruffleHog + CodeQL (no new secrets introduced) |
| `web-a11y-perf`, `perf-k6`, `e2e-smoke` | Verify local runners succeed before toggling |

Until CI is fully green, we **must not** merge into `main`.

---

## 6. Legacy Code Isolation Plan

Goal: keep the production branch lean by freezing experimentation folders once GA ships.

- **Keep (production path)**: `src/app`, `src/components`, `src/lib`, `scripts/*fetch*/parse*`, `infra/`, `docs/PRODUCTION_HARDENING_PLAN.md`, `tests/`.
- **Archive after GA** (move to `archive/legacy-YYYYMMDD`): `BrAins 🧠/`, `data/parsed_tweets.json`, `archive/` experiments, unused worktrees (mindmap, geo, pipeline fix once merged).
- **Process**
  1. Tag the release branch (`release/ga-<date>`).
  2. Copy legacy folders to `archive/ga-legacy/` **without** deleting git history.
  3. Update README with new architecture diagram + link to archive doc.
  4. Remove stale `pages/api/*` routes once App Router equivalents confirmed stable.

---

## 7. Immediate Next Actions (ordered)
1. Add Next.js middleware to enforce cookie presence on restricted routes (defense in depth).
2. Flesh out CommandView with queue/backlog metrics + last review actions, consuming `/api/review/update` logs.
3. Re-enable the `lint-type` and `unit-tests` jobs in `ironclad.yml` after fixing outstanding warnings.
4. Schedule/execute the end-to-end data drill and document results in `DASHBOARD_LIVE_SUMMARY.md`.
5. Wire `npm run ops:commandview` into Slack/email alerts (BetterStack, Grafana, etc.); remember `severity=alert` exits with code 1 for paging.
6. Prepare the archive script (simple `npm run archive-legacy` leveraging `mv` commands) so we can cut over immediately after GA.

--- 

Maintaining this checklist ensures everyone sees the live status. Update it with each PR that touches the production surface.***
