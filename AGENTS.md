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

## UI Component Development & Demo

### GlassSectionCard Demo Implementation
**Status**: Active demonstration environment
**Location**: `/tmp/project-dhruv-glass-demo` (isolated worktree)
**Demo URL**: `http://localhost:3000/demo-glass`

#### Demo Features
- Glassmorphic styling with backdrop blur effects
- Hover interactions and smooth transitions
- Multiple content types: text, analytics, forms, notifications
- Responsive design validation
- Performance testing environment

#### Development Approach
- **Isolated Worktree**: Zero impact on main codebase
- **Comprehensive Showcase**: Multiple use cases demonstrated
- **Clean Separation**: Easy removal after demonstration
- **Visual Testing**: Immediate feedback on component appearance

#### Implementation Details
```typescript
// Component: GlassSectionCard
- Semi-transparent background (rgba(255, 255, 255, 0.1))
- Linear gradient overlays for depth
- 24px backdrop blur effect
- Smooth hover transitions
- Flexible content support
```

#### Demo Content Structure
1. Basic text content demonstration
2. Dashboard analytics with metrics
3. Interactive elements (buttons, forms)
4. Data visualization mockups
5. Notification and alert systems
6. Large content areas with prose

### Worktree Demo Workflow
```bash
# Create isolated demo environment
git worktree add --detach /tmp/component-demo HEAD

# Develop and showcase
cd /tmp/component-demo && npm install && npm run dev

# Access demo and verify functionality
# Cleanup when done
git worktree remove /tmp/component-demo
```

## Live CI Monitoring
- Use GitHub CLI to stream workflows: `gh run watch --exit-status`.
- Inspect failures: `gh run list` and `gh run view <id> --log`.
- Reproduce locally (`npm run test:coverage`, `npm run build`, Lighthouse/axe/k6), fix, and push minimal patches until all green. Do not merge with red checks.

## Notes for Agents
- Follow TDD (red→green→refactor) and scope lock from `.agent-policy/devops_agent_policy.yaml`.
- Prefer reversible changes; update docs alongside code.

[byterover-mcp]

[byterover-mcp]

You are given two tools from Byterover MCP server, including
## 1. `byterover-store-knowledge`
You `MUST` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation

## 2. `byterover-retrieve-knowledge`
You `MUST` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase
