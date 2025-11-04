<!-- 1d37191c-5315-40f8-b1d1-13b6bde944fe 01a0122f-0515-4fea-af99-aa5dd533c5b1 -->
# Production Deployment - Complete Pipeline Integration

## TDD & DevOps Policy Compliance: Ironclad v2.1

**Mandatory for ALL phases:**

- **TDD Red→Green→Refactor**: Write failing tests first, minimal code to pass, then refactor
- **Coverage Thresholds**: Lines ≥85%, Branches ≥70% (enforced by CI via `scripts/enforce-coverage.js`)
- **CI Gates** (from `.github/workflows/ironclad.yml`): lint-type, unit-tests, coverage-gate, security, licenses-sbom, web-a11y-perf, perf-k6, e2e-smoke
- **Security**: No secrets, parameterized queries, input/output validation, AuthN/AuthZ, CSP/SSRF guards
- **Performance**: Web LCP ≤2.5s, CLS ≤0.1 (p75), API p95 ≤300ms (enforced by k6)
- **Accessibility**: WCAG 2.1 AA, zero violations (enforced by axe-core)
- **Observability**: Structured logs, trace IDs, RED/USE metrics, `/health` endpoints
- **Atomic Tasks**: 1-4 hours each, one concern per PR, no bundling
- **Scope Lock**: Extract acceptance checklist, implement ONLY listed items
- **Test Coverage**: Unit + Integration + E2E for all features

---

## Phase 1: PR Resolution & CI Fixes (49-58) - TDD First

### 1.1 Analyze PR Status (TDD Approach)

**Acceptance Criteria:**

- [ ] AC1.1: Document all failing CI checks for PRs 49-58 (exclude 32,46,47)
- [ ] AC1.2: Identify test failures and coverage gaps
- [ ] AC1.3: Map each failing check to specific files/tests

**TDD Steps:**

1. **Red**: Create `tests/pr-resolution/pr-status.test.ts`
2. **Green**: Implement `scripts/analyze-pr-status.ts` to pass tests
3. **Refactor**: Improve error handling, add logging

**Files:**

- `scripts/analyze-pr-status.ts` (new)
- `tests/pr-resolution/pr-status.test.ts` (new)

### 1.2 CI Failure Classifier & Traceability (TDD)

**Acceptance Criteria:**

- [ ] AC1.4: CI failure classifier auto-tags failure types (lint/tests/coverage)
- [ ] AC1.5: PR-to-test mapping matrix generated in `/docs/traceability.md`
- [ ] AC1.6: Traceability matrix updated after each PR merge

**TDD Steps:**

1. **Red**: Create `tests/ci-fixes/failure-classifier.test.ts`
   ```typescript
   describe('CI Failure Classifier', () => {
     it('should tag lint failures correctly', async () => {
       // Failing test
     });
     it('should tag test failures correctly', async () => {
       // Failing test
     });
     it('should tag coverage failures correctly', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement `scripts/classify-ci-failures.ts`
3. **Refactor**: Add pattern matching, improve accuracy

**Files to create:**

- `scripts/classify-ci-failures.ts` (new)
- `scripts/generate-traceability-matrix.ts` (new)
- `tests/ci-fixes/failure-classifier.test.ts` (new)
- `docs/traceability.md` (auto-generated, gitignored)

### 1.3 Fix CI Failures (TDD Red→Green→Refactor)

**Acceptance Criteria:**

- [ ] AC1.7: Unit tests pass (all 242+ tests)
- [ ] AC1.8: Coverage ≥85% lines, ≥70% branches (enforced by `scripts/enforce-coverage.js`)
- [ ] AC1.9: CodeQL security scans pass (no high/critical)
- [ ] AC1.10: All Ironclad CI gates green (lint-type, unit-tests, coverage-gate, security, licenses-sbom)

**TDD Steps:**

1. **Red**: Write failing tests for fixed behavior

   - `tests/ci-fixes/unit-tests.test.ts` - Test unit test fixes
   - `tests/ci-fixes/coverage-gate.test.ts` - Test coverage enforcement (≥85%/70%)
   - `tests/ci-fixes/security-scan.test.ts` - Test security fixes

2. **Green**: Minimal code to pass tests
3. **Refactor**: Improve code quality, maintain coverage

**CI Gate Requirements (from `.github/workflows/ironclad.yml`):**

- `lint-type`: ESLint + TypeScript (`npm run lint`, `npm run typecheck`)
- `unit-tests`: Jest with JUnit reporter (`npm test -- --ci --reporters=jest-junit`)
- `coverage-gate`: `scripts/enforce-coverage.js --lines 85 --branches 70`
- `security`: TruffleHog + CodeQL (no secrets, no high/critical CVEs)
- `licenses-sbom`: CycloneDX SBOM + license-checker

**Files to modify:**

- `.github/workflows/ironclad.yml` (verify CI configuration)
- `tests/**/*.test.ts` (fix unit test failures)
- `src/**/*.ts` (improve code coverage to ≥85%/70%)
- `scripts/enforce-coverage.js` (verify exists and enforces thresholds)

### 1.4 Merge Strategy with Rollback & CI Bot (TDD Validation)

**Acceptance Criteria:**

- [ ] AC1.11: All PRs merge without conflicts
- [ ] AC1.12: Post-merge CI status green
- [ ] AC1.13: No regressions introduced
- [ ] AC1.14: Rollback checkpoint created after each PR merge
- [ ] AC1.15: GitHub Action reverts on red CI automatically
- [ ] AC1.16: CI summary comment bot shows Ironclad-gate status inline in PRs

**TDD Steps:**

1. **Red**: Create `tests/merge-strategy/merge-validation.test.ts`
   ```typescript
   describe('Merge Validation', () => {
     it('should validate merge order (49→50→51→...→58)', async () => {
       // Failing test
     });
     it('should verify post-merge CI status is green', async () => {
       // Failing test
     });
     it('should create rollback checkpoint', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement merge validation script, rollback action, CI bot
3. **Refactor**: Add conflict detection, improve bot messaging

**Files to create:**

- `scripts/validate-merge-order.ts` (new)
- `.github/workflows/auto-rollback-on-failure.yml` (new)
- `.github/workflows/ci-summary-bot.yml` (new)
- `scripts/ci-summary-bot.ts` (new)
- `tests/merge-strategy/merge-validation.test.ts` (new)
- `tests/merge-strategy/rollback-checkpoint.test.ts` (new)

---

## Phase 2: Event Type Hindi Translation System - TDD First

### 2.1 Create Translation Infrastructure (TDD)

**Acceptance Criteria:**

- [ ] AC2.1: Hindi translation map created for all event types
- [ ] AC2.2: TypeScript interfaces for translations
- [ ] AC2.3: Database migration adds `event_type_hi` column

**TDD Steps:**

1. **Red**: Create `tests/i18n/event-types-hi.test.ts`
2. **Green**: Create `src/lib/i18n/event-types-hi.ts` with translation map
3. **Refactor**: Add type safety, improve error handling

**Files to create:**

- `src/lib/i18n/event-types-hi.ts` (new)
- `src/lib/i18n/types.ts` (new)
- `tests/i18n/event-types-hi.test.ts` (new)

### 2.2 Translation Mapping (TDD)

**Acceptance Criteria:**

- [ ] AC2.4: All event types have Hindi translations
- [ ] AC2.5: Translation function handles edge cases

**TDD Steps:**

1. **Red**: Add failing tests for edge cases (null/undefined, case-insensitive, special characters)
2. **Green**: Implement translation function
3. **Refactor**: Optimize lookup performance

### 2.3 Translation Audit & Coverage Dashboard (TDD)

**Acceptance Criteria:**

- [ ] AC2.6: Translation audit JSON auto-generated at build time listing untranslated keys
- [ ] AC2.7: i18n coverage dashboard tracks % of Hindi labels translated
- [ ] AC2.8: Crowdsourced fallback file (`translation-missing.json`) for dynamic additions
- [ ] AC2.9: Pre-commit hook prevents merge if untranslated keys > 0

**TDD Steps:**

1. **Red**: Create `tests/i18n/translation-audit.test.ts`
   ```typescript
   describe('Translation Audit', () => {
     it('should generate audit JSON with untranslated keys', async () => {
       // Failing test
     });
     it('should calculate i18n coverage percentage', async () => {
       // Failing test
     });
     it('should fail pre-commit if untranslated keys > 0', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement audit generation, coverage dashboard, pre-commit hook
3. **Refactor**: Optimize audit generation, improve dashboard UX

**Files to create:**

- `scripts/generate-translation-audit.ts` (new)
- `src/components/i18n/CoverageDashboard.tsx` (new)
- `scripts/pre-commit-i18n-check.ts` (new)
- `.husky/pre-commit` (update with i18n check)
- `data/translation-missing.json` (new, for crowdsourced fallback)
- `tests/i18n/translation-audit.test.ts` (new)
- `tests/i18n/coverage-dashboard.test.tsx` (new)

### 2.4 Update Database & API (TDD)

**Acceptance Criteria:**

- [ ] AC2.10: Migration adds `event_type_hi` column to `parsed_events`
- [ ] AC2.11: API endpoints return Hindi labels
- [ ] AC2.12: Parsing engine populates Hindi labels

**TDD Steps:**

1. **Red**: Create `tests/database/hindi-labels.test.ts`
2. **Green**: Create migration, update API endpoints, update parsing engine
3. **Refactor**: Add validation, improve error handling

**Files to create/modify:**

- `infra/migrations/003_add_hindi_labels.sql` (new)
- `tests/database/hindi-labels.test.ts` (new)
- `src/app/api/parsed-events/route.ts`
- `src/lib/parsing/three-layer-consensus-engine.ts`

### 2.5 Update Dashboard Components (TDD)

**Acceptance Criteria:**

- [ ] AC2.13: Dashboard displays Hindi labels only
- [ ] AC2.14: Review queue shows Hindi event types
- [ ] AC2.15: Analytics dashboard uses Hindi throughout

**TDD Steps:**

1. **Red**: Create component tests

   - `tests/components/DashboardDark-hindi.test.tsx`
   - `tests/components/ReviewQueueNew-hindi.test.tsx`
   - `tests/components/AnalyticsDashboardDark-hindi.test.tsx`

2. **Green**: Update components to use Hindi translations
3. **Refactor**: Extract translation logic to hooks

**Files to modify:**

- `src/components/DashboardDark.tsx`
- `src/components/review/ReviewQueueNew.tsx`
- `src/components/analytics/AnalyticsDashboardDark.tsx`

**Test Coverage Requirements:**

- Unit tests for translation functions (≥85% lines, ≥70% branches)
- Component tests for Hindi display
- Integration tests for API Hindi labels

---

## Phase 3: Admin Authentication System - TDD First

### 3.1 Auth Infrastructure with Rate Limiting & Audit (TDD)

**Acceptance Criteria:**

- [ ] AC3.1: Login endpoint validates credentials securely
- [ ] AC3.2: Logout endpoint clears session
- [ ] AC3.3: Status endpoint returns auth state
- [ ] AC3.4: No secrets in code, parameterized queries
- [ ] AC3.5: Rate limiting enforced (brute-force prevention)
- [ ] AC3.6: Login attempt counter tracks failed attempts per IP
- [ ] AC3.7: Login audit log stores timestamp, IP hash, success/failure

**TDD Steps:**

1. **Red**: Create `tests/api/auth/login.test.ts`
   ```typescript
   describe('Admin Authentication', () => {
     it('should reject invalid credentials', async () => {
       // Failing test
     });
     it('should return session token on valid login', async () => {
       // Failing test
     });
     it('should validate input (no SQL injection)', async () => {
       // Security test
     });
     it('should enforce rate limiting', async () => {
       // Failing test
     });
     it('should log login attempts', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement auth endpoints with security, rate limiting, audit logging
3. **Refactor**: Add rate limiting, improve error handling

**Security Requirements (from DevOps policy):**

- No secrets in code
- Parameterized queries (prevent SQL injection)
- Input/output validation
- AuthN/AuthZ on sensitive paths
- Session tokens in httpOnly cookies
- Rate limiting (e.g., 5 attempts per 15 minutes per IP)
- Login audit logging

**Files to create:**

- `src/lib/auth/auth.ts` (new)
- `src/lib/auth/rate-limiter.ts` (new)
- `src/lib/auth/audit-logger.ts` (new)
- `src/app/api/auth/login/route.ts` (new)
- `src/app/api/auth/logout/route.ts` (new)
- `src/app/api/auth/status/route.ts` (new)
- `src/app/api/logs/auth/route.ts` (new, for audit log retrieval)
- `tests/api/auth/login.test.ts` (new)
- `tests/api/auth/logout.test.ts` (new)
- `tests/api/auth/status.test.ts` (new)
- `tests/api/auth/rate-limit.test.ts` (new)
- `tests/api/auth/logging.test.ts` (new)

### 3.2 Session Management with JWT & Refresh (TDD)

**Acceptance Criteria:**

- [ ] AC3.8: Session tokens stored securely (httpOnly cookies)
- [ ] AC3.9: Session expires after 24 hours
- [ ] AC3.10: LocalStorage used only for UI state (not sensitive data)
- [ ] AC3.11: Short-lived JWT stored in httpOnly cookies
- [ ] AC3.12: Refresh endpoint provides secure token renewal

**TDD Steps:**

1. **Red**: Create `tests/auth/session-management.test.ts`
   ```typescript
   describe('Session Management', () => {
     it('should store JWT in httpOnly cookie', async () => {
       // Failing test
     });
     it('should refresh token via secure endpoint', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement session management with JWT, refresh endpoint
3. **Refactor**: Add session refresh logic, improve security

**Files to create:**

- `src/lib/auth/session.ts` (new)
- `src/lib/auth/jwt.ts` (new)
- `src/app/api/auth/refresh/route.ts` (new)
- `tests/auth/session-management.test.ts` (new)
- `tests/auth/jwt-refresh.test.ts` (new)

### 3.3 UI Components (TDD)

**Acceptance Criteria:**

- [ ] AC3.13: Login button visible when not authenticated
- [ ] AC3.14: Logout button visible when authenticated
- [ ] AC3.15: Login modal handles errors gracefully
- [ ] AC3.16: Accessibility: WCAG 2.1 AA (keyboard nav, labels, contrast)

**TDD Steps:**

1. **Red**: Create component tests with a11y checks

   - `tests/components/auth/AdminLoginButton.test.tsx`
   - `tests/components/auth/LoginModal.test.tsx`
   - Use `@testing-library/jest-dom` and `jest-axe` for a11y

2. **Green**: Implement components
3. **Refactor**: Improve UX, add loading states

**Accessibility Requirements:**

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Color contrast ≥4.5:1
- Screen reader support

**Files to create:**

- `src/components/auth/AdminLoginButton.tsx` (new)
- `src/components/auth/AdminLogoutButton.tsx` (new)
- `src/components/auth/LoginModal.tsx` (new)
- `tests/components/auth/AdminLoginButton.test.tsx` (new)
- `tests/components/auth/LoginModal.test.tsx` (new)

### 3.4 Tab Visibility Logic (TDD)

**Acceptance Criteria:**

- [ ] AC3.17: Non-admin users see only Analytics tab
- [ ] AC3.18: Admin users see all tabs (Home, Review, Analytics)
- [ ] AC3.19: Tab visibility updates immediately on login/logout

**TDD Steps:**

1. **Red**: Create E2E tests

   - `tests/e2e/tab-visibility.test.ts` - Playwright/Cypress
   - `tests/integration/tab-visibility.test.ts` - Integration test

2. **Green**: Implement conditional rendering
3. **Refactor**: Extract visibility logic to hook

**Files to modify:**

- `src/app/page.tsx`
- `src/components/DashboardDark.tsx`
- `src/components/review/ReviewQueueNew.tsx`

**Files to create:**

- `src/hooks/useAdminAuth.ts` (new)
- `tests/e2e/tab-visibility.test.ts` (new)
- `tests/integration/tab-visibility.test.ts` (new)

---

## Phase 4: Review Screen Enhancements (AI Assistant Integration) - TDD First

### 4.1 Integrate LangGraph AI Assistant with Latency Tracking & Caching (TDD)

**Acceptance Criteria:**

- [ ] AC4.1: AI assistant connects to review screen
- [ ] AC4.2: AI provides context-aware suggestions
- [ ] AC4.3: Suggestions are displayed in review panel
- [ ] AC4.4: Performance: API response ≤300ms (p95)
- [ ] AC4.5: Latency tracker embedded in AI assistant response headers
- [ ] AC4.6: Cache last 5 AI suggestions per tweet to reduce API calls

**TDD Steps:**

1. **Red**: Create `tests/components/review/AIReviewAssistant.test.tsx`
   ```typescript
   describe('AI Review Assistant', () => {
     it('should load AI suggestions for tweet', async () => {
       // Failing test
     });
     it('should handle AI API errors gracefully', async () => {
       // Failing test
     });
     it('should meet performance budget (p95 ≤300ms)', async () => {
       // Performance test
     });
     it('should include latency in response headers', async () => {
       // Failing test
     });
     it('should cache last 5 suggestions per tweet', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Integrate LangGraph assistant with latency tracking and caching
3. **Refactor**: Add caching, optimize API calls

**Performance Requirements:**

- API p95 ≤300ms (enforced by k6)
- Client-side rendering <100ms
- Use React.memo for expensive components
- Response headers include `X-AI-Latency-Ms` and `X-AI-Latency-P95`

**Files to create:**

- `src/components/review/AIReviewAssistant.tsx` (new)
- `src/lib/ai-assistant/cache.ts` (new)
- `src/lib/ai-assistant/latency-tracker.ts` (new)
- `tests/components/review/AIReviewAssistant.test.tsx` (new)
- `tests/lib/ai-assistant/cache.test.ts` (new)
- `tests/lib/ai-assistant/latency-tracker.test.ts` (new)

### 4.2 Review Workflow with Feedback Loop (TDD)

**Acceptance Criteria:**

- [ ] AC4.7: Load tweets with `needs_review=true` from database
- [ ] AC4.8: Display AI suggestions alongside tweet
- [ ] AC4.9: Allow human to edit all fields (event type, locations, schemes, people)
- [ ] AC4.10: Accept/reject AI suggestions
- [ ] AC4.11: Approve/Skip/Reject with reason
- [ ] AC4.12: Updates persist to database
- [ ] AC4.13: Feedback loop table stores human vs AI correction analysis

**TDD Steps:**

1. **Red**: Create comprehensive review workflow tests

   - `tests/integration/review-workflow.test.ts`
   - `tests/e2e/review-edit-flow.test.ts`
   - `tests/database/review-feedback.test.ts`

2. **Green**: Implement review workflow with feedback tracking
3. **Refactor**: Add validation, improve UX

**Files to create:**

- `src/components/review/ReviewEditForm.tsx` (new)
- `src/app/api/review/update/route.ts` (new)
- `src/app/api/review/feedback/route.ts` (new)
- `infra/migrations/004_add_review_feedback.sql` (new)
- `tests/integration/review-workflow.test.ts` (new)
- `tests/e2e/review-edit-flow.test.ts` (new)
- `tests/database/review-feedback.test.ts` (new)

### 4.3 AI Assistant Features (TDD)

**Acceptance Criteria:**

- [ ] AC4.14: Context-aware suggestions based on tweet content
- [ ] AC4.15: Accept user input for corrections
- [ ] AC4.16: Apply edits to parsed_event record
- [ ] AC4.17: Update review_status, reviewed_by, reviewed_at

**TDD Steps:**

1. **Red**: Create AI assistant integration tests

   - `tests/integration/ai-assistant-suggestions.test.ts`

2. **Green**: Integrate LangGraph assistant
3. **Refactor**: Improve suggestion quality

**Files to modify:**

- `src/components/review/ReviewQueueNew.tsx`
- `src/lib/ai-assistant/langgraph-assistant.ts`

### 4.4 AI Assistant Performance Testing (TDD)

**Acceptance Criteria:**

- [ ] AC4.18: Synthetic load test verifies p95 ≤300ms requirement
- [ ] AC4.19: Load test runs in CI pipeline

**TDD Steps:**

1. **Red**: Create k6 load test script
2. **Green**: Implement `perf/ai-assistant-300ms.js` k6 script
3. **Refactor**: Optimize based on test results

**Files to create:**

- `perf/ai-assistant-300ms.js` (new, k6 script)
- `.github/workflows/ironclad.yml` (update to include AI assistant perf test)

---

## Phase 5: Comprehensive Analytics Dashboard (9 Modules, Hindi) - TDD First

### 5.1 Module A: Event Type Analysis (TDD)

**Acceptance Criteria:**

- [ ] AC5.1: Donut/pie chart displays event type distribution in Hindi
- [ ] AC5.2: Month-wise frequency timeline works
- [ ] AC5.3: Filter by constituency/district works
- [ ] AC5.4: Performance: Chart renders <500ms

**TDD Steps:**

1. **Red**: Create `tests/components/analytics/EventTypeAnalysis.test.tsx`
2. **Green**: Implement component with charts
3. **Refactor**: Optimize chart rendering

**Files to create:**

- `src/components/analytics/EventTypeAnalysis.tsx` (new)
- `tests/components/analytics/EventTypeAnalysis.test.tsx` (new)
- `src/app/api/analytics/event-types/route.ts` (new)
- `tests/api/analytics/event-types.test.ts` (new)

### 5.2 Module B: Geo-Mapping & Mindmap (TDD)

**Acceptance Criteria:**

- [ ] AC5.5: Interactive mindmap shows Chhattisgarh hierarchy
- [ ] AC5.6: Visit intensity heatmap works
- [ ] AC5.7: Drill-down from district to village/ward works
- [ ] AC5.8: Tooltips show event details
- [ ] AC5.9: Accessibility: Keyboard navigation for mindmap

**TDD Steps:**

1. **Red**: Create tests for mindmap component
2. **Green**: Implement with D3.js
3. **Refactor**: Optimize rendering, add a11y

**Files to create:**

- `src/components/analytics/GeoMappingMindmap.tsx` (new)
- `tests/components/analytics/GeoMappingMindmap.test.tsx` (new)
- `src/app/api/analytics/geo-mapping/route.ts` (new)

### 5.3-5.9: Modules C through I (TDD for Each)

**Same TDD pattern for all modules:**

1. **Red**: Write failing tests first
2. **Green**: Implement minimal code to pass
3. **Refactor**: Optimize, add a11y, improve UX

**Each module requires:**

- Component test file (`tests/components/analytics/{ModuleName}.test.tsx`)
- API endpoint test file (`tests/api/analytics/{module-name}.test.ts`)
- Coverage ≥85% lines, ≥70% branches
- Accessibility tests (axe-core)
- Performance tests (Lighthouse/k6)

**Files to create (all modules):**

- `src/components/analytics/TourCoverageAnalysis.tsx`
- `src/components/analytics/DevelopmentWorksAnalysis.tsx`
- `src/components/analytics/CommunityOutreachAnalysis.tsx`
- `src/components/analytics/SchemeAnalysis.tsx`
- `src/components/analytics/BeneficiaryGroupAnalysis.tsx`
- `src/components/analytics/ThematicAnalysis.tsx`
- `src/components/analytics/RaigarhConstituencySection.tsx`
- Corresponding test files and API endpoints

### 5.10 Global Filter Bus & Metrics Manifest (TDD)

**Acceptance Criteria:**

- [ ] AC5.10: Global filter bus (Context API) shares filters reactively across all 9 modules
- [ ] AC5.11: Metrics manifest auto-generated mapping each API ↔ RED/USE metrics
- [ ] AC5.12: i18n consistency tests for chart labels
- [ ] AC5.13: Offline cache fallback for charts (JSON snapshot)
- [ ] AC5.14: State sync indicator (✅/⚠️) shows data mismatch with backend

**TDD Steps:**

1. **Red**: Create tests for filter bus, metrics manifest, i18n consistency, offline cache
   ```typescript
   describe('Analytics Filter Bus', () => {
     it('should share filters across all modules', async () => {
       // Failing test
     });
   });
   describe('Metrics Manifest', () => {
     it('should generate manifest mapping APIs to metrics', async () => {
       // Failing test
     });
   });
   describe('i18n Chart Labels', () => {
     it('should verify Hindi labels in all charts', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement filter bus, metrics manifest generator, i18n tests, offline cache
3. **Refactor**: Optimize filter bus performance, improve manifest generation

**Files to create:**

- `src/contexts/AnalyticsFilterContext.tsx` (new)
- `scripts/generate-metrics-manifest.ts` (new)
- `src/lib/analytics/offline-cache.ts` (new)
- `src/components/analytics/StateSyncIndicator.tsx` (new)
- `tests/i18n/charts-labels.test.ts` (new)
- `tests/contexts/AnalyticsFilterContext.test.tsx` (new)
- `tests/lib/analytics/offline-cache.test.ts` (new)
- `docs/metrics.md` (auto-generated, gitignored)

### 5.11 Analytics API Endpoints (TDD)

**Acceptance Criteria:**

- [ ] AC5.15: All 9 API endpoints return correct data
- [ ] AC5.16: Performance: p95 ≤300ms (enforced by k6)
- [ ] AC5.17: Input validation on all endpoints
- [ ] AC5.18: Error handling for database failures

**TDD Steps:**

1. **Red**: Create API endpoint tests

   - `tests/api/analytics/event-types.test.ts`
   - `tests/api/analytics/geo-mapping.test.ts`
   - ... (9 endpoints total)

2. **Green**: Implement endpoints
3. **Refactor**: Add caching, optimize queries

**Performance Requirements:**

- API p95 ≤300ms (test with k6)
- Database queries optimized (indexes)
- Response caching where appropriate

**Files to create:**

- `src/app/api/analytics/event-types/route.ts` (new)
- `src/app/api/analytics/geo-mapping/route.ts` (new)
- `src/app/api/analytics/tour-coverage/route.ts` (new)
- `src/app/api/analytics/development-works/route.ts` (new)
- `src/app/api/analytics/community-outreach/route.ts` (new)
- `src/app/api/analytics/schemes/route.ts` (new)
- `src/app/api/analytics/beneficiary-groups/route.ts` (new)
- `src/app/api/analytics/thematic/route.ts` (new)
- `src/app/api/analytics/raigarh/route.ts` (new)
- Corresponding test files

### 5.12 Analytics Dashboard Integration (TDD)

**Acceptance Criteria:**

- [ ] AC5.19: All 9 modules integrated into dashboard
- [ ] AC5.20: Filter section works (स्थान, विषय, दिनांक)
- [ ] AC5.21: Export buttons work (PDF, Excel, CSV)
- [ ] AC5.22: Full Hindi UI with Noto Sans Devanagari font
- [ ] AC5.23: Accessibility: WCAG 2.1 AA throughout

**TDD Steps:**

1. **Red**: Create E2E test for full dashboard

   - `tests/e2e/analytics-dashboard.test.ts`

2. **Green**: Integrate all modules
3. **Refactor**: Optimize bundle size, improve performance

**Files to modify:**

- `src/components/analytics/AnalyticsDashboardDark.tsx`
- `src/app/api/analytics/route.ts`

**Files to create:**

- `tests/e2e/analytics-dashboard.test.ts` (new)

---

## Phase 6: Pipeline Integration & Production Deployment - TDD First

### 6.1 Verify Pipeline Flow (TDD)

**Acceptance Criteria:**

- [ ] AC6.1: Fetch → Parse → Review → Analytics pipeline works end-to-end
- [ ] AC6.2: Database connectivity verified
- [ ] AC6.3: GitHub Actions workflow runs successfully
- [ ] AC6.4: Three-layer parsing active and working

**TDD Steps:**

1. **Red**: Create integration tests

   - `tests/integration/pipeline-end-to-end.test.ts` (already exists, enhance)

2. **Green**: Fix any pipeline issues
3. **Refactor**: Add monitoring, improve error handling

**Files:**

- `tests/integration/pipeline-end-to-end.test.ts` (enhance existing)

### 6.2 Environment Configuration (TDD)

**Acceptance Criteria:**

- [ ] AC6.5: All environment variables verified in Vercel
- [ ] AC6.6: No secrets in code
- [ ] AC6.7: Environment validation script works

**TDD Steps:**

1. **Red**: Create `tests/env/env-validation.test.ts`
2. **Green**: Implement validation script
3. **Refactor**: Add better error messages

**Files:**

- `scripts/validate-env.ts` (new)
- `tests/env/env-validation.test.ts` (new)

### 6.3 Production Deployment Checklist (TDD)

**Acceptance Criteria:**

- [ ] AC6.8: Build succeeds (`npm run build`)
- [ ] AC6.9: All API endpoints tested
- [ ] AC6.10: Database migrations run successfully
- [ ] AC6.11: Admin authentication works
- [ ] AC6.12: Review workflow with AI assistant works
- [ ] AC6.13: Analytics dashboard displays real data in Hindi

**TDD Steps:**

1. **Red**: Create deployment smoke tests

   - `tests/e2e/deployment-smoke.test.ts`

2. **Green**: Fix deployment issues
3. **Refactor**: Add health checks

**Files:**

- `tests/e2e/deployment-smoke.test.ts` (new)

### 6.4 Deployment Automation & Monitoring (TDD)

**Acceptance Criteria:**

- [ ] AC6.14: Deployment to Vercel succeeds
- [ ] AC6.15: Production URL accessible
- [ ] AC6.16: All tabs and features work in production
- [ ] AC6.17: GitHub Actions workflow triggers correctly
- [ ] AC6.18: Unified `.ironclad/state.yaml` logs completion % per phase
- [ ] AC6.19: Branch protection enforces required status checks
- [ ] AC6.20: Post-deploy verification script hits /health, /metrics, /analytics
- [ ] AC6.21: SBOM signing (Cosign + CycloneDX) for supply-chain integrity
- [ ] AC6.22: Auto-rollback pipeline tested once per deploy
- [ ] AC6.23: Lighthouse + axe-core results pushed nightly to Grafana

**TDD Steps:**

1. **Red**: Create deployment validation tests, state tracking tests
   ```typescript
   describe('Deployment Automation', () => {
     it('should update .ironclad/state.yaml on phase completion', async () => {
       // Failing test
     });
     it('should verify post-deploy endpoints', async () => {
       // Failing test
     });
     it('should sign SBOM with Cosign', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement state tracking, post-deploy verification, SBOM signing, auto-rollback
3. **Refactor**: Improve monitoring, add alerts

**Files to create:**

- `.ironclad/state.yaml` (new, tracked in git)
- `.github/branch-protection.yml` (new)
- `scripts/post-deploy-verify.ts` (new)
- `scripts/sign-sbom.sh` (new, uses Cosign)
- `.github/workflows/sbom-signing.yml` (new)
- `.github/workflows/auto-rollback.yml` (enhance existing)
- `.github/workflows/nightly-metrics.yml` (new, pushes to Grafana)
- `tests/deployment/state-tracking.test.ts` (new)
- `tests/deployment/post-deploy-verify.test.ts` (new)

**Files to verify:**

- `.env.local` / Vercel environment variables
- `vercel.json` (if exists)
- `package.json` (build scripts)
- `.github/workflows/fetch-and-parse-tweets.yml`

### 6.5 Post-Deployment Verification (TDD)

**Acceptance Criteria:**

- [ ] AC6.24: Analytics tab visible to public (no login)
- [ ] AC6.25: Home/Review tabs hidden for non-admin
- [ ] AC6.26: Admin login works
- [ ] AC6.27: Full dashboard access after login
- [ ] AC6.28: Review screen with AI assistant works
- [ ] AC6.29: All 9 analytics modules display correctly
- [ ] AC6.30: Hindi translations throughout

**TDD Steps:**

1. **Red**: Create post-deployment E2E tests

   - `tests/e2e/post-deployment-verification.test.ts`

2. **Green**: Verify all criteria
3. **Refactor**: Add automated monitoring

**Files:**

- `tests/e2e/post-deployment-verification.test.ts` (new)

---

## Phase 7: CommandView Control Panel & CMS - TDD First

### 7.1 System Health Overview Dashboard (TDD)

**Acceptance Criteria:**

- [ ] AC7.1: System health summary cards display API chain health (Fetch → Parse → Review → AI → Analytics)
- [ ] AC7.2: Database connection status shown for PostgreSQL/Firestore/Supabase
- [ ] AC7.3: Frontend build health (Vercel/CI status) displayed
- [ ] AC7.4: Backend service uptime shown
- [ ] AC7.5: Each card clickable → opens detail view (logs, uptime %, latency)
- [ ] AC7.6: Performance: Health cards render <200ms
- [ ] AC7.7: Accessibility: WCAG 2.1 AA (keyboard nav, ARIA labels, contrast ≥4.5:1)

**TDD Steps:**

1. **Red**: Create `tests/components/admin/SystemHealthCards.test.tsx`
   ```typescript
   describe('System Health Overview', () => {
     it('should display API chain health status', async () => {
       // Failing test
     });
     it('should show database connection status', async () => {
       // Failing test
     });
     it('should be keyboard navigable', async () => {
       // Accessibility test
     });
     it('should render within performance budget', async () => {
       // Performance test
     });
   });
   ```

2. **Green**: Implement health cards component with polling
3. **Refactor**: Optimize rendering, improve accessibility

**Files to create:**

- `src/components/admin/SystemHealthCards.tsx` (new)
- `src/hooks/useSystemHealth.ts` (new)
- `src/app/api/system/health/route.ts` (new)
- `tests/components/admin/SystemHealthCards.test.tsx` (new)
- `tests/hooks/useSystemHealth.test.ts` (new)
- `tests/api/system/health.test.ts` (new)

### 7.2 Dynamic Title & Header Editor (TDD)

**Acceptance Criteria:**

- [ ] AC7.8: Inline editable fields for all titles, subtitles, section headers
- [ ] AC7.9: Updates sync instantly across all dashboard screens via CMS config
- [ ] AC7.10: Supports Hindi + English text entries
- [ ] AC7.11: Stores metadata in `config/titles.json`
- [ ] AC7.12: Input validation prevents XSS/injection attacks
- [ ] AC7.13: Accessibility: Keyboard navigation, screen reader support

**TDD Steps:**

1. **Red**: Create `tests/components/admin/TitleEditor.test.tsx`
   ```typescript
   describe('Dynamic Title Editor', () => {
     it('should allow inline editing of titles', async () => {
       // Failing test
     });
     it('should sync changes to CMS config', async () => {
       // Failing test
     });
     it('should support Hindi and English text', async () => {
       // Failing test
     });
     it('should prevent XSS attacks', async () => {
       // Security test
     });
   });
   ```

2. **Green**: Implement title editor with CMS sync
3. **Refactor**: Add validation, improve UX

**Files to create:**

- `src/components/admin/TitleEditor.tsx` (new)
- `src/hooks/useEditableTitles.ts` (new)
- `src/app/api/cms/config/route.ts` (new)
- `src/types/cms.ts` (new)
- `src/config/defaultConfig.json` (new)
- `tests/components/admin/TitleEditor.test.tsx` (new)
- `tests/hooks/useEditableTitles.test.ts` (new)
- `tests/api/cms/config.test.ts` (new)

### 7.3 Analytics Module Toggle System (TDD)

**Acceptance Criteria:**

- [ ] AC7.14: Toggle system for all 9 analytics modules (Event Type, Geo-Mapping, Tour Coverage, Development Works, Community Outreach, Schemes, Beneficiary Groups, Thematic, Raigarh)
- [ ] AC7.15: Real-time apply: toggled OFF = module hidden instantly from UI
- [ ] AC7.16: State stored in `config/modules.json`
- [ ] AC7.17: Toggle changes persist to database
- [ ] AC7.18: Accessibility: Toggle switches keyboard navigable, proper labels

**TDD Steps:**

1. **Red**: Create `tests/components/admin/ModuleToggle.test.tsx`
   ```typescript
   describe('Analytics Module Toggle', () => {
     it('should toggle module visibility', async () => {
       // Failing test
     });
     it('should hide module instantly when toggled OFF', async () => {
       // Failing test
     });
     it('should persist state to database', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement toggle system with real-time updates
3. **Refactor**: Optimize state management, improve performance

**Files to create:**

- `src/components/admin/ModuleToggle.tsx` (new)
- `src/hooks/useAnalyticsModules.ts` (new)
- `tests/components/admin/ModuleToggle.test.tsx` (new)
- `tests/hooks/useAnalyticsModules.test.ts` (new)

### 7.4 Telemetry & Logs Dashboard (TDD)

**Acceptance Criteria:**

- [ ] AC7.19: Unified view for API latency (p50, p95, p99)
- [ ] AC7.20: Error rates by endpoint displayed
- [ ] AC7.21: Memory & CPU metrics for backend shown
- [ ] AC7.22: Web vitals: LCP, FID, CLS displayed
- [ ] AC7.23: Mini sparkline graphs for each metric
- [ ] AC7.24: Integration with BetterStack/Grafana if available
- [ ] AC7.25: Performance: Dashboard updates every 10s without lag

**TDD Steps:**

1. **Red**: Create `tests/components/admin/TelemetryDashboard.test.tsx`
   ```typescript
   describe('Telemetry Dashboard', () => {
     it('should display API latency metrics', async () => {
       // Failing test
     });
     it('should show error rates by endpoint', async () => {
       // Failing test
     });
     it('should render sparkline graphs', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement telemetry dashboard with polling
3. **Refactor**: Optimize rendering, add caching

**Files to create:**

- `src/components/admin/TelemetryDashboard.tsx` (new)
- `src/app/api/system/telemetry/route.ts` (new)
- `tests/components/admin/TelemetryDashboard.test.tsx` (new)
- `tests/api/system/telemetry.test.ts` (new)

### 7.5 Database & Pipeline Monitor (TDD)

**Acceptance Criteria:**

- [ ] AC7.26: Connection status, last sync timestamps, record counts displayed
- [ ] AC7.27: Health flow chart shows: [Fetch] → [Parse] → [Review] → [AI] → [Analytics]
- [ ] AC7.28: Each node shows ✅ or ⚠️ based on last execution
- [ ] AC7.29: Click node → see last log excerpt or error message
- [ ] AC7.30: Accessibility: Flow chart keyboard navigable, screen reader friendly

**TDD Steps:**

1. **Red**: Create `tests/components/admin/PipelineMonitor.test.tsx`
   ```typescript
   describe('Pipeline Monitor', () => {
     it('should display pipeline health flow chart', async () => {
       // Failing test
     });
     it('should show node status based on last execution', async () => {
       // Failing test
     });
     it('should display log excerpt on node click', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement pipeline monitor with interactive nodes
3. **Refactor**: Improve visualization, add error handling

**Files to create:**

- `src/components/admin/PipelineMonitor.tsx` (new)
- `src/app/api/system/pipeline/route.ts` (new)
- `tests/components/admin/PipelineMonitor.test.tsx` (new)
- `tests/api/system/pipeline.test.ts` (new)

### 7.6 Admin Access & Permissions (TDD)

**Acceptance Criteria:**

- [ ] AC7.31: Panel accessible only to admin users (role === 'admin')
- [ ] AC7.32: Auth integrated with existing `/api/auth/status`
- [ ] AC7.33: Non-admins cannot see or edit any config
- [ ] AC7.34: CSRF protection on all write operations
- [ ] AC7.35: CORS configured for admin routes only
- [ ] AC7.36: CommandView tab visible only in admin navigation (never in public)
- [ ] AC7.37: Visiting /admin/commandview without admin auth → redirect to /analytics
- [ ] AC7.38: All admin routes protected at frontend (React) and backend (API)
- [ ] AC7.39: No CommandView references in public bundle (code splitting)
- [ ] AC7.40: Shield icon (🛡️) shown beside CommandView in admin nav for clarity

**Admin-Only Access Rules (Critical):**

- **Visibility Policy**: CommandView is Admin-exclusive tab, grouped alongside Home and Review inside internal admin navigation
- **Never Visible To**: Client-side users, public users, non-authenticated users
- **Routing Protection**: 
  - Frontend: `if (!admin) return <Navigate to="/analytics" />`
  - Backend: `app.use('/api/admin', verifyAdminToken)`
- **Bundle Safety**: No references, links, or preload hints for CommandView in public builds
- **Role Check**: `role === 'admin'` must gate rendering at both frontend and backend

**TDD Steps:**

1. **Red**: Create `tests/api/admin/auth-protection.test.ts`
   ```typescript
   describe('Admin Access Protection', () => {
     it('should reject non-admin users', async () => {
       // Failing test
     });
     it('should require CSRF token for write operations', async () => {
       // Security test
     });
     it('should redirect non-admin from /admin/commandview to /analytics', async () => {
       // Failing test
     });
     it('should not include CommandView in public bundle', async () => {
       // Security test - verify bundle analysis
     });
     it('should require role === "admin" at both frontend and backend', async () => {
       // Security test
     });
   });
   ```

2. **Green**: Implement admin-only middleware and route protection with bundle safety
3. **Refactor**: Add better error messages, improve security, verify code splitting

**Files to create:**

- `src/middleware/adminAuth.ts` (new)
- `src/middleware/csrf.ts` (new)
- `src/middleware/adminRouteGuard.tsx` (new, for CommandView route)
- `tests/middleware/adminAuth.test.ts` (new)
- `tests/middleware/csrf.test.ts` (new)
- `tests/security/admin-bundle-safety.test.ts` (new, verify no admin routes in public bundle)

### 7.7 Config Export/Import (TDD)

**Acceptance Criteria:**

- [ ] AC7.36: "Export All Config" button downloads merged JSON of current CMS state
- [ ] AC7.37: "Import Config" button uploads and overrides config safely
- [ ] AC7.38: Import validates JSON schema before applying
- [ ] AC7.39: Import creates backup before overwriting
- [ ] AC7.40: Export/Import logs audit trail

**TDD Steps:**

1. **Red**: Create `tests/components/admin/ConfigManagement.test.tsx`
   ```typescript
   describe('Config Export/Import', () => {
     it('should export all config as JSON', async () => {
       // Failing test
     });
     it('should import and validate config', async () => {
       // Failing test
     });
     it('should create backup before import', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement export/import with validation
3. **Refactor**: Add error handling, improve UX

**Files to create:**

- `src/components/admin/ConfigManagement.tsx` (new)
- `src/app/api/cms/export/route.ts` (new)
- `src/app/api/cms/import/route.ts` (new)
- `src/lib/cms/config-validator.ts` (new)
- `tests/components/admin/ConfigManagement.test.tsx` (new)
- `tests/api/cms/export.test.ts` (new)
- `tests/api/cms/import.test.ts` (new)

### 7.8 CommandView Main UI Integration (TDD)

**Acceptance Criteria:**

- [ ] AC7.41: Main CommandView page integrates all components
- [ ] AC7.42: Layout matches ASCII design specification
- [ ] AC7.43: Responsive design works on mobile/tablet
- [ ] AC7.44: Full Hindi UI support with Noto Sans Devanagari font
- [ ] AC7.45: Accessibility: WCAG 2.1 AA throughout

**TDD Steps:**

1. **Red**: Create `tests/pages/admin/CommandView.test.tsx`
   ```typescript
   describe('CommandView Page', () => {
     it('should render all dashboard sections', async () => {
       // Failing test
     });
     it('should be responsive on mobile', async () => {
       // Failing test
     });
     it('should meet accessibility standards', async () => {
       // Accessibility test with jest-axe
     });
   });
   ```

2. **Green**: Implement main CommandView page
3. **Refactor**: Optimize layout, improve accessibility

**Files to create:**

- `src/pages/admin/CommandView.tsx` (new)
- `src/app/admin/commandview/page.tsx` (new)
- `tests/pages/admin/CommandView.test.tsx` (new)
- `tests/e2e/commandview.test.ts` (new)

---

## Phase 8: CommandView Telemetry & Tracing Extension - TDD First

### 8.1 Trace ID System Implementation (TDD)

**Acceptance Criteria:**

- [ ] AC8.1: Every API request generates trace_id (UUID v4)
- [ ] AC8.2: Each subsystem logs trace_id, timestamp, latency_ms, status_code, component, error_message
- [ ] AC8.3: All traces streamed to `/api/system/traces` endpoint
- [ ] AC8.4: CommandView aggregates last 100 traces per pipeline
- [ ] AC8.5: Trace middleware logs all requests with trace IDs

**TDD Steps:**

1. **Red**: Create `tests/middleware/traceLogger.test.ts`
   ```typescript
   describe('Trace ID System', () => {
     it('should generate UUID v4 trace_id for each request', async () => {
       // Failing test
     });
     it('should log trace with all required fields', async () => {
       // Failing test
     });
     it('should stream traces to API endpoint', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement trace middleware and logging
3. **Refactor**: Optimize logging performance, add batching

**Files to create:**

- `src/middleware/traceLogger.ts` (new)
- `src/lib/observability/trace-collector.ts` (new)
- `src/app/api/system/traces/route.ts` (new)
- `tests/middleware/traceLogger.test.ts` (new)
- `tests/lib/observability/trace-collector.test.ts` (new)
- `tests/api/system/traces.test.ts` (new)

### 8.2 API Latency Visualization (TDD)

**Acceptance Criteria:**

- [ ] AC8.6: Live updating latency bars/sparklines for each API node
- [ ] AC8.7: Metrics shown: p50, p95, max latency, success vs error rate
- [ ] AC8.8: Color-coded status (🟢 normal / 🟠 slow / 🔴 failing)
- [ ] AC8.9: Data refreshed every 10s via WebSocket or setInterval
- [ ] AC8.10: Performance: Visualization renders <100ms

**TDD Steps:**

1. **Red**: Create `tests/components/telemetry/LatencyVisualization.test.tsx`
   ```typescript
   describe('Latency Visualization', () => {
     it('should display p50, p95, max latency', async () => {
       // Failing test
     });
     it('should color-code by status', async () => {
       // Failing test
     });
     it('should update every 10 seconds', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement latency visualization with live updates
3. **Refactor**: Optimize rendering, add WebSocket support

**Files to create:**

- `src/components/telemetry/LatencyVisualization.tsx` (new)
- `src/hooks/useTraces.ts` (new)
- `tests/components/telemetry/LatencyVisualization.test.tsx` (new)
- `tests/hooks/useTraces.test.ts` (new)

### 8.3 Trace Timeline Inspector (TDD)

**Acceptance Criteria:**

- [ ] AC8.11: Click any API node opens "Trace Explorer" modal
- [ ] AC8.12: Timeline shows: Fetch → Parse → Review → AI → Analytics with latencies
- [ ] AC8.13: Hover to view raw JSON trace payload
- [ ] AC8.14: "View Logs" button opens `/logs/<trace_id>`
- [ ] AC8.15: Accessibility: Modal keyboard navigable, screen reader friendly

**TDD Steps:**

1. **Red**: Create `tests/components/telemetry/TraceExplorerModal.test.tsx`
   ```typescript
   describe('Trace Explorer', () => {
     it('should display trace timeline', async () => {
       // Failing test
     });
     it('should show raw JSON on hover', async () => {
       // Failing test
     });
     it('should open logs view', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement trace explorer modal
3. **Refactor**: Improve UX, add error handling

**Files to create:**

- `src/components/telemetry/TraceExplorerModal.tsx` (new)
- `src/app/api/system/trace/[id]/route.ts` (new)
- `tests/components/telemetry/TraceExplorerModal.test.tsx` (new)
- `tests/api/system/trace/[id].test.ts` (new)

### 8.4 Error Snapshot Panel (TDD)

**Acceptance Criteria:**

- [ ] AC8.16: Table of most recent 10 errors with timestamp, component, trace_id, error_message
- [ ] AC8.17: Color highlight by severity
- [ ] AC8.18: Filters: by component or last n minutes
- [ ] AC8.19: Clickable trace_id opens Trace Explorer
- [ ] AC8.20: Accessibility: Table keyboard navigable, proper ARIA labels

**TDD Steps:**

1. **Red**: Create `tests/components/telemetry/ErrorTable.test.tsx`
   ```typescript
   describe('Error Snapshot Panel', () => {
     it('should display recent errors', async () => {
       // Failing test
     });
     it('should filter by component', async () => {
       // Failing test
     });
     it('should highlight by severity', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement error table with filtering
3. **Refactor**: Improve performance, add pagination

**Files to create:**

- `src/components/telemetry/ErrorTable.tsx` (new)
- `src/app/api/system/errors/route.ts` (new)
- `tests/components/telemetry/ErrorTable.test.tsx` (new)
- `tests/api/system/errors.test.ts` (new)

### 8.5 Latency Heatmap (TDD)

**Acceptance Criteria:**

- [ ] AC8.21: Grid visual showing p95 latency for each API node
- [ ] AC8.22: Legend: Green <250ms, Orange 250-350ms, Red >350ms
- [ ] AC8.23: Visual bars scale proportionally to latency
- [ ] AC8.24: Accessibility: Heatmap keyboard navigable, color-blind friendly

**TDD Steps:**

1. **Red**: Create `tests/components/telemetry/TraceHeatmap.test.tsx`
   ```typescript
   describe('Latency Heatmap', () => {
     it('should display p95 latency for each node', async () => {
       // Failing test
     });
     it('should color-code by latency thresholds', async () => {
       // Failing test
     });
     it('should be accessible (keyboard nav, color-blind friendly)', async () => {
       // Accessibility test
     });
   });
   ```

2. **Green**: Implement heatmap visualization
3. **Refactor**: Improve visual design, add tooltips

**Files to create:**

- `src/components/telemetry/TraceHeatmap.tsx` (new)
- `src/app/api/system/metrics/route.ts` (new)
- `tests/components/telemetry/TraceHeatmap.test.tsx` (new)
- `tests/api/system/metrics.test.ts` (new)

### 8.6 Recent Trace Stream (TDD)

**Acceptance Criteria:**

- [ ] AC8.25: Live list (auto-scroll) showing trace_id, pipeline path, total latency, status
- [ ] AC8.26: Clicking row opens Trace Explorer modal
- [ ] AC8.27: Auto-scroll pauses on hover
- [ ] AC8.28: Performance: Stream updates without lag

**TDD Steps:**

1. **Red**: Create `tests/components/telemetry/TraceStream.test.tsx`
   ```typescript
   describe('Trace Stream', () => {
     it('should display live trace list', async () => {
       // Failing test
     });
     it('should auto-scroll with pause on hover', async () => {
       // Failing test
     });
     it('should open Trace Explorer on click', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement trace stream component
3. **Refactor**: Optimize rendering, improve UX

**Files to create:**

- `src/components/telemetry/TraceStream.tsx` (new)
- `tests/components/telemetry/TraceStream.test.tsx` (new)

### 8.7 CommandView Telemetry Integration (TDD)

**Acceptance Criteria:**

- [ ] AC8.29: All telemetry components integrated into CommandView
- [ ] AC8.30: Layout matches ASCII design specification
- [ ] AC8.31: Real-time updates work without performance degradation
- [ ] AC8.32: Full accessibility compliance (WCAG 2.1 AA)

**TDD Steps:**

1. **Red**: Create E2E test for full telemetry dashboard
   ```typescript
   describe('CommandView Telemetry Integration', () => {
     it('should display all telemetry components', async () => {
       // Failing test
     });
     it('should update in real-time without lag', async () => {
       // Performance test
     });
   });
   ```

2. **Green**: Integrate all telemetry components
3. **Refactor**: Optimize bundle size, improve performance

**Files to modify:**

- `src/pages/admin/CommandView.tsx` (add telemetry section)

**Files to create:**

- `tests/e2e/commandview-telemetry.test.ts` (new)

---

## Continuous Compliance & Observability - TDD First

### 7.1 CI Scorecard & Quality Gates (TDD)

**Acceptance Criteria:**

- [ ] AC7.1: Live CI scorecard badge (Ironclad Status: Green/Yellow/Red) in README
- [ ] AC7.2: Quality-gate summary in README auto-updated after each CI run
- [ ] AC7.3: Monthly Ironclad audit report auto-generated

**TDD Steps:**

1. **Red**: Create tests for scorecard generation, quality-gate summary, audit report
   ```typescript
   describe('CI Scorecard', () => {
     it('should generate badge based on CI status', async () => {
       // Failing test
     });
     it('should update README with quality-gate summary', async () => {
       // Failing test
     });
     it('should generate monthly audit report', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement scorecard badge, quality-gate summary, audit report generator
3. **Refactor**: Improve badge accuracy, enhance audit report detail

**Files to create:**

- `scripts/generate-ci-scorecard.ts` (new)
- `scripts/generate-quality-gate-summary.ts` (new)
- `scripts/generate-audit-report.ts` (new)
- `.github/workflows/monthly-audit.yml` (new, scheduled monthly)
- `docs/audit-reports/audit-report-YYYY-MM.md` (auto-generated, gitignored)
- `tests/compliance/scorecard.test.ts` (new)
- `tests/compliance/quality-gate.test.ts` (new)
- `tests/compliance/audit-report.test.ts` (new)

### 7.2 Observability & Metrics Export (TDD)

**Acceptance Criteria:**

- [ ] AC7.4: Structured JSON logs exported to Prometheus (trace IDs, latency ms, outcome)
- [ ] AC7.5: RED/USE metrics collected for all endpoints
- [ ] AC7.6: Metrics exported to Prometheus via `/metrics` endpoint

**TDD Steps:**

1. **Red**: Create tests for log export, metrics collection
   ```typescript
   describe('Observability', () => {
     it('should export structured logs to Prometheus', async () => {
       // Failing test
     });
     it('should collect RED/USE metrics', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement log export, metrics collection, Prometheus endpoint
3. **Refactor**: Optimize metric collection, improve log structure

**Files to create:**

- `src/lib/observability/log-exporter.ts` (new)
- `src/lib/observability/metrics-collector.ts` (new)
- `src/app/api/metrics/route.ts` (new)
- `tests/lib/observability/log-exporter.test.ts` (new)
- `tests/lib/observability/metrics-collector.test.ts` (new)
- `tests/api/metrics.test.ts` (new)

---

## Testing & Validation - Comprehensive TDD Coverage

### Unit Tests (All Phases)

- **Coverage Requirements**: Lines ≥85%, Branches ≥70%
- **Enforcement**: `scripts/enforce-coverage.js` in CI
- **Test Files**: One per component/module/API endpoint

### Integration Tests (All Phases)

- **Pipeline Integration**: `tests/integration/pipeline-end-to-end.test.ts`
- **API Integration**: `tests/integration/api-*.test.ts`
- **Database Integration**: `tests/integration/database-*.test.ts`

### E2E Tests (Critical Paths)

- **Tab Visibility**: `tests/e2e/tab-visibility.test.ts`
- **Review Workflow**: `tests/e2e/review-edit-flow.test.ts`
- **Analytics Dashboard**: `tests/e2e/analytics-dashboard.test.ts`
- **Post-Deployment**: `tests/e2e/post-deployment-verification.test.ts`

### Performance Tests (All Phases)

- **Web Performance**: Lighthouse CI (LCP ≤2.5s, CLS ≤0.1)
- **API Performance**: k6 tests (p95 ≤300ms)
- **Test Files**: `perf/api-*.js` (k6 scripts)
- **AI Assistant Performance**: `perf/ai-assistant-300ms.js` (k6 script)

### Accessibility Tests (All Phases)

- **Enforcement**: axe-core in CI
- **Requirements**: WCAG 2.1 AA, zero violations
- **Test Files**: Component tests with `jest-axe`
- **i18n Consistency**: `tests/i18n/charts-labels.test.ts`

### Security Tests (All Phases)

- **Secret Scanning**: TruffleHog in CI
- **SAST**: CodeQL in CI
- **Input Validation**: Tests for SQL injection, XSS prevention
- **Rate Limiting**: `tests/api/auth/rate-limit.test.ts`
- **SBOM Signing**: Cosign + CycloneDX

---

## Dependencies

### New Packages (with tests)

- `@react-google-charts` or `recharts` - Charts (with performance tests)
- `d3` - Mindmap/visualizations (with accessibility tests)
- `jsonwebtoken` or `bcryptjs` - Auth (with security tests)
- `exceljs` - Excel export (with unit tests)
- `jspdf` - PDF export (with unit tests)
- `@axe-core/react` - Accessibility testing
- `jest-axe` - Accessibility test assertions
- `prom-client` - Prometheus metrics (for observability)
- `cosign` - SBOM signing (via CLI)

### Database Migrations (with tests)

- `003_add_hindi_labels.sql` - Add Hindi labels to parsed_events
- `004_add_admin_users.sql` - Admin user table (if storing in DB)
- `004_add_review_feedback.sql` - Review feedback loop table
- Test migrations: `tests/database/migrations.test.ts`

---

## Success Criteria (All Must Pass)

1. ✅ All PRs 49-58 merged with CI green (all gates passing)
2. ✅ Event types display in Hindi throughout dashboard
3. ✅ Admin authentication works, tabs hidden/visible correctly
4. ✅ Review screen has AI assistant integration working
5. ✅ All 9 analytics modules display with real data in Hindi
6. ✅ Production deployment live on Vercel
7. ✅ Pipeline fully automated: Fetch → Parse → Review → Analytics
8. ✅ Public users see only Analytics, admins see all tabs
9. ✅ **Test Coverage**: Lines ≥85%, Branches ≥70% (enforced by CI)
10. ✅ **Performance**: Web LCP ≤2.5s, API p95 ≤300ms (enforced by CI)
11. ✅ **Accessibility**: WCAG 2.1 AA, zero violations (enforced by CI)
12. ✅ **Security**: No secrets, no high/critical CVEs (enforced by CI)
13. ✅ **Observability**: Structured logs, trace IDs, `/health` endpoints, Prometheus metrics
14. ✅ **All CI Gates Green**: lint-type, unit-tests, coverage-gate, security, licenses-sbom, web-a11y-perf, perf-k6, e2e-smoke
15. ✅ **CI Scorecard**: Live badge showing Green/Yellow/Red status
16. ✅ **SBOM Signing**: Cosign + CycloneDX for supply-chain integrity
17. ✅ **Auto-Rollback**: Tested and working on deployment failures
18. ✅ **Monthly Audits**: Auto-generated audit reports