# Complete Phase 5 - Analytics & UI Enhancements Plan

## Overview
This plan covers the completion of Phase 5 analytics enhancements and UI improvements, following TDD principles and the Ironclad DevOps Rulebook v2.1.

## Current Status
- ✅ **Review Page Enhancements:** COMPLETED (5/5 tasks)
  - Auto-fill dropdown suggestions ✅
  - Confidence-based color coding ✅
  - Progress sidebar ✅
  - Multi-view batch review ✅
  - Notes field ✅

- ⏳ **Analytics Enhancements:** IN PROGRESS (13/13 tasks)
- ⏳ **UI Fixes:** IDENTIFIED (1/1 task)

## Tasks

### Analytics Enhancements (13 tasks)

#### 1. D3.js Setup ✅ IN PROGRESS
- [x] Install D3.js and required dependencies
- [x] Create d3Helpers utility functions with tests
- [ ] Create time-series chart component with tests
- [ ] Create event type pie chart component with tests
- [ ] Create day-of-week pattern chart with tests

#### 2. Time-Series Charts
- [ ] Implement D3 time-series line chart
- [ ] Add date range filters (7d/30d/lifetime/custom)
- [ ] Add multi-line support for different event types
- [ ] Add zoom and pan functionality
- [ ] Add tooltips and hover effects

#### 3. Event Type Pie Charts
- [ ] Create interactive D3 pie/donut chart
- [ ] Add hover effects and animations
- [ ] Add click-to-filter functionality
- [ ] Add legend with counts and percentages
- [ ] Make responsive to container width

#### 4. Day-of-Week Patterns
- [ ] Implement day-of-week bar chart
- [ ] Add Hindi day labels (सोमवार, मंगलवार, etc.)
- [ ] Add color coding for weekdays vs weekends
- [ ] Add tooltips with detailed stats
- [ ] Show average tweets per day

#### 5. Location Heatmaps (3 Options)
- [ ] **Option A:** Bar chart with color gradients
- [ ] **Option B:** Leaflet map with markers and heatmap
- [ ] **Option C:** Custom SVG map of Chhattisgarh districts
- [ ] Create toggle component to switch between views
- [ ] Add click-to-filter functionality for all views

#### 6. Narrative Classification
- [ ] Implement narrative classification logic
- [ ] Create theme categorization (Development, Tribute, Politics, Schemes, Other)
- [ ] Display as stacked bar chart or donut chart
- [ ] Show percentages and counts
- [ ] Add filter by narrative category

#### 7. Key Insights Cards
- [ ] Create auto-generated insights system
- [ ] Generate 4-6 insight cards with trends
- [ ] Add color-coded indicators (↑ green, ↓ red)
- [ ] Refresh insights when filters change
- [ ] Add trend calculations (current vs previous period)

#### 8. Filter System
- [ ] Create global analytics filter context
- [ ] Add date range filters
- [ ] Add location filters
- [ ] Add event type filters
- [ ] Add confidence range filters
- [ ] Add review status filters
- [ ] Add URL params for sharing filtered views

#### 9. Layout Reorganization
- [ ] Reorganize AnalyticsDashboard layout
- [ ] Add sticky filters bar
- [ ] Create responsive grid layout
- [ ] Add proper spacing and typography
- [ ] Ensure mobile compatibility

### UI Fixes (1 task)

#### 1. Tag Bubble UI Implementation ⚠️ CRITICAL
- [ ] **ISSUE IDENTIFIED:** Tags are displayed using `Badge` component instead of existing `TagBubble` component
- [ ] **LOCATION:** `src/components/review/ReviewQueue.tsx` lines 667-670
- [ ] **CURRENT:** Using `<Badge key={i}>{t?.label_hi || t?.label || String(t)}</Badge>`
- [ ] **SHOULD BE:** Using `<TagBubble label={t?.label_hi || t?.label || String(t)} />`
- [ ] **ACTION:** Replace Badge with TagBubble in read-only view
- [ ] **ACTION:** Ensure TagBubble is imported and used consistently
- [ ] **ACTION:** Test tag bubble UI in both read-only and edit modes
- [ ] **ACTION:** Verify bubble-shaped tags/keywords UI (chips design) is correctly displayed

### Testing Requirements
- [ ] Write failing tests first for all new components (TDD Red phase)
- [ ] Implement minimal code to make tests pass (TDD Green phase)
- [ ] Refactor and optimize (TDD Refactor phase)
- [ ] Ensure ≥ 85% line coverage, ≥ 70% branch coverage
- [ ] Add accessibility tests (keyboard navigation, screen readers)
- [ ] Add performance tests for large datasets

### Deployment Requirements
- [ ] Test with latest 5 tweets from X/Twitter
- [ ] Ensure all components work with real data
- [ ] Verify responsive design on all devices
- [ ] Test accessibility compliance (WCAG 2.1 AA)
- [ ] Deploy to Vercel for production testing

## Priority Order
1. **CRITICAL:** Fix Tag Bubble UI Implementation (immediate)
2. **HIGH:** Complete D3.js setup and basic charts
3. **MEDIUM:** Implement advanced analytics features
4. **LOW:** Polish and optimization

## Success Criteria
- ✅ All tests passing with proper TDD coverage
- ✅ Tag bubble UI working correctly in all views
- ✅ Analytics dashboard with interactive charts
- ✅ Responsive design and accessibility compliance
- ✅ Production deployment with real tweet data
