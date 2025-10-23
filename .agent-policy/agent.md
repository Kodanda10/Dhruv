# Agent Operating Rules

## Live CI Monitoring (Mandatory)
- Always live-monitor GitHub Actions for every PR/commit until all checks are green.
- Use GitHub CLI to stream logs in terminal:
  - `gh run watch --exit-status` (live stream, exits non‑zero on failure)
  - `gh run list --limit 5` (recent runs) and `gh run view <id> --log` (full logs)
- On failure (red):
  - Reproduce locally (e.g., `npm run test:coverage`, `npm run build`, `npx @lhci/cli autorun`, `npx @axe-core/cli http://localhost:3000`).
  - Fix only the failing scope; update/extend tests; rerun locally.
  - Push minimal patch; continue monitoring until green.
- Do not merge unless all required checks are green (see Ironclad workflow).

## Scope, TDD, and Reversibility
- Follow PRD scope lock. Write failing tests first; implement minimal code; refactor.
- Use flags for risky changes; keep changes reversible.

## Security & Privacy
- No secrets in repo. Run TruffleHog locally before push if available: `npx trufflehog filesystem .`.

## Observability
- Ensure `/api/health` remains green; include traceId. Prefer structured logs in JSON.

## Helper
- If `gh` is unavailable, use the GitHub Actions UI and link logs in PR comments.
