# Dashboard Verification Guide

## Overview

This guide helps you verify that all pipeline data is visible in the dashboard.

## Current Status

### Database
- ✅ **110 raw tweets** - All fetched
- ✅ **110 parsed events** - All parsed successfully
- ✅ **5 approved events** - Ready for analytics
- ⏳ **105 needs review** - Awaiting human approval

### Dashboard Behavior

**Analytics Dashboard** (`/analytics`):
- Shows **only approved events** (currently 5)
- Filters: `needs_review = false AND review_status = 'approved'`
- This is by design - only reviewed/approved data appears in analytics

**Review Dashboard** (`/review`):
- Shows **all events needing review** (currently 105)
- Allows you to approve/reject/edit events
- After approval, events appear in analytics

## Verification Steps

### 1. Start Development Server

```bash
npm run dev
```

Server should start on `http://localhost:3000`

### 2. Check Analytics Dashboard

**URL**: `http://localhost:3000/analytics`

**What You Should See**:
- ✅ Total tweets: **5** (only approved events)
- ✅ Event distribution chart
- ✅ Location distribution
- ✅ Timeline view
- ✅ Raigarh section (if locations match)

**Why Only 5?**
- Analytics only shows **approved** events
- 105 events are still pending review
- This is intentional - ensures quality data in analytics

### 3. Check Review Dashboard

**URL**: `http://localhost:3000/review`

**What You Should See**:
- ✅ **105 events** in review queue
- ✅ Each event shows:
  - Tweet text
  - Parsed event type
  - Confidence score
  - Locations, people, organizations
- ✅ Actions: Approve, Reject, Edit

**To Approve Events**:
1. Review each event
2. Click "Approve" if correct
3. Click "Edit" to make corrections
4. Click "Reject" if incorrect
5. Approved events will appear in analytics

### 4. Verify API Endpoints

**Analytics API** (Approved Events Only):
```bash
curl http://localhost:3000/api/analytics
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "total_tweets": 5,
    "event_distribution": {...},
    "location_distribution": {...},
    ...
  }
}
```

**Parsed Events API** (All Events):
```bash
curl http://localhost:3000/api/parsed-events
```

**Expected Response**:
```json
{
  "success": true,
  "events": [
    // 110 events total
  ]
}
```

**Review Queue API** (Needs Review):
```bash
curl http://localhost:3000/api/parsed-events?needs_review=true
```

**Expected Response**:
```json
{
  "success": true,
  "events": [
    // 105 events needing review
  ]
}
```

### 5. Pipeline Health Dashboard

**Command**:
```bash
npm run ops:pipeline-health
```

**What You Should See**:
- ✅ Raw tweets: 110 total, 0 pending, 110 parsed, 0 failed
- ✅ Parsed events: 110 total
- ✅ Review status: 105 needs review, 5 approved
- ✅ Analytics ready: 5 events

## Making All Events Visible in Analytics

### Option 1: Approve Events via Review Dashboard (Recommended)

1. Go to `/review`
2. Review each event
3. Click "Approve" for correct events
4. Events will appear in analytics immediately

### Option 2: Bulk Approve High-Confidence Events

**SQL Command** (if you trust high-confidence events):
```sql
UPDATE parsed_events
SET review_status = 'approved', needs_review = false
WHERE overall_confidence >= 0.7
  AND review_status IS NULL;
```

**Then verify**:
```bash
npm run ops:pipeline-health
```

### Option 3: Auto-Approve Configuration

**Modify** `src/lib/analytics/data-source.ts`:
```typescript
// Change line 79 from:
const APPROVED_EVENT_CONDITION =
  `pe.needs_review = false AND (pe.review_status IS NULL OR pe.review_status = 'approved')`;

// To (show all parsed events):
const APPROVED_EVENT_CONDITION = `1=1`; // Show all events
```

**⚠️ Warning**: This shows unapproved events in analytics. Not recommended for production.

## Expected Dashboard Views

### Analytics Dashboard (`/analytics`)
- **Current**: 5 approved events
- **After approving all**: 110 events
- **Shows**: Charts, distributions, timeline, Raigarh section

### Review Dashboard (`/review`)
- **Current**: 105 events needing review
- **Shows**: Full review interface with approve/reject/edit

### Pipeline Health (`npm run ops:pipeline-health`)
- **Shows**: Complete pipeline statistics
- **Status**: All healthy ✅

## Quick Verification Commands

```bash
# 1. Check database status
npm run db:count-tweets

# 2. Check pipeline health
npm run ops:pipeline-health

# 3. Check review queue metrics
npm run ops:commandview

# 4. Monitor pipeline
npm run ops:monitor

# 5. Start dev server
npm run dev
```

## Troubleshooting

### Issue: Analytics shows 0 events
**Solution**: 
- Check if events are approved: `npm run ops:pipeline-health`
- Approve events via `/review` dashboard
- Verify API: `curl http://localhost:3000/api/analytics`

### Issue: Review queue shows 0 events
**Solution**:
- Check database: `npm run db:count-tweets`
- Verify API: `curl http://localhost:3000/api/parsed-events?needs_review=true`
- Check if server is running: `npm run dev`

### Issue: Dashboard not loading
**Solution**:
- Ensure server is running: `npm run dev`
- Check browser console for errors
- Verify database connection: `npm run ops:pipeline-health`

## Summary

✅ **All 110 tweets are parsed**  
✅ **All 110 parsed events exist in database**  
✅ **5 events are approved** (visible in analytics)  
⏳ **105 events need review** (visible in review dashboard)

**To see all 110 events in analytics**: Approve them via `/review` dashboard.

---

**Status**: ✅ **Pipeline working - Dashboard ready for review**


