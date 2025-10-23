# Repository Guidelines

## Project Structure & Module Organization
- `.agent-policy/`: DevOps rules, PRD, and policy-as-code (start here).
- `app/`, `src/`: Next.js app and source modules (to be added per PRD).
- `components/`, `utils/`, `data/`, `config/`: UI, helpers, static JSON, feature flags.
- `tests/`: Unit/integration tests; mirrors `src/` structure.
- `public/`: Static assets (fonts, icons). Use Noto Sans Devanagari.

## Build, Test, and Development Commands
- Setup: Node 18+, `npm ci`.
- Dev server: `npm run dev` (Next.js local).
- Build: `npm run build` (CI artifact).
- Test: `npm test` or `npm test -- --coverage` (Jest + RTL).
- Lint/Format: `npm run lint` / `npm run format` (ESLint/Prettier).
- Deploy: `npm run deploy` (Vercel) when configured.

## Coding Style & Naming Conventions
- TypeScript preferred; 2-space indent; semicolons on.
- Variables/functions: `camelCase`; components/types: `PascalCase`; constants: `SCREAMING_SNAKE_CASE`.
- Files: components `PascalCase.tsx`; helpers `kebab-case.ts`.
- Import paths: `@/` alias for `src/` when enabled.
- Linting: ESLint (Next.js + TS rules); formatting via Prettier (CI-enforced).

## Testing Guidelines
- Frameworks: Jest + React Testing Library; Playwright for e2e.
- Location: `tests/**` (unit/integration), `e2e/**` (smoke/e2e).
- Coverage targets: lines ≥ 95%, branches ≥ 70% (mandatory gate).
- Examples: `npm test -- -t "parse util"`, `npm run test:coverage`.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits. Examples: `feat: add dashboard table`, `fix: handle empty location`, `chore: lint config`.
- PRs: small, atomic scope; link issue/PRD section; include:
  - What/Why, acceptance checklist (tests added, docs updated, coverage met).
  - Screenshots for UI changes; perf/a11y notes if relevant.

## Security & Configuration
- No secrets in repo; use `.env.local` (gitignored). Validate inputs; parameterized queries.
- Feature flags in `config/flags.ts`; default off until canary passes.
- Health: expose `/health` endpoint; add basic metrics logs.
- Budgets: Web LCP ≤ 2.5s; API p95 ≤ 300ms; a11y WCAG 2.1 AA.

## CI Checks (Required)
- `lint-type`: ESLint + `tsc --noEmit`.
- `unit-tests`: Jest runners with JUnit reporter.
- `coverage-gate`: 95% lines, 70% branches via `scripts/enforce-coverage.js`.
- `security`: TruffleHog + CodeQL.
- `licenses-sbom`: CycloneDX SBOM + license-checker.
- `web-a11y-perf`: Build, start, Lighthouse + axe-core.
- `perf-k6`: k6 `/api/health` + `scripts/assert-k6-p95.js` (≤300ms p95).
- `e2e-smoke`: Playwright smoke suite.

## Live CI Monitoring
- Use GitHub CLI to stream workflows: `gh run watch --exit-status`.
- Inspect failures: `gh run list` and `gh run view <id> --log`.
- Reproduce locally (`npm run test:coverage`, `npm run build`, Lighthouse/axe/k6), fix, and push minimal patches until all green. Do not merge with red checks.

## Notes for Agents
- Follow TDD (red→green→refactor) and scope lock from `.agent-policy/devops_agent_policy.yaml`.
- Prefer reversible changes; update docs alongside code.
