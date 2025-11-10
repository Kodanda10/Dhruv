# Plan: Fetch 500 Tweets, Parse, and Display on Review & Analytics Pages

## Overview
Fetch 500 tweets (maximum for free tier), parse them using AI, and display them on:
1. **Review Page** - For human review and approval
2. **Analytics Page** - For data visualization and insights

---

## Phase 1: Fetch 500 Tweets (Backwards from Today)

### Step 1.1: Fetch Tweets
**Script:** `scripts/fetch_tweets_safe.py`
**Command:**
```bash
source .venv/bin/activate
python3 scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind --max-batches 5
```

**Expected Behavior:**
- Fetches 5 batches × 100 tweets = 500 tweets maximum
- Uses pagination tokens to go backwards from today
- Automatically handles rate limits (may take 15 minutes to 1.25 hours)
- Stores in `raw_tweets` table with `processing_status = 'pending'`

**Success Criteria:**
- ✅ 500 tweets stored in `raw_tweets` table
- ✅ All tweets have `processing_status = 'pending'`
- ✅ No duplicate tweets (handled by ON CONFLICT DO NOTHING)
- ✅ Date range: From today backwards (most recent first)

---

## Phase 2: Parse Tweets

### Step 2.1: Identify Parsing Script
**Options Available:**
1. `scripts/parse_tweets.py` - Main Python parser
2. `scripts/parse_new_tweets.py` - For new tweets only
3. TypeScript parser via API (`/api/parse` endpoint)

### Step 2.2: Parse All Unparsed Tweets
**Recommended:** Use `scripts/parse_tweets.py` or create a batch parser

**Script to Run:**
```bash
source .venv/bin/activate
python3 scripts/parse_tweets.py
```

**Expected Behavior:**
- Finds all tweets with `processing_status = 'pending'`
- Parses each tweet using Gemini AI parser
- Extracts:
  - Event type
  - Locations
  - People mentioned
  - Organizations
  - Schemes mentioned
  - Event date
  - Confidence scores
- Stores in `parsed_events` table
- Updates `raw_tweets.processing_status = 'parsed'`

**Success Criteria:**
- ✅ All 500 tweets parsed
- ✅ `parsed_events` table contains 500 records
- ✅ Each parsed event has:
  - `tweet_id` (foreign key to `raw_tweets`)
  - `event_type`
  - `locations` (JSONB)
  - `people_mentioned`, `organizations`, `schemes_mentioned`
  - `overall_confidence`
  - `needs_review = true` (for low confidence)
  - `review_status = 'pending'`

---

## Phase 3: Display on Review Page

### Step 3.1: Verify API Endpoint
**Endpoint:** `GET /api/parsed-events?needs_review=true&limit=100`

**Current Implementation:**
- Located in `src/app/api/parsed-events/route.ts`
- Queries `parsed_events` table joined with `raw_tweets`
- Returns events that need review

### Step 3.2: Review Page Component
**Component:** `src/components/review/ReviewQueue.tsx`

**Current Behavior:**
- Fetches from `/api/parsed-events?needs_review=true&limit=100`
- Displays tweets with parsed data
- Allows human review:
  - Approve
  - Reject
  - Edit
- Updates `review_status` in database

**Verification Steps:**
1. Navigate to `/review` page
2. Verify 500 parsed tweets are visible
3. Test filtering and sorting
4. Test review actions (approve/reject/edit)

**Success Criteria:**
- ✅ Review page loads all 500 parsed tweets
- ✅ Tweets display with parsed data (event type, locations, schemes)
- ✅ Review actions update database correctly
- ✅ Filtering and sorting work

---

## Phase 4: Display on Analytics Page

### Step 4.1: Verify Analytics API
**Endpoint:** `GET /api/analytics`

**Current Implementation:**
- Located in `src/app/api/analytics/route.ts`
- Currently reads from `data/parsed_tweets.json` (static file)
- **NEEDS UPDATE:** Should read from `parsed_events` table via `/api/parsed-events`

### Step 4.2: Update Analytics API (If Needed)
**Action Required:**
- Update `/api/analytics` to query `parsed_events` table
- Aggregate data for:
  - Event type distribution
  - Location distribution
  - Scheme usage
  - Timeline (date-based aggregation)
  - Day of week analysis

### Step 4.3: Analytics Dashboard
**Component:** `src/components/analytics/AnalyticsDashboardDark.tsx`

**Current Features:**
- Time series chart
- Event type pie chart
- Day of week chart
- Location bar chart
- Location map
- Key insights cards

**Verification Steps:**
1. Navigate to `/analytics` page
2. Verify charts display data from 500 tweets
3. Test filters (time range, location, event type)
4. Verify all visualizations update correctly

**Success Criteria:**
- ✅ Analytics page loads data from 500 parsed tweets
- ✅ All charts display correctly
- ✅ Filters work and update charts
- ✅ Data is accurate and matches database

---

## Phase 5: Data Flow Verification

### Complete Data Flow:
```
1. Twitter API
   ↓
2. fetch_tweets_safe.py
   ↓
3. raw_tweets table (processing_status = 'pending')
   ↓
4. parse_tweets.py
   ↓
5. parsed_events table (review_status = 'pending')
   ↓
6. Review Page (/review)
   ↓
7. Human Review (approve/reject/edit)
   ↓
8. parsed_events table (review_status = 'approved')
   ↓
9. Analytics Page (/analytics)
```

---

## Implementation Checklist

### Pre-Fetch
- [ ] Verify `.env.local` has `X_BEARER_TOKEN` and `DATABASE_URL`
- [ ] Verify database tables exist (`raw_tweets`, `parsed_events`)
- [ ] Check current tweet count in database
- [ ] Verify rate limit status (wait if needed)

### Fetch Phase
- [ ] Run `fetch_tweets_safe.py --handle OPChoudhary_Ind --max-batches 5`
- [ ] Monitor progress (may take 15 min to 1.25 hours)
- [ ] Verify 500 tweets stored in `raw_tweets`
- [ ] Check date range (should be from today backwards)

### Parse Phase
- [ ] Identify correct parsing script
- [ ] Run parsing script for all unparsed tweets
- [ ] Verify all 500 tweets parsed
- [ ] Check `parsed_events` table has 500 records
- [ ] Verify parsing quality (confidence scores, extracted data)

### Review Page
- [ ] Navigate to `/review`
- [ ] Verify 500 parsed tweets visible
- [ ] Test filtering (by ID, status, confidence)
- [ ] Test sorting (by date, confidence)
- [ ] Test review actions (approve, reject, edit)
- [ ] Verify database updates correctly

### Analytics Page
- [ ] Check if `/api/analytics` needs update (to read from database)
- [ ] Navigate to `/analytics`
- [ ] Verify all charts display data
- [ ] Test filters (time range, location, event type)
- [ ] Verify data accuracy
- [ ] Check key insights display correctly

### Post-Implementation
- [ ] Document any issues encountered
- [ ] Update scripts if needed
- [ ] Create summary report

---

## Expected Timeline

### Fetch Phase
- **Best Case:** 15 minutes (5 requests per 15-minute window)
- **Worst Case:** 1.25 hours (1 request per 15-minute window)
- **Average:** ~30-45 minutes

### Parse Phase
- **Estimated:** 10-30 minutes (depending on API rate limits for Gemini)
- **Rate:** ~20-50 tweets per minute (if no rate limits)

### Review & Analytics
- **Immediate:** Once parsed, data should appear instantly
- **No waiting time** (database queries are fast)

**Total Estimated Time:** 45 minutes to 2 hours

---

## Risk Mitigation

### Rate Limit Risks
- ✅ **Mitigated:** Using `wait_on_rate_limit=True` in fetch script
- ✅ **Mitigated:** Fetch script handles rate limits automatically

### Parsing Errors
- ⚠️ **Risk:** Some tweets may fail to parse
- ✅ **Mitigation:** Script should continue on errors, log failures
- ✅ **Action:** Review failed tweets manually

### Database Issues
- ⚠️ **Risk:** Database connection errors
- ✅ **Mitigation:** Scripts include error handling and retries

### Review Page Issues
- ⚠️ **Risk:** Large dataset may cause performance issues
- ✅ **Mitigation:** Pagination implemented (limit=100)
- ✅ **Action:** Test with 500 tweets, optimize if needed

---

## Next Steps

1. **Review this plan** - Confirm approach
2. **Execute Phase 1** - Fetch 500 tweets
3. **Execute Phase 2** - Parse tweets
4. **Verify Phase 3** - Review page
5. **Verify Phase 4** - Analytics page
6. **Document results** - Create summary report

---

## Questions to Resolve

1. **Which parsing script to use?**
   - `parse_tweets.py` vs `parse_new_tweets.py` vs API endpoint?
   - Need to check which one is most current/complete

2. **Does `/api/analytics` read from database?**
   - Currently reads from static JSON file
   - May need to update to read from `parsed_events` table

3. **Review page pagination?**
   - Current limit is 100
   - Need to verify if pagination works for 500 tweets

---

## Ready to Proceed?

Once you approve this plan, we'll:
1. Start with Phase 1 (Fetch 500 tweets)
2. Move to Phase 2 (Parse)
3. Verify Phase 3 & 4 (Review & Analytics pages)

