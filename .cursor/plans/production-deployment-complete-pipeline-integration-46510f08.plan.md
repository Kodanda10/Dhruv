<!-- 46510f08-e200-498b-8106-cc4383407058 ea01b1a7-718c-43fd-8039-80c288153153 -->
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
   ```typescript
   describe('PR Status Analysis', () => {
     it('should identify failing CI checks for PRs 49-58', async () => {
       // Failing test
     });
     it('should map failures to specific files', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: Implement `scripts/analyze-pr-status.ts` to pass tests
3. **Refactor**: Improve error handling, add logging

**Files:**

- `scripts/analyze-pr-status.ts` (new)
- `tests/pr-resolution/pr-status.test.ts` (new)

### 1.2 Fix CI Failures (TDD Red→Green→Refactor)

**Acceptance Criteria:**

- [ ] AC1.4: Unit tests pass (all 242+ tests)
- [ ] AC1.5: Coverage ≥85% lines, ≥70% branches (enforced by `scripts/enforce-coverage.js`)
- [ ] AC1.6: CodeQL security scans pass (no high/critical)
- [ ] AC1.7: All Ironclad CI gates green (lint-type, unit-tests, coverage-gate, security, licenses-sbom)

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

### 1.3 Merge Strategy (TDD Validation)

**Acceptance Criteria:**

- [ ] AC1.8: All PRs merge without conflicts
- [ ] AC1.9: Post-merge CI status green
- [ ] AC1.10: No regressions introduced

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
   });
   ```

2. **Green**: Implement merge validation script
3. **Refactor**: Add conflict detection

**Files:**

- `scripts/validate-merge-order.ts` (new)
- `tests/merge-strategy/merge-validation.test.ts` (new)

---

## Phase 2: Event Type Hindi Translation System - TDD First

### 2.1 Create Translation Infrastructure (TDD)

**Acceptance Criteria:**

- [ ] AC2.1: Hindi translation map created for all event types
- [ ] AC2.2: TypeScript interfaces for translations
- [ ] AC2.3: Database migration adds `event_type_hi` column

**TDD Steps:**

1. **Red**: Create `tests/i18n/event-types-hi.test.ts`
   ```typescript
   describe('Event Type Hindi Translation', () => {
     it('should translate all event types to Hindi', () => {
       expect(translateEventType('meeting')).toBe('बैठक');
       expect(translateEventType('inauguration')).toBe('लोकार्पण');
       // ... all types
     });
     it('should handle unknown event types gracefully', () => {
       expect(translateEventType('unknown')).toBe('अन्य');
     });
   });
   ```

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

1. **Red**: Add failing tests for edge cases

   - Null/undefined handling
   - Case-insensitive matching
   - Special characters

2. **Green**: Implement translation function
3. **Refactor**: Optimize lookup performance

**Translation Map:**

```typescript
export const EVENT_TYPE_HINDI: Record<string, string> = {
  'meeting': 'बैठक',
  'review_meeting': 'समीक्षा बैठक',
  'inauguration': 'लोकार्पण',
  'condolence': 'शोक संवेदना',
  'meet_greet': 'भेंट',
  'tour': 'दौरा',
  'public_event': 'कार्यक्रम',
  'ceremony': 'समारोह',
  'scheme_announcement': 'योजना घोषणा',
  'inspection': 'निरीक्षण',
  'rally': 'रैली',
  'other': 'अन्य'
};
```

### 2.3 Update Database & API (TDD)

**Acceptance Criteria:**

- [ ] AC2.6: Migration adds `event_type_hi` column to `parsed_events`
- [ ] AC2.7: API endpoints return Hindi labels
- [ ] AC2.8: Parsing engine populates Hindi labels

**TDD Steps:**

1. **Red**: Create `tests/database/hindi-labels.test.ts`
   ```typescript
   describe('Hindi Labels in Database', () => {
     it('should store Hindi label when event_type is set', async () => {
       // Failing test
     });
     it('should retrieve Hindi label from API', async () => {
       // Failing test
     });
   });
   ```

2. **Green**: 

   - Create migration `infra/migrations/003_add_hindi_labels.sql`
   - Update `src/app/api/parsed-events/route.ts`
   - Update `src/lib/parsing/three-layer-consensus-engine.ts`

3. **Refactor**: Add validation, improve error handling

**Files to create/modify:**

- `infra/migrations/003_add_hindi_labels.sql` (new)
- `tests/database/hindi-labels.test.ts` (new)
- `src/app/api/parsed-events/route.ts`
- `src/lib/parsing/three-layer-consensus-engine.ts`

### 2.4 Update Dashboard Components (TDD)

**Acceptance Criteria:**

- [ ] AC2.9: Dashboard displays Hindi labels only
- [ ] AC2.10: Review queue shows Hindi event types
- [ ] AC2.11: Analytics dashboard uses Hindi throughout

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

### 3.1 Auth Infrastructure (TDD)

**Acceptance Criteria:**

- [ ] AC3.1: Login endpoint validates credentials securely
- [ ] AC3.2: Logout endpoint clears session
- [ ] AC3.3: Status endpoint returns auth state
- [ ] AC3.4: No secrets in code, parameterized queries

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
   });
   ```

2. **Green**: Implement auth endpoints with security
3. **Refactor**: Add rate limiting, improve error handling

**Security Requirements (from DevOps policy):**

- No secrets in code
- Parameterized queries (prevent SQL injection)
- Input/output validation
- AuthN/AuthZ on sensitive paths
- Session tokens in httpOnly cookies

**Files to create:**

- `src/lib/auth/auth.ts` (new)
- `src/app/api/auth/login/route.ts` (new)
- `src/app/api/auth/logout/route.ts` (new)
- `src/app/api/auth/status/route.ts` (new)
- `tests/api/auth/login.test.ts` (new)
- `tests/api/auth/logout.test.ts` (new)
- `tests/api/auth/status.test.ts` (new)

### 3.2 Session Management (TDD)

**Acceptance Criteria:**

- [ ] AC3.5: Session tokens stored securely (httpOnly cookies)
- [ ] AC3.6: Session expires after 24 hours
- [ ] AC3.7: LocalStorage used only for UI state (not sensitive data)

**TDD Steps:**

1. **Red**: Create `tests/auth/session-management.test.ts`
2. **Green**: Implement session management
3. **Refactor**: Add session refresh logic

**Files:**

- `src/lib/auth/session.ts` (new)
- `tests/auth/session-management.test.ts` (new)

### 3.3 UI Components (TDD)

**Acceptance Criteria:**

- [ ] AC3.8: Login button visible when not authenticated
- [ ] AC3.9: Logout button visible when authenticated
- [ ] AC3.10: Login modal handles errors gracefully
- [ ] AC3.11: Accessibility: WCAG 2.1 AA (keyboard nav, labels, contrast)

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

- [ ] AC3.12: Non-admin users see only Analytics tab
- [ ] AC3.13: Admin users see all tabs (Home, Review, Analytics)
- [ ] AC3.14: Tab visibility updates immediately on login/logout

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

### 4.1 Integrate LangGraph AI Assistant (TDD)

**Acceptance Criteria:**

- [ ] AC4.1: AI assistant connects to review screen
- [ ] AC4.2: AI provides context-aware suggestions
- [ ] AC4.3: Suggestions are displayed in review panel
- [ ] AC4.4: Performance: API response ≤300ms (p95)

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
   });
   ```

2. **Green**: Integrate LangGraph assistant
3. **Refactor**: Add caching, optimize API calls

**Performance Requirements:**

- API p95 ≤300ms (enforced by k6)
- Client-side rendering <100ms
- Use React.memo for expensive components

**Files to create:**

- `src/components/review/AIReviewAssistant.tsx` (new)
- `tests/components/review/AIReviewAssistant.test.tsx` (new)

### 4.2 Review Workflow (TDD)

**Acceptance Criteria:**

- [ ] AC4.5: Load tweets with `needs_review=true` from database
- [ ] AC4.6: Display AI suggestions alongside tweet
- [ ] AC4.7: Allow human to edit all fields (event type, locations, schemes, people)
- [ ] AC4.8: Accept/reject AI suggestions
- [ ] AC4.9: Approve/Skip/Reject with reason
- [ ] AC4.10: Updates persist to database

**TDD Steps:**

1. **Red**: Create comprehensive review workflow tests

   - `tests/integration/review-workflow.test.ts`
   - `tests/e2e/review-edit-flow.test.ts`

2. **Green**: Implement review workflow
3. **Refactor**: Add validation, improve UX

**Files to create:**

- `src/components/review/ReviewEditForm.tsx` (new)
- `src/app/api/review/update/route.ts` (new)
- `tests/integration/review-workflow.test.ts` (new)
- `tests/e2e/review-edit-flow.test.ts` (new)

### 4.3 AI Assistant Features (TDD)

**Acceptance Criteria:**

- [ ] AC4.11: Context-aware suggestions based on tweet content
- [ ] AC4.12: Accept user input for corrections
- [ ] AC4.13: Apply edits to parsed_event record
- [ ] AC4.14: Update review_status, reviewed_by, reviewed_at

**TDD Steps:**

1. **Red**: Create AI assistant integration tests

   - `tests/integration/ai-assistant-suggestions.test.ts`

2. **Green**: Integrate LangGraph assistant
3. **Refactor**: Improve suggestion quality

**Files to modify:**

- `src/components/review/ReviewQueueNew.tsx`
- `src/lib/ai-assistant/langgraph-assistant.ts`

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
   ```typescript
   describe('Event Type Analysis', () => {
     it('should display Hindi event type labels', () => {
       // Failing test
     });
     it('should filter by constituency', () => {
       // Failing test
     });
     it('should render chart within performance budget', async () => {
       // Performance test
     });
   });
   ```

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

### 5.10 Analytics API Endpoints (TDD)

**Acceptance Criteria:**

- [ ] AC5.10: All 9 API endpoints return correct data
- [ ] AC5.11: Performance: p95 ≤300ms (enforced by k6)
- [ ] AC5.12: Input validation on all endpoints
- [ ] AC5.13: Error handling for database failures

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

### 5.11 Analytics Dashboard Integration (TDD)

**Acceptance Criteria:**

- [ ] AC5.14: All 9 modules integrated into dashboard
- [ ] AC5.15: Filter section works (स्थान, विषय, दिनांक)
- [ ] AC5.16: Export buttons work (PDF, Excel, CSV)
- [ ] AC5.17: Full Hindi UI with Noto Sans Devanagari font
- [ ] AC5.18: Accessibility: WCAG 2.1 AA throughout

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

### 6.4 Vercel Deployment (TDD)

**Acceptance Criteria:**

- [ ] AC6.14: Deployment to Vercel succeeds
- [ ] AC6.15: Production URL accessible
- [ ] AC6.16: All tabs and features work in production
- [ ] AC6.17: GitHub Actions workflow triggers correctly

**TDD Steps:**

1. **Red**: Create deployment validation tests
2. **Green**: Deploy and verify
3. **Refactor**: Add monitoring

**Files to verify:**

- `.env.local` / Vercel environment variables
- `vercel.json` (if exists)
- `package.json` (build scripts)
- `.github/workflows/fetch-and-parse-tweets.yml`

### 6.5 Post-Deployment Verification (TDD)

**Acceptance Criteria:**

- [ ] AC6.18: Analytics tab visible to public (no login)
- [ ] AC6.19: Home/Review tabs hidden for non-admin
- [ ] AC6.20: Admin login works
- [ ] AC6.21: Full dashboard access after login
- [ ] AC6.22: Review screen with AI assistant works
- [ ] AC6.23: All 9 analytics modules display correctly
- [ ] AC6.24: Hindi translations throughout

**TDD Steps:**

1. **Red**: Create post-deployment E2E tests

   - `tests/e2e/post-deployment-verification.test.ts`

2. **Green**: Verify all criteria
3. **Refactor**: Add automated monitoring

**Files:**

- `tests/e2e/post-deployment-verification.test.ts` (new)

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

### Accessibility Tests (All Phases)

- **Enforcement**: axe-core in CI
- **Requirements**: WCAG 2.1 AA, zero violations
- **Test Files**: Component tests with `jest-axe`

### Security Tests (All Phases)

- **Secret Scanning**: TruffleHog in CI
- **SAST**: CodeQL in CI
- **Input Validation**: Tests for SQL injection, XSS prevention

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

### Database Migrations (with tests)

- `003_add_hindi_labels.sql` - Add Hindi labels to parsed_events
- `004_add_admin_users.sql` - Admin user table (if storing in DB)
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
13. ✅ **Observability**: Structured logs, trace IDs, `/health` endpoints
14. ✅ **All CI Gates Green**: lint-type, unit-tests, coverage-gate, security, licenses-sbom, web-a11y-perf, perf-k6, e2e-smoke

### To-dos

- [ ] Here are my recommendations only — phase-wise, concise, and focused on strengthening your plan (without repeating any part of it):