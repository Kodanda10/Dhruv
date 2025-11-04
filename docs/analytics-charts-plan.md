# Analytics Charts Plan - Project Dhruv

## Overview
Transform the current basic analytics page into a comprehensive dashboard with interactive charts and visualizations for social media analytics.

## Charts to Implement

### 1. 📊 Event Type Distribution (Pie Chart)
- **Purpose**: Show distribution of different event types (जन्मदिन शुभकामनाएं, बैठक, रैली, etc.)
- **Chart Type**: Pie Chart with Donut option
- **Data**: Count of tweets by event type
- **Interactive**: Click to filter Home tab by event type

### 2. 📈 Timeline Analysis (Line Chart)
- **Purpose**: Show tweet activity over time
- **Chart Type**: Line Chart with multiple series
- **Data**: Daily/weekly tweet counts, confidence scores over time
- **Interactive**: Zoom, pan, hover for details

### 3. 🗺️ Geographic Distribution (Map/Bar Chart)
- **Purpose**: Show activity by location (District, State level)
- **Chart Type**: Horizontal Bar Chart (sorted by count)
- **Data**: Tweet counts by location hierarchy
- **Interactive**: Click to drill down or filter

### 4. 📊 Confidence Score Analysis (Histogram)
- **Purpose**: Show distribution of parsing confidence scores
- **Chart Type**: Histogram/Bar Chart
- **Data**: Confidence score ranges (0-1) with counts
- **Interactive**: Show statistics (mean, median, std dev)

### 5. 🏷️ Tags & Mentions Cloud (Word Cloud)
- **Purpose**: Visual representation of most frequent tags/mentions
- **Chart Type**: Word Cloud or Tag Cloud
- **Data**: Frequency of tags, mentions, organizations
- **Interactive**: Click to filter by tag

### 6. 📈 Review Status Trends (Stacked Bar Chart)
- **Purpose**: Show review progress over time
- **Chart Type**: Stacked Bar Chart
- **Data**: Pending, Approved, Edited, Skipped counts over time
- **Interactive**: Toggle series visibility

### 7. 🎯 Parsing Accuracy Metrics (Gauge Charts)
- **Purpose**: Show key performance indicators
- **Chart Type**: Gauge/Radial Progress Charts
- **Data**: Overall accuracy, review completion rate, processing speed
- **Interactive**: Animated progress indicators

## Technical Implementation

### Chart Library: Chart.js + React-Chartjs-2
- **Reason**: Well-supported, responsive, good accessibility
- **Alternative**: Recharts (React-native, simpler API)

### Data Processing
- **Real-time**: Use WebSocket or polling for live updates
- **Caching**: Implement data caching for performance
- **Aggregation**: Pre-compute aggregations on backend

### Responsive Design
- **Mobile**: Simplified charts, touch-friendly interactions
- **Tablet**: Medium complexity charts
- **Desktop**: Full-featured charts with all interactions

### Performance Considerations
- **Lazy Loading**: Load charts on demand
- **Data Pagination**: Handle large datasets efficiently
- **Memory Management**: Clean up chart instances

## File Structure
```
src/
├── components/
│   └── analytics/
│       ├── AnalyticsDashboard.tsx (main container)
│       ├── charts/
│       │   ├── EventTypeChart.tsx
│       │   ├── TimelineChart.tsx
│       │   ├── LocationChart.tsx
│       │   ├── ConfidenceChart.tsx
│       │   ├── TagsCloud.tsx
│       │   ├── ReviewStatusChart.tsx
│       │   └── MetricsGauges.tsx
│       ├── filters/
│       │   ├── DateRangeFilter.tsx
│       │   ├── LocationFilter.tsx
│       │   └── EventTypeFilter.tsx
│       └── utils/
│           ├── chartHelpers.ts
│           └── dataProcessors.ts
```

## Data Requirements

### API Endpoints Needed
- `GET /api/analytics/events-distribution`
- `GET /api/analytics/timeline`
- `GET /api/analytics/locations`
- `GET /api/analytics/confidence-scores`
- `GET /api/analytics/tags-frequency`
- `GET /api/analytics/review-status`

### Data Format
```typescript
interface AnalyticsData {
  eventTypes: { label: string; count: number; percentage: number }[];
  timeline: { date: string; count: number; confidence: number }[];
  locations: { name: string; count: number; hierarchy: string }[];
  confidence: { range: string; count: number }[];
  tags: { tag: string; count: number; type: 'mention' | 'hashtag' | 'organization' }[];
  reviewStatus: { date: string; pending: number; approved: number; edited: number; skipped: number }[];
}
```

## Implementation Phases

### Phase 1: Basic Charts (Week 1)
- [ ] Event Type Distribution (Pie Chart)
- [ ] Geographic Distribution (Bar Chart)
- [ ] Basic data processing utilities

### Phase 2: Time-based Analysis (Week 2)
- [ ] Timeline Analysis (Line Chart)
- [ ] Review Status Trends (Stacked Bar)
- [ ] Date range filters

### Phase 3: Advanced Analytics (Week 3)
- [ ] Confidence Score Analysis
- [ ] Tags & Mentions Cloud
- [ ] Performance metrics gauges

### Phase 4: Polish & Optimization (Week 4)
- [ ] Responsive design improvements
- [ ] Performance optimization
- [ ] Accessibility enhancements
- [ ] Export functionality

## Success Metrics
- **Performance**: Charts load in <2 seconds
- **Usability**: Intuitive interactions, clear visualizations
- **Accessibility**: Screen reader compatible, keyboard navigation
- **Responsiveness**: Works on all device sizes
- **Data Accuracy**: Real-time updates, consistent with source data

## Future Enhancements
- **Real-time Updates**: WebSocket integration for live data
- **Export Features**: PDF/PNG export of charts
- **Custom Dashboards**: User-configurable chart layouts
- **Advanced Filtering**: Multi-dimensional filtering
- **Predictive Analytics**: ML-based trend predictions
