# Next Tasks Outline: 100% Confidence Geo-Hierarchy Implementation

Based on the build plan: **100% Confidence Geo-Hierarchy + End-to-End Integration**

## Current Status

✅ **Completed:**
- Fixed React object rendering errors in DashboardDark
- Fixed TypeScript compilation errors (nl-parser, tools.ts)
- Dashboard data sanitization and type safety
- Three-layer consensus parsing engine with geo-extraction integration

## Phase-by-Phase Implementation Plan

### Phase 1: Data Foundations (Priority: HIGH) 🔴

**Goal:** Create authoritative dictionaries for geo-hierarchy resolution

**Tasks:**
1. **Create `data/geo_aliases.json`**
   - Structure: Map canonical location names to arrays of aliases
   - Include: Hindi variants, English transliterations, common misspellings
   - Example: `{"रायपुर": ["Raipur", "रायपूर", "रायपुरा"]}`
   - Format: `{canonical: {[key: string]: string[]}}`

2. **Create `data/ulb_wards.json`**
   - Structure: ULB (Urban Local Body) definitions with ward mappings
   - Include: Sector-to-ward mappings for नवा रायपुर
   - Format:
     ```json
     {
       "ulbs": [{"name": "नवा रायपुर नगर निगम", "wards": [...]}],
       "sector_to_ward": {"नवा रायपुर": {"सector 21": 21, ...}}
     }
     ```

3. **Augment `data/chhattisgarh_geography_clean.json`**
   - Add canonical IDs to each location entry
   - Ensure hierarchical structure (Village → GP/ULB/Ward → Block → Assembly → District)
   - Add confidence metadata for each level

4. **Add Feature Flag**
   - `config/flags.ts`: Add `GEO_STRICT_MODE` function
   - Default: `true` locally, `false` in production until rollout
   - Use environment variable: `NEXT_PUBLIC_GEO_STRICT_MODE`

**Files to Create/Modify:**
- `data/geo_aliases.json` (new)
- `data/ulb_wards.json` (new)
- `data/chhattisgarh_geography_clean.json` (modify)
- `config/flags.ts` (modify)

**Estimated Time:** 4-6 hours

---

### Phase 2: Resolver Determinism (Priority: HIGH) 🔴

**Goal:** Implement deterministic geo-hierarchy resolution with strict confidence policy

**Tasks:**
1. **Update `src/lib/geo-extraction/hierarchy-resolver.ts`**
   - Load alias dictionary on initialization
   - Create exact + alias index with canonical IDs
   - Build ULB/Ward index from `ulb_wards.json`
   - Implement `resolveWithConstraints()`: Use co-mentioned district/block to narrow candidates
   - Implement `resolveWithContext()`: Use co-locations in same tweet
   - Implement `enforceDeterminism()`: 
     - If multiple candidates after constraints → set `needs_review = true`
     - Return all candidates with scores and reasons
   - Implement confidence policy:
     - Exact match: `1.0`
     - Verified ULB/Ward: `≥0.98`
     - Alias + constraints: `≥0.95`
     - Ambiguous: `0.5-0.8` + `needs_review = true`

2. **Add Sector-to-Ward Mapping Logic**
   - Use `ulb_wards.json` sector_to_ward mapping
   - Validate sector references (e.g., "नवा रायपुर सेक्टर 21")
   - Map to correct ULB and ward number

**Files to Modify:**
- `src/lib/geo-extraction/hierarchy-resolver.ts` (major refactor)

**Tests to Add:**
- `tests/lib/geo-extraction/hierarchy-resolver.test.ts` (+15 test cases)

**Estimated Time:** 8-10 hours

---

### Phase 3: Parsing Pipeline Tightening (Priority: MEDIUM) 🟡

**Goal:** Integrate strict geo-resolution into parsing engine

**Tasks:**
1. **Update `src/lib/parsing/three-layer-consensus-engine.ts`**
   - Add strict ward/sector parser
   - Validate against `ulb_wards.json` after consensus
   - Pass disambiguation hints to resolver (district/block from tweet context)
   - Set `needs_review` and `explanations[]` when resolution not deterministic
   - Surface geo_hierarchy with confidence scores

2. **Enhance Error Handling**
   - Log when `needs_review` is triggered
   - Include candidate explanations in parsing result
   - Preserve original location text for human review

**Files to Modify:**
- `src/lib/parsing/three-layer-consensus-engine.ts`

**Tests to Add:**
- `tests/lib/parsing/three-layer-consensus-engine.test.ts` (+6 for strict ward/sector)

**Estimated Time:** 4-6 hours

---

### Phase 4: Review UI + Human-in-Loop Learning (Priority: HIGH) 🔴

**Goal:** Build UI for geo-hierarchy review and learning system

**Tasks:**
1. **Create `src/components/review/GeoHierarchyEditor.tsx`**
   - Display candidates with scores and reasons
   - Single-click confirm → sets confidence to 1.0
   - Show current hierarchy vs. suggested hierarchy
   - Visual indicators for confidence levels
   - Integration with ReviewQueueNew component

2. **Update `src/lib/dynamic-learning.ts`**
   - Add `learnGeoCorrection()` method
   - Persist corrections to `geo_corrections` table
   - Update alias maps dynamically
   - Track reviewer and timestamp

3. **Wire Editor into Review Queue**
   - Modify `src/components/review/ReviewQueueNew.tsx`
   - Show geo-hierarchy editor when `needs_review = true`
   - Update analytics upon approval

**Files to Create/Modify:**
- `src/components/review/GeoHierarchyEditor.tsx` (new)
- `src/lib/dynamic-learning.ts` (modify)
- `src/components/review/ReviewQueueNew.tsx` (modify)

**Estimated Time:** 6-8 hours

---

### Phase 5: APIs & Contracts (Priority: MEDIUM) 🟡

**Goal:** Update APIs to expose geo-hierarchy data

**Tasks:**
1. **Update `src/app/api/geo-extraction/route.ts`**
   - Add fields: `needs_review`, `candidates[]`, `explanations[]`
   - Return structured geo_hierarchy object
   - Include confidence scores per level

2. **Update `src/app/api/parsing/three-layer-consensus/route.ts`**
   - Include `geo_hierarchy` in response
   - Add `needs_review` flag
   - Include `explanations[]` array

3. **Create Geo Analytics Endpoints**
   - `src/app/api/geo-analytics/summary/route.ts`
     - GET: Aggregate by Village/GP/ULB → Block → Assembly → District
   - `src/app/api/geo-analytics/by-district/route.ts`
     - GET: Filter and aggregate by district
   - `src/app/api/geo-analytics/by-assembly/route.ts`
     - GET: Filter and aggregate by assembly constituency

**Files to Create/Modify:**
- `src/app/api/geo-extraction/route.ts` (modify)
- `src/app/api/parsing/three-layer-consensus/route.ts` (modify)
- `src/app/api/geo-analytics/summary/route.ts` (new)
- `src/app/api/geo-analytics/by-district/route.ts` (new)
- `src/app/api/geo-analytics/by-assembly/route.ts` (new)

**Tests to Add:**
- `tests/api/geo-extraction.test.ts` (+8)
- `tests/api/geo-analytics.test.ts` (+8)

**Estimated Time:** 6-8 hours

---

### Phase 6: Analytics UI (Priority: MEDIUM) 🟡

**Goal:** Build geo-analytics dashboard with drilldown capabilities

**Tasks:**
1. **Create `src/components/analytics/GeoAnalytics.tsx`**
   - Treemap visualization: District → Assembly → Block → GP/ULB/Ward
   - Drilldown interactions: Click to expand hierarchy levels
   - Filters: Date range, event type, scheme, district
   - Integration with existing AnalyticsDashboardDark

2. **Hide Legacy Cards**
   - Remove or hide old analytics cards per prior instructions
   - Focus on geo-hierarchy visualization

**Files to Create/Modify:**
- `src/components/analytics/GeoAnalytics.tsx` (new)
- `src/components/analytics/AnalyticsDashboardDark.tsx` (modify)

**Estimated Time:** 6-8 hours

---

### Phase 7: AI Assistant Tools (Priority: LOW) 🟢

**Goal:** Enhance AI Assistant with geo-validation tools

**Tasks:**
1. **Update `src/lib/ai-assistant/tools.ts`**
   - Add `validateGeoHierarchy()` tool
     - Calls resolver with strict mode
     - Returns candidates and recommended fix
   - Update `addLocation()` to consume strict resolver signals
   - Update `suggestEventType()` to use geo context

2. **Update Workflow Tests**
   - `tests/integration/ai-assistant/workflow-tests.test.ts` (+6)
   - Test human approval → persist → re-parse uses learned alias

**Files to Modify:**
- `src/lib/ai-assistant/tools.ts`

**Tests to Add:**
- `tests/integration/ai-assistant/workflow-tests.test.ts` (+6)

**Estimated Time:** 4-6 hours

---

### Phase 8: TDD & CI Gates (Priority: HIGH) 🔴

**Goal:** Comprehensive test coverage and CI integration

**Tasks:**
1. **Unit Tests** (40+ new tests)
   - `tests/lib/geo-extraction/hierarchy-resolver.test.ts` (+15)
   - `tests/api/geo-extraction.test.ts` (+8)
   - `tests/api/geo-analytics.test.ts` (+8)
   - `tests/lib/parsing/three-layer-consensus-engine.test.ts` (+6)
   - `tests/integration/ai-assistant/workflow-tests.test.ts` (+6)

2. **E2E Tests**
   - `e2e/geo-review.spec.ts` (+5 Playwright scenarios)
     - Review ambiguous geo-hierarchy
     - Confirm correction
     - Verify learning persistence
     - Test re-parsing with learned alias

3. **Performance Tests**
   - Resolver: <200ms worst-case
   - Endpoints: p95 ≤300ms

**Files to Create/Modify:**
- Multiple test files (see above)

**Estimated Time:** 8-10 hours

---

### Phase 9: Observability & Rollout (Priority: MEDIUM) 🟡

**Goal:** Add logging, metrics, and rollout gates

**Tasks:**
1. **Structured Logging**
   - Log: `chosenPath`, `candidateCount`, `constrainedBy`, `finalConfidence`
   - Include in parsing and geo-extraction flows

2. **Metrics**
   - Track: `pct_needs_review`, `avg_candidates`, `resolution_time_ms`
   - Dashboard: Monitor geo-resolution quality

3. **Rollout Strategy**
   - Enable `GEO_STRICT_MODE` only after <5% needs_review for last 1k tweets
   - Gradual rollout: Start with 10% of traffic
   - Monitor metrics before full rollout

**Files to Modify:**
- `src/lib/geo-extraction/hierarchy-resolver.ts` (add logging)
- `src/lib/parsing/three-layer-consensus-engine.ts` (add logging)
- Add metrics collection middleware

**Estimated Time:** 4-6 hours

---

## Total Estimated Time: 50-70 hours

## Recommended Implementation Order

1. **Start with Phase 1** (Data Foundations) - Enables all subsequent work
2. **Then Phase 2** (Resolver Determinism) - Core functionality
3. **Then Phase 3** (Parsing Tightening) - Integration
4. **Then Phase 4** (Review UI) - User-facing features
5. **Then Phase 5** (APIs) - Backend contracts
6. **Then Phase 6** (Analytics UI) - Visualization
7. **Then Phase 8** (TDD) - Quality assurance (can parallel with phases 4-7)
8. **Then Phase 7** (AI Tools) - Nice-to-have enhancements
9. **Finally Phase 9** (Observability) - Production readiness

## Immediate Next Steps (Today)

1. **Check dev server is running**: `npm run dev` should be accessible at `http://localhost:3000`
2. **Verify dashboard loads**: Check browser console for errors
3. **Start Phase 1**: Create `data/geo_aliases.json` and `data/ulb_wards.json`
4. **Set up feature flag**: Add `GEO_STRICT_MODE` to `config/flags.ts`

## Notes

- All work must follow TDD: Write tests first, then implement
- CI gates must pass: lint, typecheck, unit, integration, e2e
- Performance targets must be met before merging
- Feature flag allows safe rollout without breaking existing functionality

