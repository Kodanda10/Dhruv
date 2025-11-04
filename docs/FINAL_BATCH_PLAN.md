# Final Batch Fetch Plan: 1000+ Tweets to December 2023

**Date:** November 4, 2025  
**Status:** Ready to Execute

---

## 📊 Current Status

- **Total tweets:** 943
- **Parsed events:** 702
- **Oldest tweet:** July 10, 2025 (ID: 1943313099299180809)
- **Target date:** December 1, 2023
- **Days to cover:** 587 days
- **Estimated tweets:** ~5,870
- **Batches needed:** ~12 batches (500 tweets each)

---

## 🎯 Execution Strategy

### Pattern: Fetch → Parse → Verify → Repeat

**For each batch (500 tweets):**
1. ✅ Fetch 500 tweets (using `--until-id` from previous oldest tweet)
2. ✅ Parse batch (three-layer consensus with fallback)
3. ✅ Verify on all pages (dashboard, review, analytics)
4. ✅ Get new oldest tweet ID
5. ✅ Repeat until December 2023

---

## 📄 Pages That Must Show Data

### 1. Dashboard Home Page (`/`)
- **URL:** `http://localhost:3000/`
- **Component:** `DashboardDark.tsx`
- **API:** `GET /api/parsed-events?limit=200`
- **Status:** ✅ Already integrated - reads from database
- **What shows:** All parsed events (most recent first)
- **Auto-refresh:** Every 30 seconds

### 2. Review Page (`/review`)
- **URL:** `http://localhost:3000/review`
- **Component:** `ReviewQueue.tsx`
- **API:** `GET /api/parsed-events?needs_review=true&limit=100`
- **Status:** ✅ Already integrated - reads from database
- **What shows:** Events where `needs_review = true`
- **Features:** Approve, reject, flag, edit

### 3. Analytics Page (`/analytics`)
- **URL:** `http://localhost:3000/analytics`
- **Component:** `AnalyticsDashboardDark.tsx`
- **API:** `GET /api/analytics`
- **Status:** ⚠️ Currently reads from static JSON file
- **Action needed:** Update to read from database
- **What shows:** Event distribution, locations, schemes, timeline

---

## 🚀 Two Options for Execution

### Option 1: Automated Script (Recommended)

**Script:** `scripts/batch_fetch_to_2023.py`

```bash
python3 scripts/batch_fetch_to_2023.py \
  --handle OPChoudhary_Ind \
  --target-date 2023-12-01 \
  --verify-pages
```

**What it does:**
- Automatically gets oldest tweet ID
- Fetches 500 tweets
- Parses them
- Verifies pages (optional)
- Repeats until target date reached

**Advantages:**
- Fully automated
- Can run overnight
- Handles errors gracefully
- Can resume if interrupted

### Option 2: Manual Batch Execution

**For each batch:**

```bash
# Step 1: Get oldest tweet ID
OLDEST_ID=$(python3 -c "
import os, psycopg2
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path('.env.local'))
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
with conn.cursor() as cur:
    cur.execute('SELECT tweet_id FROM raw_tweets ORDER BY created_at ASC LIMIT 1')
    print(cur.fetchone()[0])
conn.close()
")

# Step 2: Fetch 500 tweets
python3 scripts/fetch_tweets_safe.py \
  --handle OPChoudhary_Ind \
  --max-batches 5 \
  --until-id $OLDEST_ID

# Step 3: Parse batch
python3 scripts/parse_tweets_with_three_layer.py --fallback

# Step 4: Verify pages
# - Check dashboard: http://localhost:3000/
# - Check review: http://localhost:3000/review  
# - Check analytics: http://localhost:3000/analytics
```

**Advantages:**
- More control
- Can verify each step
- Can pause between batches

---

## ⚠️ Important: Analytics API Update Needed

**Current Status:**
- Analytics API reads from `data/parsed_tweets.json` (static file)
- Needs to be updated to read from `parsed_events` table

**Action Required:**
- Update `src/app/api/analytics/route.ts` to query database
- Use same aggregation logic as `/api/parsed-events` route
- Ensure all parsed events are included in analytics

---

## 📋 Verification Checklist (After Each Batch)

### ✅ Database
- [ ] Total tweets increased
- [ ] Parsed events increased
- [ ] Oldest date moved backwards
- [ ] No duplicates

### ✅ Dashboard Home Page
- [ ] Open `http://localhost:3000/`
- [ ] Recent tweets visible
- [ ] Event types displayed
- [ ] Locations shown
- [ ] Schemes shown
- [ ] Auto-refresh working

### ✅ Review Page
- [ ] Open `http://localhost:3000/review`
- [ ] Tweets needing review appear
- [ ] Can approve/reject
- [ ] Review status updates

### ✅ Analytics Page
- [ ] Open `http://localhost:3000/analytics`
- [ ] Charts show data (after API update)
- [ ] Event distribution visible
- [ ] Location distribution visible
- [ ] Scheme usage visible
- [ ] Timeline analysis visible

---

## ⏱️ Timeline Estimate

**Per Batch:**
- Fetch: 1-2 hours (with rate limits)
- Parse: 15-30 minutes
- Verify: 5 minutes
- **Total per batch: ~2.5 hours**

**Total (12 batches):**
- **~30 hours total**

**Can run:**
- In background
- Overnight
- With interruptions (resume capability)

---

## 🎯 Summary

**Plan:**
- ✅ Fetch in batches of 500
- ✅ Parse after each batch
- ✅ Verify on all pages
- ✅ Continue until December 2023

**Pages to Verify:**
- ✅ Dashboard: Already integrated
- ✅ Review: Already integrated
- ⚠️ Analytics: Needs API update

**Ready to Execute:**
- ✅ Automation script ready
- ✅ Manual commands ready
- ✅ Verification checklist ready

---

## 🚀 Next Steps

1. **Update Analytics API** (if needed) to read from database
2. **Start Batch 1** (fetch next 500 tweets)
3. **Parse and verify**
4. **Continue with remaining batches**

---

## 📝 Quick Start Command

```bash
# Automated (recommended)
python3 scripts/batch_fetch_to_2023.py \
  --handle OPChoudhary_Ind \
  --target-date 2023-12-01 \
  --verify-pages
```

This will automatically:
- Fetch 500 tweets per batch
- Parse each batch
- Verify pages (optional)
- Continue until December 2023
- Handle all errors gracefully

**Ready to proceed!**


