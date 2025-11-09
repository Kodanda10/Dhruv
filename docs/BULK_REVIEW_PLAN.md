# Bulk Review Plan: Show All 2,576 Tweets

## Objective
Display ALL 2,576 tweets (parsed + unparsed) on:
1. **Home Table** - Show all tweets with parsing status
2. **Review Tab** - Show all tweets for human review

## Requirements
- ✅ One-time bulk review operation
- ✅ Don't disturb hourly fetch script (`scripts/fetch_new_tweets_incremental.js`)
- ✅ Keep normal operations separate from bulk review
- ✅ Show parsing status for each tweet

## Current State

### Database
- **Total Raw Tweets:** 2,576 (OPChoudhary_Ind)
- **Parsed Events:** 2,325
- **Unparsed Tweets:** 251

### Current Behavior
- **Home Dashboard:** Shows only parsed events (2,325)
- **Review Queue:** Shows only parsed events needing review
- **Hourly Fetch:** `scripts/fetch_new_tweets_incremental.js` - fetches new tweets only

## Implementation Plan

### Phase 1: Create New API Endpoint for All Tweets

**File:** `src/app/api/all-tweets/route.ts` (NEW)

**Purpose:** Return ALL raw tweets (parsed + unparsed) with parsing status

**Query Logic:**
```sql
SELECT 
  rt.tweet_id,
  rt.text as tweet_text,
  rt.created_at as tweet_created_at,
  rt.author_handle,
  rt.lang,
  -- Parsed event data (if exists)
  pe.id as parsed_event_id,
  pe.event_type,
  pe.event_type_confidence,
  pe.locations,
  pe.people_mentioned,
  pe.organizations,
  pe.schemes_mentioned,
  pe.overall_confidence,
  pe.needs_review,
  pe.review_status,
  -- Status flags
  CASE WHEN pe.id IS NOT NULL THEN true ELSE false END as is_parsed,
  CASE WHEN pe.id IS NOT NULL THEN 'parsed' ELSE 'unparsed' END as parsing_status
FROM raw_tweets rt
LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
WHERE rt.author_handle = 'OPChoudhary_Ind'
ORDER BY rt.created_at DESC
LIMIT 10000
```

**Response Format:**
```json
{
  "success": true,
  "total": 2576,
  "parsed": 2325,
  "unparsed": 251,
  "tweets": [
    {
      "tweet_id": "...",
      "tweet_text": "...",
      "tweet_created_at": "...",
      "is_parsed": true,
      "parsing_status": "parsed",
      "parsed_data": { ... }, // If parsed
      "needs_review": false
    },
    {
      "tweet_id": "...",
      "tweet_text": "...",
      "tweet_created_at": "...",
      "is_parsed": false,
      "parsing_status": "unparsed",
      "parsed_data": null,
      "needs_review": true // Unparsed tweets need review
    }
  ]
}
```

### Phase 2: Modify Home Dashboard

**File:** `src/components/Dashboard.tsx`

**Changes:**
1. Add query parameter `?bulk_review=true` to enable bulk review mode
2. When `bulk_review=true`:
   - Fetch from `/api/all-tweets` instead of `/api/parsed-events`
   - Display all 2,576 tweets
   - Show parsing status badge (Parsed/Unparsed)
   - For unparsed tweets, show minimal/default data structure
3. When `bulk_review=false` (default):
   - Use existing `/api/parsed-events` endpoint
   - Show only parsed tweets (normal operation)

**UI Changes:**
- Add parsing status column/badge
- Show "Unparsed" label for unparsed tweets
- Display tweet text even if unparsed
- Show "—" for parsed fields if unparsed

### Phase 3: Modify Review Queue

**File:** `src/components/review/ReviewQueue.tsx`

**Changes:**
1. Add query parameter `?bulk_review=true` to enable bulk review mode
2. When `bulk_review=true`:
   - Fetch from `/api/all-tweets` instead of `/api/parsed-events?needs_review=true`
   - Show ALL 2,576 tweets (parsed + unparsed)
   - Mark unparsed tweets as `needs_review: true`
   - Show parsing status in UI
3. When `bulk_review=false` (default):
   - Use existing endpoint (only parsed tweets needing review)
   - Normal review workflow

**UI Changes:**
- Add "Parsing Status" indicator (Parsed/Unparsed)
- For unparsed tweets:
  - Show empty/default form fields
  - Allow manual entry of all fields
  - Mark as "needs_review" by default
- Show count: "X parsed, Y unparsed"

### Phase 4: Add Bulk Review Toggle

**Option A: URL Parameter (Recommended)**
- Add `?bulk_review=true` to URL
- Easy to enable/disable
- No code changes needed to switch modes

**Option B: Feature Flag**
- Add to `config/flags.ts`
- Can be toggled via config

**Option C: Admin Toggle**
- Add toggle button in CommandView dashboard
- Persists in localStorage or database

**Recommendation:** Use Option A (URL parameter) for simplicity and one-time use.

### Phase 5: Handle Unparsed Tweets in UI

**For Unparsed Tweets:**
- Display tweet text
- Show "Unparsed" badge
- Default values:
  - `event_type`: "other"
  - `locations`: []
  - `people_mentioned`: []
  - `organizations`: []
  - `schemes_mentioned`: []
  - `confidence`: 0
  - `needs_review`: true
- Allow manual editing in Review Queue

**For Parsed Tweets:**
- Display as normal
- Show parsed data
- Allow editing/review as normal

## File Changes Summary

### New Files
1. `src/app/api/all-tweets/route.ts` - API endpoint for all tweets

### Modified Files
1. `src/components/Dashboard.tsx` - Add bulk review mode
2. `src/components/review/ReviewQueue.tsx` - Add bulk review mode
3. `docs/BULK_REVIEW_PLAN.md` - This document

### Unchanged Files (Protected)
- ✅ `scripts/fetch_new_tweets_incremental.js` - Hourly fetch script (NO CHANGES)
- ✅ `src/app/api/parsed-events/route.ts` - Normal API endpoint (NO CHANGES)
- ✅ All other fetch scripts (NO CHANGES)

## Testing Checklist

- [ ] API endpoint `/api/all-tweets` returns all 2,576 tweets
- [ ] Home Dashboard shows all tweets when `?bulk_review=true`
- [ ] Home Dashboard shows only parsed when `?bulk_review=false` (default)
- [ ] Review Queue shows all tweets when `?bulk_review=true`
- [ ] Review Queue shows only parsed when `?bulk_review=false` (default)
- [ ] Unparsed tweets display correctly with "Unparsed" badge
- [ ] Parsed tweets display normally
- [ ] Hourly fetch script still works (no changes)
- [ ] Normal operations unaffected

## Usage Instructions

### Enable Bulk Review Mode

**Home Dashboard:**
```
http://localhost:3000/home?bulk_review=true
```

**Review Queue:**
```
http://localhost:3000/review?bulk_review=true
```

### Disable Bulk Review Mode (Normal Operation)

**Home Dashboard:**
```
http://localhost:3000/home
```

**Review Queue:**
```
http://localhost:3000/review
```

## Implementation Order

1. ✅ Create API endpoint `/api/all-tweets/route.ts`
2. ✅ Test API endpoint returns all 2,576 tweets
3. ✅ Modify Dashboard.tsx to support bulk review mode
4. ✅ Modify ReviewQueue.tsx to support bulk review mode
5. ✅ Test both modes (bulk review and normal)
6. ✅ Verify hourly fetch script unaffected

## Notes

- This is a **one-time bulk review** operation
- Normal operations remain unchanged
- Hourly fetch script is completely separate and unaffected
- Can be easily disabled by removing `?bulk_review=true` from URL
- No database schema changes needed
- Uses existing tables (`raw_tweets` and `parsed_events`)

