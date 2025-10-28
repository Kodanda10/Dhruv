<!-- 9d1a70d9-8ecb-4a47-aa8d-2e99adcc88a1 350252eb-63e0-4bf3-9094-cf21f5858f8c -->
# Geographic Hierarchy Extraction Engine - USP Flagship Feature

## Overview

Implement intelligent geo-hierarchy extraction that automatically detects villages/blocks in tweets and resolves their complete administrative hierarchy using existing CG_Geo data. This enables powerful analytics showing leader's village/GP coverage across Assembly Constituencies.

## Phase 1: Database Schema Enhancement (2-3 hours)

### 1.1 Create Migration 003: Geographic Hierarchy Tables

**File**: `infra/migrations/003_add_geo_hierarchy.sql`

Add columns to `parsed_events`:

- `geo_hierarchy JSONB` - Store complete hierarchy for each location
- `gram_panchayats TEXT[]` - Array of GPs visited
- `ulb_wards JSONB` - Array of ULB/Ward objects for urban areas
- `blocks TEXT[]` - Deduplicated blocks
- `assemblies TEXT[]` - Deduplicated assembly constituencies
- `districts TEXT[]` - Deduplicated districts

Create `geo_corrections` table:

```sql
CREATE TABLE geo_corrections (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR REFERENCES raw_tweets(tweet_id),
    location_mentioned TEXT,
    original_hierarchy JSONB,
    corrected_hierarchy JSONB,
    corrected_by VARCHAR,
    corrected_at TIMESTAMP DEFAULT NOW()
);
```

Add indexes:

- GIN index on `geo_hierarchy` for JSONB queries
- Index on `gram_panchayats` for array containment queries
- Index on `blocks`, `assemblies`, `districts` for analytics

### 1.2 Expand CG_Geo Structure

Update `data/chhattisgarh_complete_geography.json` to include:

- Gram Panchayat (GP) level under rural blocks
- ULB (Urban Local Body) and Ward numbers for urban areas
- Mapping table for Hindi/English name variations

## Phase 2: Geo-Extraction Service (4-5 hours)

### 2.1 Create Geo-Hierarchy Resolver

**File**: `src/lib/geo-extraction/hierarchy-resolver.ts`

```typescript
interface GeoHierarchy {
  village: string;
  gram_panchayat?: string; // For rural
  ulb?: string; // For urban
  ward_no?: number; // For urban
  block: string;
  assembly: string;
  district: string;
  is_urban: boolean;
  confidence: number;
}

class GeoHierarchyResolver {
  // Load geography data with fuzzy matching support
  async resolveVillage(villageName: string): Promise<GeoHierarchy[]>
  
  // Handle ambiguous names (same village in multiple blocks)
  async resolveAmbiguousLocation(name: string, context: string): Promise<GeoHierarchy>
  
  // Support Hindi/English/transliteration variations
  async fuzzyMatch(name: string): Promise<string[]>
}
```

**Features**:

- Fuzzy matching for spelling variations
- Context-based disambiguation (use nearby locations from same tweet)
- Support for partial names (e.g., "रायपुर" could be city, GP, or village)
- Performance: < 100ms per village lookup

### 2.2 Integrate with Gemini Parser

**File**: `api/src/parsing/gemini_parser.py`

Add geo-extraction phase after initial parsing:

1. **Primary**: Gemini extracts locations and attempts hierarchy resolution
2. **Fallback**: Separate geo-extraction service validates and fills gaps
3. **Validation**: Cross-check both results for consistency

Update `parse_tweet()` to return:

```python
{
  "locations": ["रायपुर", "बिलासपुर"],
  "geo_hierarchy": [
    {
      "village": "रायपुर",
      "gram_panchayat": "रायपुर",
      "block": "रायपुर",
      "assembly": "रायपुर शहर उत्तर",
      "district": "रायपुर",
      "is_urban": true,
      "ulb": "रायपुर नगर निगम",
      "ward_no": 5
    }
  ]
}
```

### 2.3 Create Geo-Extraction API Endpoint

**File**: `src/app/api/geo-extraction/route.ts`

```typescript
POST /api/geo-extraction
Body: { locations: string[], tweetText: string }
Response: { hierarchies: GeoHierarchy[], ambiguous: AmbiguousLocation[] }
```

## Phase 3: Review Modal UI Enhancement (3-4 hours)

### 3.1 Update ReviewQueueNew Component

**File**: `src/components/review/ReviewQueueNew.tsx`

Add expandable geo-hierarchy tree display:

```tsx
<GeoHierarchyTree>
  <District>रायपुर
    <Assembly>रायपुर शहर उत्तर
      <Block>रायपुर
        <GP>रायपुर
          <Village>पंडरी
```

Features:

- Click to expand/collapse levels
- Show confidence scores per level
- Inline edit capability for corrections
- Highlight ambiguous locations in yellow
- Show urban (ULB/Ward) vs rural (GP) tags

### 3.2 Add Geo-Hierarchy Editor Modal

**File**: `src/components/review/GeoHierarchyEditor.tsx`

Inline editing with dropdowns:

- Village name (text input with autocomplete)
- GP/ULB selection (dropdown from geography data)
- Block selection (filtered by district)
- Assembly selection (filtered by district)
- District selection (dropdown)
- Urban/Rural toggle

Auto-populate dropdowns based on village selection.

### 3.3 Update AI Assistant for Geo-Hierarchy

**File**: `src/lib/ai-assistant/tools.ts`

Add new tool: `validateGeoHierarchy`

- Check if village exists in geography data
- Validate GP/Block/Assembly/District linkage
- Suggest corrections for ambiguous names
- Integrate with DynamicLearningSystem to learn corrections

## Phase 4: Analytics Dashboard Enhancement (3-4 hours)

### 4.1 Create Geo-Analytics Components

**File**: `src/components/analytics/GeoAnalytics.tsx`

**Primary View**: District-level with drill-down

```tsx
<DistrictBreakdown>
  District: रायपुर (45 villages visited)
    → Assembly: रायपुर शहर उत्तर (20 villages)
       → Block: रायपुर (12 villages)
          → GP: रायपुर (8 villages)
            → Villages: [पंडरी, कोटा, ...]
```

**Secondary View**: Assembly-first

```tsx
<AssemblyView>
  Assembly: रायपुर शहर उत्तर
    → Total Villages/GPs: 20
    → Blocks covered: 3
    → Coverage: 45% of total villages
```

### 4.2 Visualizations

Create charts using Recharts:

- **Treemap**: Hierarchical view of coverage (District → Assembly → Block → GP → Village)
- **Bar Chart**: Villages visited per Assembly Constituency
- **Heatmap**: Geographic coverage intensity
- **Timeline**: Villages visited over time

### 4.3 Analytics API Endpoints

**File**: `src/app/api/analytics/geo/route.ts`

```typescript
GET /api/analytics/geo/summary
  → { total_villages, total_gps, total_blocks, assemblies_covered }

GET /api/analytics/geo/by-district
  → District-wise breakdown with drill-down data

GET /api/analytics/geo/by-assembly
  → Assembly-wise village/GP coverage

GET /api/analytics/geo/timeline
  → Time-series data of geo coverage
```

## Phase 5: Learning System Integration (2-3 hours)

### 5.1 Update DynamicLearningSystem

**File**: `src/lib/dynamic-learning.ts`

Add methods:

```typescript
async learnGeoCorrection(
  original: GeoHierarchy,
  corrected: GeoHierarchy,
  reviewer: string
): Promise<void>

async suggestGeoHierarchy(villageName: string): Promise<GeoHierarchy[]>
```

Store corrections in:

- `geo_corrections` table (audit trail)
- In-memory cache for fast lookup
- Update geography data with new mappings

### 5.2 Auto-learn from Approvals

When human approves a parsed tweet:

1. Extract geo-hierarchy from approval
2. Compare with original parse
3. If different, store as correction
4. Update learning system weights

## Phase 6: Comprehensive E2E Testing (6-8 hours)

### 6.1 Create Test Data Generator

**File**: `tests/fixtures/geo-test-tweets.ts`

Generate 30+ test tweets covering:

**Scenario Group 1: Valid Locations (8 tests)**

- Single village mention
- Multiple villages in same block
- Multiple villages across blocks
- Mixed urban (ULB/Ward) and rural (GP/Village)

**Scenario Group 2: Ambiguous Names (6 tests)**

- Villages with same name in different blocks
- Common names (e.g., "रायपुर" - city, GP, village)
- Partial names requiring context
- Hindi/English spelling variations

**Scenario Group 3: Edge Cases (6 tests)**

- 5+ villages mentioned in single tweet
- Only block/district mentioned (no village)
- Invalid/non-existent village names
- Mixed Hindi/English/transliteration

**Scenario Group 4: Urban Locations (5 tests)**

- ULB with ward number
- ULB without ward (resolve to all wards)
- Mix of ULB and village names
- Metropolitan areas with multiple ULBs

**Scenario Group 5: Complex Hierarchies (5 tests)**

- Villages spanning multiple GPs
- Assembly boundary changes
- Historical vs current names
- Merged/split administrative units

### 6.2 Unit Tests

**File**: `tests/lib/geo-extraction/hierarchy-resolver.test.ts` (25 tests)

Test each scenario group:

- Fuzzy matching accuracy
- Disambiguation logic
- Performance benchmarks
- Error handling

**File**: `tests/lib/geo-extraction/integration.test.ts` (15 tests)

Test full parsing pipeline:

- Gemini parse → Geo-extraction → Validation
- Fallback mechanism when Gemini fails
- Learning from corrections

### 6.3 E2E Tests

**File**: `tests/e2e/geo-hierarchy/complete-workflow.test.ts` (30 tests)

For each test tweet:

1. Fetch tweet from database
2. Trigger parsing with geo-extraction
3. Verify geo_hierarchy JSONB structure
4. Open review modal and verify hierarchy display
5. Make correction and verify learning system update
6. Check analytics page for updated counts
7. Verify database consistency

### 6.4 Performance Tests

**File**: `tests/performance/geo-extraction.test.ts` (5 tests)

- Single village lookup: < 50ms
- 10 villages in one tweet: < 300ms
- Fuzzy matching: < 100ms per name
- Ambiguous resolution: < 200ms
- Analytics query (all 68 tweets): < 1s

## Phase 7: Documentation & Deployment (2-3 hours)

### 7.1 Update Documentation

**Files**:

- `docs/GEO_HIERARCHY_FEATURE.md` - Complete feature documentation
- `docs/GEO_EXTRACTION_API.md` - API reference
- `docs/GEO_TESTING_GUIDE.md` - Testing scenarios and results
- `README.md` - Add geo-hierarchy feature description
- `AGENTS.md` - Update with geo-extraction architecture

### 7.2 Update Repository Documents

**Files to update**:

- `TODO_TASKLIST.md` - Mark geo-hierarchy tasks complete
- `COMPLETED_TASKS_SUMMARY.md` - Add feature summary
- `DEPLOYMENT_STATUS.md` - Add geo-hierarchy deployment notes

### 7.3 Create Migration Guide

**File**: `docs/GEO_MIGRATION_GUIDE.md`

For existing 68 tweets:

1. Run batch geo-extraction script
2. Validate extracted hierarchies
3. Flag ambiguous cases for human review
4. Update analytics

## Implementation Order & Time Estimates

1. **Database schema** (2-3h) - Migration + indexes
2. **Geo-hierarchy resolver** (3-4h) - Core logic + fuzzy matching
3. **Parser integration** (2-3h) - Gemini + fallback
4. **Review UI** (3-4h) - Tree display + editor
5. **Analytics dashboard** (3-4h) - Charts + API
6. **Learning system** (2-3h) - Corrections + auto-learn
7. **Unit tests** (2-3h) - 40 unit tests
8. **E2E tests** (4-5h) - 30 E2E scenarios
9. **Documentation** (2-3h) - All docs + migration
10. **Batch processing** (1-2h) - Process existing 68 tweets

**Total: 24-34 hours**

## Success Criteria

- All 30 E2E test scenarios passing
- Geo-extraction accuracy > 90% (verified against manual review)
- Performance: < 300ms for tweets with 5+ villages
- Analytics dashboard shows accurate village/GP/block counts
- Human corrections integrate seamlessly into learning system
- Zero data loss during hierarchy resolution
- Clear audit trail for all geo-corrections
- Documentation complete with real examples

### To-dos

- [ ] Create migration 003 for geo_hierarchy schema enhancement
- [ ] Build GeoHierarchyResolver with fuzzy matching
- [ ] Integrate geo-extraction into Gemini parser (primary + fallback)
- [ ] Create geo-extraction API endpoint
- [ ] Update ReviewQueueNew with expandable hierarchy tree UI
- [ ] Create GeoHierarchyEditor modal component
- [ ] Add validateGeoHierarchy tool to AI Assistant
- [ ] Build GeoAnalytics dashboard component with treemap/charts
- [ ] Create geo analytics API endpoints (summary, by-district, by-assembly)
- [ ] Update DynamicLearningSystem with geo-correction learning
- [ ] Generate 30+ geo-hierarchy test tweets covering all edge cases
- [ ] Write 25 unit tests for hierarchy-resolver
- [ ] Write 15 integration tests for parsing pipeline
- [ ] Write 30 E2E tests covering complete workflow
- [ ] Write 5 performance tests for geo-extraction
- [ ] Create comprehensive feature documentation (GEO_HIERARCHY_FEATURE.md)
- [ ] Update all repository documents (README, AGENTS, TODO_TASKLIST)
- [ ] Create migration guide for existing 68 tweets
- [ ] Run batch geo-extraction on existing tweets
- [ ] Validate and deploy to production