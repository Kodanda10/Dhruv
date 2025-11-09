# Dashboard Tweet Display Review

## Date: 2025-01-XX

## Issue
Dashboard currently doesn't show 2500+ tweets as expected.

## Current Database Status

### Raw Tweets
- **Total OPC Tweets:** 2,576
- **Author Handle:** `OPChoudhary_Ind`
- **Date Range:** 2025-02-14 to 2025-11-05

### Parsed Events
- **Total Parsed:** 2,325
- **Unparsed:** 251 tweets (2,576 - 2,325 = 251)
- **Skipped:** 0 tweets

## Files Reviewed

### 1. API Route: `src/app/api/parsed-events/route.ts`

**Status:** ✅ Correctly Configured

**Key Points:**
- Default limit: 5,000 (line 13)
- Maximum limit: 10,000 (line 13)
- Default filter: `WHERE rt.author_handle = 'OPChoudhary_Ind'` (line 46)
- Returns both `events` and `data` arrays for backward compatibility (lines 138-139)
- Should return all 2,325 parsed events

**Query Logic:**
```sql
SELECT pe.* FROM parsed_events pe
JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
WHERE rt.author_handle = 'OPChoudhary_Ind'
ORDER BY rt.created_at DESC
LIMIT 5000
```

**Expected Return:** All 2,325 parsed events

### 2. Dashboard Component: `src/components/Dashboard.tsx`

**Status:** ⚠️ Needs Verification

**Key Points:**
- Fetches from `/api/parsed-events?limit=5000` (line 49)
- Uses `res.events` array (line 50-51) ✅ Correct
- Filters out skipped tweets (line 152): `parsed.filter((r: any) => r.review_status !== 'skipped')`
  - **Impact:** None (0 skipped tweets in database)
- Client-side filters:
  - Location filter (line 153-155)
  - Tag filter (line 157-170)
  - Action filter (line 172-174)
  - Date range filter (line 176-189)

**Potential Issues:**
1. If API returns less than 2,325 events, dashboard will show fewer
2. Client-side filters may hide tweets if active
3. No pagination - relies on single API call

### 3. DashboardDark Component: `src/components/DashboardDark.tsx`

**Status:** ⚠️ Not Currently Used

**Key Points:**
- Uses `res.data` array (line 35, 44) - different from Dashboard.tsx
- Same limit: 5000
- Not imported in any page currently

**Note:** This component is not being used. The `/home` page uses `Dashboard.tsx`.

### 4. Page Routes

**`src/app/home/page.tsx`:**
- Uses `Dashboard` component ✅
- Requires authentication
- Redirects to `/analytics` if not authenticated

**`src/app/analytics/page.tsx`:**
- Uses `AnalyticsDashboard` component (different from Dashboard)
- No authentication required

## Root Cause Analysis

### Primary Issue: Missing Parsed Tweets
- **251 tweets are not parsed yet** (2,576 raw - 2,325 parsed = 251)
- Dashboard can only display parsed tweets
- To show 2,500+ tweets, we need to parse the remaining 251 tweets

### Secondary Issues (Potential)
1. **API Response Verification Needed:**
   - Need to verify API actually returns all 2,325 events
   - Check for any hidden filters or conditions

2. **Client-Side Filtering:**
   - Active filters may hide tweets
   - Date range filters may exclude tweets outside range

3. **Response Format Mismatch:**
   - Dashboard.tsx uses `res.events` ✅
   - DashboardDark.tsx uses `res.data` (not used)
   - API returns both formats ✅

## Recommendations

### Immediate Actions
1. ✅ **Verify API Response:** Test API endpoint to confirm it returns all 2,325 events
2. ✅ **Check Client Filters:** Ensure no active filters are hiding tweets
3. ⚠️ **Parse Remaining Tweets:** Parse the 251 unparsed tweets to reach 2,500+ count

### Code Improvements
1. **Add Debugging:**
   - Log API response count in Dashboard.tsx
   - Display total count vs displayed count
   - Show filter status

2. **Error Handling:**
   - Better error messages if API fails
   - Fallback if API returns partial data

3. **Pagination (Future):**
   - Consider pagination for better performance
   - Currently loads all tweets at once (may be slow)

## Testing Checklist

- [ ] Verify API returns all 2,325 events
- [ ] Check Dashboard displays all 2,325 tweets (no filters)
- [ ] Verify filters work correctly
- [ ] Parse remaining 251 tweets
- [ ] Verify dashboard shows 2,500+ tweets after parsing

## Fixes Applied

### 1. Added Debugging to Dashboard.tsx
- Added console logging to track API response
- Added display stats logging to track filtering
- Logs include: totalCount, shownCount, serverRowsCount, filter status

### 2. Improved API Response (`src/app/api/parsed-events/route.ts`)
- Fixed count query to match exact filter (`OPChoudhary_Ind` instead of ILIKE pattern)
- Added `returned` field to show actual count returned vs total available
- Added server-side logging for API queries
- `total` field now shows total available in database (2,325)

### 3. Enhanced Type Safety
- Updated TypeScript types to include new response fields
- Better error handling and logging

## Next Steps

1. **Parse Remaining Tweets:**
   ```bash
   python scripts/parse_tweets.py --limit 300
   ```
   This will parse the remaining 251 tweets to reach 2,500+ total.

2. **Verify Dashboard Display:**
   - Open browser console to see debug logs
   - Clear all filters (click "फ़िल्टर साफ़ करें")
   - Check console for:
     - `[Dashboard] Fetched X events from API` - should show 2,325
     - `[Dashboard] Display stats` - should show totalCount: 2,325
   - Verify count matches database count

3. **Monitor Performance:**
   - Check API response time with 2,500+ tweets
   - Consider pagination if performance degrades
   - Check browser console for any errors

## Expected Behavior After Fixes

- **Current State:** Dashboard shows 2,325 tweets (all parsed tweets)
- **After Parsing:** Dashboard will show 2,576 tweets (all raw tweets parsed)
- **API Response:** Returns all available parsed events (up to limit of 5,000)
- **Display:** Shows "दिखा रहे हैं: X / Y" where Y = total parsed tweets

