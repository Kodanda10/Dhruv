<!-- 9d1a70d9-8ecb-4a47-aa8d-2e99adcc88a1 9ac54205-3e77-44b2-8851-22f57df1f3ca -->
# Fix Dashboard Issues & Automated Tweet Pipeline (TDD-First, FANG-Level Quality)

## Git Worktree Strategy

**Branch**: `feat/dashboard-fixes-automated-pipeline`

**Worktree Path**: `../Project_Dhruv_pipeline`

```bash
# Create isolated worktree
git worktree add ../Project_Dhruv_pipeline feat/dashboard-fixes-automated-pipeline

# Work in isolation
cd ../Project_Dhruv_pipeline

# All development happens here until CI green
```

**Branch Protection**: Require all Ironclad gates before merge to main

---

## Automated Pipeline Architecture

```
┌─────────────┐
│ Fetch Tweets│ (fetch_5_latest_tweets_final.py)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Parse (Gemini│ (gemini_parser.py + SOTA context)
│   + SOTA)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Store in DB │ (PostgreSQL raw_tweets + parsed_events)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Review Queue │ (ReviewQueueNew.tsx - needs_review=true)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Human Review │ (Edit + Approve via AI Assistant)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Update Status│ (review_status='approved')
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Reflect Back │ (Home table + Analytics dashboard)
└─────────────┘
```

**Key Principles**:

- Every component has failing tests BEFORE implementation
- Coverage: lines ≥85%, branches ≥70%
- All API endpoints have contract tests (PACT)
- E2E tests for complete pipeline
- Performance tests (k6): p95 ≤300ms
- Accessibility tests (axe-core): WCAG 2.1 AA
- Feature flagged with instant rollback

---

## Phase 1: Pipeline Foundation & Critical Fixes (Atomic Tasks)

### Task 1.1: Center-Align Table Headers (2h)

**File**: `src/components/DashboardDark.tsx`

**Test File**: `tests/components/DashboardDark.test.tsx`

**TDD Red→Green→Refactor**:

1. **RED**: Write failing test
```typescript
it('should center-align all table headers', () => {
  render(<DashboardDark />);
  const headers = screen.getAllByRole('columnheader');
  headers.forEach(header => {
    expect(header).toHaveClass('text-center');
  });
});
```

2. **GREEN**: Add `text-center` class to all `<th>` elements
3. **REFACTOR**: Extract header component if needed

**Acceptance**:

- ✅ Test passes
- ✅ Visual verification: all headers centered
- ✅ No layout shifts (CLS ≤ 0.1)

### Task 1.2: Sortable Table Headers (4h)

**File**: `src/components/DashboardDark.tsx`

**Test File**: `tests/components/DashboardDark.test.tsx`

**TDD Red→Green→Refactor**:

1. **RED**: Write failing tests
```typescript
describe('Table sorting', () => {
  it('should sort by date ascending when date header clicked', () => {
    render(<DashboardDark />);
    const dateHeader = screen.getByText(/दिन \/ दिनांक/);
    fireEvent.click(dateHeader);
    const rows = screen.getAllByRole('row');
    // Assert oldest first
  });

  it('should toggle to descending on second click', () => {
    render(<DashboardDark />);
    const dateHeader = screen.getByText(/दिन \/ दिनांक/);
    fireEvent.click(dateHeader);
    fireEvent.click(dateHeader);
    // Assert newest first
  });

  it('should show sort indicators (↑↓)', () => {
    render(<DashboardDark />);
    const dateHeader = screen.getByText(/दिन \/ दिनांक/);
    fireEvent.click(dateHeader);
    expect(screen.getByText('↑')).toBeInTheDocument();
  });
});
```

2. **GREEN**: Implement sort state and handlers
3. **REFACTOR**: Extract useSortableTable hook

**Acceptance**:

- ✅ All tests pass
- ✅ Sort works for: date, location, event type
- ✅ Visual indicators clear
- ✅ Keyboard accessible (Enter/Space to sort)

### Task 1.3: Real-Time Tweet Refresh (3h)

**File**: `src/components/DashboardDark.tsx`

**Test File**: `tests/components/DashboardDark.test.tsx`

**TDD Red→Green→Refactor**:

1. **RED**: Write failing tests
```typescript
it('should poll API every 30 seconds', async () => {
  jest.useFakeTimers();
  const mockGet = jest.fn().mockResolvedValue({ success: true, data: [] });
  render(<DashboardDark />);
  
  expect(mockGet).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(30000);
  expect(mockGet).toHaveBeenCalledTimes(2);
});

it('should show notification when new tweets detected', async () => {
  // Mock API returning new count
  render(<DashboardDark />);
  await waitFor(() => {
    expect(screen.getByText(/new tweets available/i)).toBeInTheDocument();
  });
});
```

2. **GREEN**: Add polling with useEffect + setInterval
3. **REFACTOR**: Extract usePolling hook

**Acceptance**:

- ✅ Tests pass
- ✅ Polls every 30s
- ✅ Shows visual indicator for new data
- ✅ No memory leaks (cleanup on unmount)

---

## Phase 2: Automated Parsing Pipeline (SOTA Integration)

### 1.1 Home Table Enhancements

**File**: `src/components/DashboardDark.tsx`

- Add center text alignment to table headers: `दिन / दिनांक`, `स्थान`, `दौरा / कार्यक्रम`, `कौन/टैग`, `विवरण`
- Implement sortable table headers with click handlers
  - Add state: `sortField`, `sortOrder` ('asc' | 'desc')
  - Add sort icons (↑↓) next to headers
  - Implement sort logic for date (timestamp), location, event type
- Ensure real-time data refresh shows all 64 tweets from database
  - Fix API polling to check for new tweets every 30 seconds
  - Add visual indicator when new tweets are detected

### 1.2 Review Page Edit Modal Improvements

**File**: `src/components/review/ReviewQueueNew.tsx`

- Display current parsed data in right panel of AI Assistant modal:
  - Event type: show current value with inline edit dropdown
  - Location: show current array with add/remove chips
  - People: show current array with add/remove chips
  - Organizations: show current array with add/remove chips
  - Schemes: show current array with add/remove chips
- Add inline editing components:
  - Event type dropdown with Hindi labels
  - Autocomplete inputs for locations (from existing data)
  - Chip inputs for people/orgs/schemes with add/remove
- Wire "Save" button to update tweet via `/api/parsed-events` PUT endpoint
- Add visual feedback (success/error toasts)

### 1.3 AI Assistant Context Enhancement (Phase 1)

**File**: `src/app/api/ai-assistant/route.ts`

- Enhance Gemini prompt with structured system instructions:
  - Role: "Expert tweet analyst for political activities in Chhattisgarh"
  - Context: Provide complete tweet data including existing parsed fields
  - Task: Analyze and suggest improvements to event_type, locations, people, organizations, schemes
  - Format: Respond in Hindi with actionable suggestions
- Add conversation history tracking (last 5 messages) for context
- Improve error handling and fallback responses
- Use Gemini 1.5 Pro for better reasoning (upgrade from Flash)

---

## Phase 2: Automatic Parsing Pipeline (SOTA Integration - Feature Flagged)

### 2.1 Post-Fetch Parsing Hook

**Files**: `fetch_5_latest_tweets_final.py`, `scripts/parse_new_tweets.py`

- Add automatic parsing call after tweet insertion:
  - Create `scripts/parse_new_tweets.py` using existing `gemini_parser.py`
  - Parse tweets immediately after fetch in sync process
  - Update `parsed_tweets` table with results
  - Flag: `AUTO_PARSE_ON_FETCH` (default: true)
- Add rate limiting (2 sec delay between Gemini calls)
- Add retry logic with exponential backoff
- Log parsing results to console and database

### 2.2 Parsing Quality Improvements

**File**: `gemini_parser.py`

- Enhance prompts with SOTA v3.5 TEXT-FIRST principles:
  - Add Chhattisgarh geography context (districts, blocks, villages)
  - Add political context (BJP, Congress, local leaders)
  - Add scheme context (state and central schemes)
  - Add event type taxonomy (Meeting, Rally, Inspection, etc.)
- Implement confidence scoring (0.0-1.0)
- Add `needs_review` flag for low-confidence parses (<0.7)
- Add provenance tracking (`parsed_by: 'gemini-1.5-flash'`, `parsed_at: timestamp`)

### 2.3 Database Schema Updates

**File**: `infra/migrations/003_add_parsing_metadata.sql`

- Add columns to `raw_tweets` table:
  - `parsed_at TIMESTAMP`
  - `parsed_by VARCHAR(100)` (model name)
  - `parsing_confidence FLOAT`
  - `needs_review BOOLEAN DEFAULT false`
- Create index on `needs_review` for review queue filtering
- Migrate existing data (set `needs_review=true` for all existing tweets)

---

## Phase 3: LangGraph AI Assistant (Advanced Context & Actions)

### 3.1 LangGraph Agent Setup

**Files**: `src/app/api/ai-assistant-v2/route.ts`, `api/src/langgraph/tweet_editor_agent.py`

- Install dependencies: `langgraph`, `langchain`, `langchain-google-genai`
- Create Python LangGraph agent with tools:
  - **Tool 1**: `get_similar_locations(query)` - search existing locations via fuzzy match
  - **Tool 2**: `get_event_types()` - return valid event types with Hindi labels
  - **Tool 3**: `get_schemes(query)` - search government schemes
  - **Tool 4**: `update_tweet_field(tweet_id, field, value)` - make actual edits
  - **Tool 5**: `get_location_hierarchy(place)` - validate geography (district → block → village)
- Implement conversation memory (last 10 turns)
- Add state graph: Input → Analyze → Tools → Respond → Update

### 3.2 Agent API Integration

**File**: `src/app/api/ai-assistant-v2/route.ts`

- Create new endpoint `/api/ai-assistant-v2` (feature flagged)
- Call Python LangGraph agent via subprocess or HTTP
- Stream responses back to frontend
- Handle tool execution results
- Add comprehensive error handling
- Flag: `ENABLE_LANGGRAPH_ASSISTANT` (default: false)

### 3.3 Frontend Integration

**File**: `src/components/review/AIAssistantModal.tsx`

- Add toggle to switch between basic and advanced AI assistant
- Show tool execution status in chat ("Searching locations...", "Updating tweet...")
- Display tool results as structured messages
- Add undo functionality for AI-made edits
- Graceful fallback to basic assistant if LangGraph fails

---

## Phase 4: SOTA Parsing Engine Integration (Full Pipeline)

### 4.1 Enable SOTA Dataset Builders

**Reference**: TODO_TASKLIST.md Epic I5 (already completed)

- Geography dataset builder (State→District→AC→Block→GP→Village)
- Festival dataset builder (lunar/solar with year_dates)
- POI dataset builder (temples, venues with lat/lon)
- Schemes dataset builders (Chhattisgarh + Central Govt)
- ETL pipeline with checksum validation
- **Status**: Already implemented, need to enable flag: `ENABLE_SOTA_DATASET_BUILDER=true`

### 4.2 Semantic Linking & Milvus Integration

**Reference**: TODO_TASKLIST.md Epic I6

- Enable deterministic linker (exact/alias/phonetic matches)
- Enable semantic linker (Milvus Top-K with embeddings)
- Add disambiguation logic (hierarchy consistency, geo proximity)
- **Prerequisites**: 
  - Milvus container running (already in docker-compose.yml)
  - Embeddings generated for Hindi variants
- **Flag**: `ENABLE_SOTA_POST_PARSER=true` (enable after testing)

### 4.3 Enhanced Parser & Event JSON

**Reference**: TODO_TASKLIST.md Epic I7

- Wire SOTA parser to existing `gemini_parser.py`
- Add context inference (what/why/where/when, festival detection)
- Generate normalized Event JSON (SOTA schema-compliant)
- Add low-confidence safety notes + review_required logic
- Wire to `/api/sota/parse` endpoint (flag-gated)
- **Timeline**: Implement after Phase 3 is stable

---

## Implementation Strategy

### Rollout Plan

1. **Week 1**: Phase 1 (Dashboard fixes) - Deploy immediately
2. **Week 2**: Phase 2 (Auto-parsing) - Test with flag off, enable gradually
3. **Week 3**: Phase 3 (LangGraph) - Beta test with power users
4. **Week 4+**: Phase 4 (SOTA full pipeline) - Incremental rollout with monitoring

### Feature Flags

```typescript
// config/flags.ts
export const flags = {
  AUTO_PARSE_ON_FETCH: true,          // Phase 2
  ENABLE_LANGGRAPH_ASSISTANT: false,  // Phase 3
  ENABLE_SOTA_DATASET_BUILDER: false, // Phase 4
  ENABLE_SOTA_POST_PARSER: false,     // Phase 4
  ENABLE_VISION: false,                // Future
  ENABLE_VIDEO: false,                 // Future
};
```

### Deployment Safety

- All phases feature-flagged
- Canary deployments (1% → 10% → 50% → 100%)
- Rollback ≤10 minutes via flag toggle
- Comprehensive monitoring (RED metrics, error rates)
- Alerts for parsing failures, API latency spikes

### Testing Requirements

- **Unit tests**: Coverage ≥85% lines, ≥70% branches
- **Integration tests**: API endpoints, database operations
- **E2E tests**: Complete user workflows (fetch → parse → review → edit)
- **Performance tests**: k6 API tests, p95 ≤300ms
- **Accessibility tests**: axe-core WCAG 2.1 AA compliance

---

## Success Criteria

### Phase 1 (Dashboard Fixes)

- ✅ Table headers center-aligned and sortable
- ✅ All 64 tweets visible in home table
- ✅ Edit modal shows current parsed data
- ✅ Inline editing functional with save confirmation
- ✅ AI assistant provides contextual suggestions

### Phase 2 (Auto-Parsing)

- ✅ New tweets parsed within 5 seconds of fetch
- ✅ Parsing confidence >0.8 for 80% of tweets
- ✅ Zero impact on tweet fetch performance
- ✅ Graceful degradation if Gemini API fails

### Phase 3 (LangGraph)

- ✅ Agent uses tools to enhance suggestions
- ✅ Location validation via hierarchy check
- ✅ Direct edits from AI assistant with user confirmation
- ✅ Conversation context maintained across turns

### Phase 4 (SOTA Full)

- ✅ Semantic linking accuracy >90%
- ✅ Event JSON schema compliance 100%
- ✅ Review queue shows only low-confidence tweets
- ✅ Full observability (traces, metrics, logs)

---

## Risk Mitigation

1. **Parsing Failures**: Fallback to basic extraction, flag for manual review
2. **API Rate Limits**: Implement exponential backoff, queue system
3. **Data Quality**: Validation pipeline, human review for confidence <0.7
4. **Performance**: Async processing, caching, connection pooling
5. **Rollback**: All features behind flags, instant disable capability

### To-dos

- [ ] Center-align table headers in DashboardDark.tsx
- [ ] Implement sortable table headers with click handlers and sort icons
- [ ] Ensure all 64 tweets from database are displayed and add real-time refresh
- [ ] Show current parsed data in AI Assistant modal right panel with inline editing
- [ ] Create inline editing components (dropdowns, autocomplete, chips) for parsed fields
- [ ] Connect Save button to PUT /api/parsed-events with visual feedback
- [ ] Upgrade AI Assistant prompt with structured context and Gemini 1.5 Pro
- [ ] Add conversation history tracking (last 5 messages) to AI Assistant
- [ ] Create post-fetch parsing hook in fetch_5_latest_tweets_final.py
- [ ] Improve gemini_parser.py with SOTA context (geography, schemes, events)
- [ ] Add database migration for parsing metadata columns
- [ ] Create LangGraph agent with tools (locations, event types, schemes, updates)
- [ ] Create /api/ai-assistant-v2 endpoint with subprocess/HTTP to Python agent
- [ ] Add toggle in AIAssistantModal for basic vs advanced assistant
- [ ] Enable ENABLE_SOTA_DATASET_BUILDER flag and verify ETL pipeline
- [ ] Enable Milvus semantic linker and test disambiguation logic
- [ ] Wire SOTA parser to /api/sota/parse endpoint with Event JSON output