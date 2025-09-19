# Project Dhruv Runbook

## Deploy & Rollback
- Deploy: Merge to `main` triggers Vercel Production (via Vercel GitHub App). CLI deploy workflow is skipped on PRs and non-main pushes.
- Preview: PRs auto-deploy to Vercel Preview (see "Vercel" check on PR for URL).
- Rollback: `vercel rollback <deployment-url-or-id>` restores last good build. Target the Production deployment for fast rollback (< 10 min).

## Feature Flags
- `FLAG_PARSE`: Controls parsing pipeline.
  - Production default: OFF (enable via Vercel env)
  - Dev/Test default: ON (set `FLAG_PARSE=off` to disable)
- Change flags in Vercel Project → Settings → Environment Variables.

## Health & Monitoring
- API: `/api/health` returns `{status:'ok', traceId}`.
- Synthetic checks via CI: k6 (p95 <= 300ms), Lighthouse (perf), axe (a11y).

## CI Quality Gates
- Coverage: lines >= 95%, branches >= 70%.
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

