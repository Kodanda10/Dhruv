<!-- 9d1a70d9-8ecb-4a47-aa8d-2e99adcc88a1 c329a740-411b-4a5f-ad66-afc37d03fc93 -->
# Complete Geo-Hierarchy Implementation Plan

## Phase 1: Feature Flag & Strict Mode Enforcement

### 1.1 Add GEO_STRICT_MODE Flag

**File**: `config/flags.ts`

- Add `isGeoStrictModeEnabled()` function
- Check `NEXT_PUBLIC_GEO_STRICT_MODE` env var (default: true locally, false in prod)
- Export function for resolver and parsing engine

### 1.2 Implement resolveDeterministic() in Resolver

**File**: `src/lib/geo-extraction/hierarchy-resolver.ts`

- Add `resolveDeterministic(locationName, hints?)` method
  - Calls `resolveVillage()` to get candidates
  - Applies `constrainCandidates()` with hints (district/block from tweet context)
  - If `GEO_STRICT_MODE` enabled:
    - Multiple candidates → return all with `needs_review: true`
    - Single candidate → return with confidence ≥0.98
    - No candidates → throw error
  - Returns: `{ hierarchy: GeoHierarchy | null, candidates: GeoHierarchy[], needs_review: boolean, explanations: string[] }`
- Add `enforceDeterminism()` helper
  - Sets confidence policy: exact=1.0, verified ULB/Ward≥0.98, alias+constraints≥0.95
  - Generates explanations for ambiguous cases

### 1.3 Update Parsing Engine Integration

**File**: `src/lib/parsing/three-layer-consensus-engine.ts`

- After consensus, call `geoResolver.resolveDeterministic()` for each location
- Pass disambiguation hints: extract district/block from tweet text and other locations
- If `needs_review` → set `final_result.needs_review = true` and add to `explanations`
- Update `geo_hierarchy` field with resolved hierarchies

**Files to modify:**

- `config/flags.ts` (add GEO_STRICT_MODE)
- `src/lib/geo-extraction/hierarchy-resolver.ts` (add resolveDeterministic, enforceDeterminism)
- `src/lib/parsing/three-layer-consensus-engine.ts` (integrate deterministic resolver)

---

## Phase 2: GeoHierarchyEditor Component for Review

### 2.1 Create GeoHierarchyEditor Component

**File**: `src/components/review/GeoHierarchyEditor.tsx` (new)

**Props Interface:**

```typescript
interface GeoHierarchyEditorProps {
  locationName: string;
  currentHierarchy: GeoHierarchy | null;
  candidates: GeoHierarchy[];
  needs_review: boolean;
  explanations: string[];
  onConfirm: (hierarchy: GeoHierarchy) => void;
  onReject: () => void;
}
```

**Features:**

1. **Candidate Display**

   - Show all candidates with confidence scores
   - Display hierarchy path for each: "District → Assembly → Block → GP/ULB → Village"
   - Highlight suggested match (highest confidence)
   - Show reasons for ambiguity in explanations

2. **Visual Hierarchy Tree**

   - Expandable tree view for each candidate
   - Color coding: green (exact), yellow (ambiguous), red (low confidence)

3. **One-Click Confirm**

   - Button next to each candidate: "✓ Confirm"
   - On click: calls `onConfirm(candidate)` with confidence set to 1.0
   - Visual feedback: selected candidate highlighted

4. **Custom Edit Mode**

   - Allow manual selection of district/assembly/block/GP/ULB/village
   - Dropdown selectors for each level (populated from geography data)
   - Save custom hierarchy

### 2.2 Integrate into ReviewQueueNew

**File**: `src/components/review/ReviewQueueNew.tsx`

- Detect when `needs_review = true` and `geo_hierarchy` has candidates
- Render `GeoHierarchyEditor` above the main tweet card
- On confirm: update tweet's `geo_hierarchy`, set `needs_review = false`, save to DB
- Trigger learning system after confirmation

**Files to create/modify:**

- `src/components/review/GeoHierarchyEditor.tsx` (new)
- `src/components/review/ReviewQueueNew.tsx` (integrate editor)

---

## Phase 3: Learning System for Geo Corrections

### 3.1 Add learnGeoCorrection() Method

**File**: `src/lib/dynamic-learning.ts`

**Method Signature:**

```typescript
async learnGeoCorrection(
  original: { location: string; hierarchy: GeoHierarchy | null },
  corrected: GeoHierarchy,
  reviewer: string,
  tweetId: string
): Promise<LearningResult>
```

**Implementation:**

1. Check if correction differs from original
2. If alias correction (original location → corrected canonical):

   - Add to `geo_aliases.json` via API or file update
   - Update `geo_corrections` table (if exists) or create migration

3. If ULB/ward correction:

   - Update `ulb_wards.json` mappings if applicable

4. Log correction with reviewer, timestamp, tweetId

### 3.2 Create geo_corrections Table (Migration)

**File**: `infra/migrations/XXX_add_geo_corrections.sql` (new)

- Table: `geo_corrections`
- Columns: `id`, `tweet_id`, `original_location`, `original_hierarchy` (JSONB), `corrected_hierarchy` (JSONB), `reviewer`, `created_at`
- Index on `original_location` for learning lookups

### 3.3 Wire Learning into Review Flow

**File**: `src/components/review/ReviewQueueNew.tsx`

- After user confirms geo-hierarchy in `GeoHierarchyEditor`
- Call `learningSystem.learnGeoCorrection()`
- Show success message: "✓ Geo-hierarchy correction learned"

**Files to modify:**

- `src/lib/dynamic-learning.ts` (add learnGeoCorrection)
- `infra/migrations/XXX_add_geo_corrections.sql` (new)
- `src/components/review/ReviewQueueNew.tsx` (wire learning)

---

## Phase 4: Geo Analytics Endpoints

### 4.1 GET /api/geo-analytics/summary

**File**: `src/app/api/geo-analytics/summary/route.ts` (new)

**Query Params:**

- `dateFrom`, `dateTo` (optional filters)
- `district`, `assembly`, `block` (optional filters)

**Response:**

```typescript
{
  summary: {
    totalEvents: number;
    totalDistricts: number;
    totalAssemblies: number;
    totalBlocks: number;
    totalVillages: number;
    totalULBs: number;
  };
  hierarchy: {
    districts: Array<{
      name: string;
      eventCount: number;
      assemblies: Array<{
        name: string;
        eventCount: number;
        blocks: Array<{
          name: string;
          eventCount: number;
          villages: Array<{ name: string; eventCount: number }>;
          ulbs: Array<{ name: string; eventCount: number }>;
        }>;
      }>;
    }>;
  };
}
```

**Implementation:**

- Query `parsed_events` where `review_status = 'approved'`
- Parse `locations` JSONB field to extract geo-hierarchy
- Aggregate by District → Assembly → Block → Village/ULB
- Count events at each level

### 4.2 GET /api/geo-analytics/by-district

**File**: `src/app/api/geo-analytics/by-district/route.ts` (new)

- Filter by specific district
- Return drilldown data for that district only
- Includes all assemblies, blocks, villages, ULBs within district

### 4.3 GET /api/geo-analytics/by-assembly

**File**: `src/app/api/geo-analytics/by-assembly/route.ts` (new)

- Filter by specific assembly constituency
- Return drilldown for that assembly: blocks → villages/ULBs

**Files to create:**

- `src/app/api/geo-analytics/summary/route.ts`
- `src/app/api/geo-analytics/by-district/route.ts`
- `src/app/api/geo-analytics/by-assembly/route.ts`

---

## Phase 5: Interactive Mindmap Visualization Component

### 5.1 Create GeoHierarchyMindmap Component

**File**: `src/components/analytics/GeoHierarchyMindmap.tsx` (new)

**Design Concept: Interactive Drilldown Mindmap**

**Visualization Structure:**

```
┌─────────────────────────────────────────┐
│  📍 Geo-Hierarchy Analytics (Mindmap)   │
├─────────────────────────────────────────┤
│                                         │
│  [रायगढ़] (15 events)                   │
│    ├─ [लैलूंगा] (5 events)              │
│    │   ├─ [खरसिया Block] (3 events)     │
│    │   │   ├─ Village: X (2 events)     │
│    │   │   └─ Village: Y (1 event)      │
│    │   └─ [घरघोडा Block] (2 events)      │
│    ├─ [रायगढ़] (7 events)                │
│    └─ [खरसिया] (3 events)                │
│                                         │
└─────────────────────────────────────────┘
```

**Features:**

1. **Treemap Base View**

   - Use `@visx/treemap` or `recharts` treemap
   - Root level: Districts (sized by event count)
   - Color gradient: darker = more events

2. **Click to Expand (Drilldown)**

   - Click district node → expands to show assemblies
   - Click assembly → expands to show blocks
   - Click block → expands to show villages/ULBs
   - Breadcrumb navigation: "रायगढ़ > लैलूंगा > खरसिया"

3. **Visual Indicators**

   - Event count badges on each node
   - Expand/collapse icons (▶/▼)
   - Color coding by hierarchy level
   - Hover tooltip: shows full hierarchy path + event details

4. **Filter Panel**

   - Date range picker
   - District dropdown
   - Assembly dropdown (populated based on district selection)
   - Event type filter
   - Scheme filter

5. **Export Capabilities**

   - Export current view to CSV/JSON
   - Print-friendly view

**Component Props:**

```typescript
interface GeoHierarchyMindmapProps {
  data: GeoHierarchyAnalytics; // From API
  onNodeClick?: (node: HierarchyNode) => void;
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    district?: string;
    assembly?: string;
  };
}
```

**State Management:**

- `expandedNodes: Set<string>` - Track which nodes are expanded
- `selectedNode: HierarchyNode | null` - Currently selected node for drilldown
- `viewLevel: 'district' | 'assembly' | 'block' | 'village'` - Current zoom level

**Implementation Notes:**

- Use React state for expand/collapse
- Fetch drilldown data on-demand from `/api/geo-analytics/by-district`
- Smooth transitions between views
- Responsive: works on mobile with touch interactions

### 5.2 Integrate into Analytics Dashboard

**File**: `src/components/analytics/AnalyticsDashboardDark.tsx`

- Add new tab/section: "Geo-Hierarchy Mindmap"
- Replace or complement existing LocationBarChart
- Use `GeoHierarchyMindmap` component
- Connect to filter state from `AnalyticsFilters`

**Files to create/modify:**

- `src/components/analytics/GeoHierarchyMindmap.tsx` (new)
- `src/components/analytics/AnalyticsDashboardDark.tsx` (integrate)

---

## Phase 6: AI Assistant validateGeoHierarchy Tool

### 6.1 Add Tool to AI Assistant

**File**: `src/lib/ai-assistant/tools.ts`

**Tool: validateGeoHierarchy**

- Calls `geoResolver.resolveDeterministic()` with strict mode
- Returns candidates, explanations, suggested fix
- Provides actionable recommendations

**Integration:**

- Add to `AIAssistantTools` class
- Wire into LangGraph assistant workflow
- Trigger when user asks about location ambiguity

**Files to modify:**

- `src/lib/ai-assistant/tools.ts` (add validateGeoHierarchy tool)

---

## Phase 7: Comprehensive Testing

### 7.1 Resolver Tests

**File**: `tests/lib/geo-extraction/hierarchy-resolver.test.ts`

- Test `resolveDeterministic()` with single/multiple/no candidates
- Test strict mode enforcement
- Test confidence policy application
- Test constraint-based disambiguation

### 7.2 API Tests

**Files:**

- `tests/api/geo-extraction.test.ts` (+8 tests)
- `tests/api/geo-analytics.test.ts` (new, +8 tests)

### 7.3 Component Tests

**File**: `tests/components/review/GeoHierarchyEditor.test.tsx` (new)

- Test candidate display
- Test one-click confirm
- Test custom edit mode

### 7.4 E2E Tests

**File**: `e2e/geo-review.spec.ts` (new)

- Playwright tests:
  - Review ambiguous geo-hierarchy
  - Confirm correction
  - Verify learning persistence
  - Test re-parsing with learned alias

**Files to create/modify:**

- Multiple test files (see above)

---

## Implementation Order & Dependencies

1. **Phase 1** (Feature Flag) → Enables strict mode enforcement
2. **Phase 3** (Learning System) → Required for Phase 2 (editor needs learning)
3. **Phase 2** (Review UI) → Depends on Phase 1 & 3
4. **Phase 4** (Analytics Endpoints) → Required for Phase 5
5. **Phase 5** (Mindmap Visualization) → Depends on Phase 4
6. **Phase 6** (AI Tools) → Can run parallel with other phases
7. **Phase 7** (Tests) → Run alongside each phase (TDD)

---

## Key Files Summary

**New Files:**

- `config/flags.ts` (modify: add GEO_STRICT_MODE)
- `src/lib/geo-extraction/hierarchy-resolver.ts` (modify: add resolveDeterministic)
- `src/components/review/GeoHierarchyEditor.tsx`
- `src/app/api/geo-analytics/summary/route.ts`
- `src/app/api/geo-analytics/by-district/route.ts`
- `src/app/api/geo-analytics/by-assembly/route.ts`
- `src/components/analytics/GeoHierarchyMindmap.tsx`
- `infra/migrations/XXX_add_geo_corrections.sql`
- Multiple test files

**Modified Files:**

- `src/lib/parsing/three-layer-consensus-engine.ts`
- `src/lib/dynamic-learning.ts`
- `src/components/review/ReviewQueueNew.tsx`
- `src/components/analytics/AnalyticsDashboardDark.tsx`
- `src/lib/ai-assistant/tools.ts`

---

## Success Criteria

- ✅ Feature flag controls strict geo-resolution
- ✅ Review UI shows candidates and allows one-click confirm
- ✅ Learning system persists geo corrections
- ✅ Analytics endpoints return hierarchical drilldown data
- ✅ Mindmap visualization allows interactive exploration
- ✅ 95%+ test coverage for all new code
- ✅ All CI gates pass (lint, typecheck, tests, e2e)