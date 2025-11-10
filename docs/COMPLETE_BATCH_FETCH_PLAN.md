# Complete Batch Fetch Plan: 1000+ Tweets to December 2023

**Date:** November 4, 2025  
**Target:** Fetch tweets backwards from July 2025 to December 2023  
**Strategy:** Batch processing (500 tweets → parse → verify → repeat)

---

## Current Status

- **Total tweets:** 943
- **Parsed events:** 702
- **Oldest tweet:** July 10, 2025 (ID: 1943313099299180809)
- **Target date:** December 1, 2023
- **Days to cover:** 587 days
- **Estimated tweets:** ~5,870 tweets
- **Batches needed:** ~12 batches (500 tweets each)

---

## Execution Strategy

### Pattern: Fetch → Parse → Verify → Repeat

**For each batch:**
1. ✅ **Fetch 500 tweets** (using `--until-id` from previous oldest tweet)
2. ✅ **Parse batch** (using three-layer consensus with fallback)
3. ✅ **Verify on pages** (dashboard, review, analytics)
4. ✅ **Update until_id** (get new oldest tweet ID)
5. ✅ **Repeat until December 2023**

---

## Pages That Must Show Data

### 1. Dashboard Home Page (`/`)
- **Component:** `src/components/DashboardDark.tsx`
- **API:** `GET /api/parsed-events?limit=200`
- **What it shows:** All parsed events (recent first)
- **Verification:** 
  - Open `http://localhost:3000/`
  - Should show recent tweets with event types, locations, schemes
  - Updates automatically (polls every 30 seconds)

### 2. Review Page (`/review`)
- **Component:** `src/components/review/ReviewQueue.tsx`
- **API:** `GET /api/parsed-events?needs_review=true`
- **What it shows:** Events where `needs_review = true`
- **Verification:**
  - Open `http://localhost:3000/review`
  - Should show tweets needing human review
  - Can approve/reject/flag events

### 3. Analytics Page (`/analytics`)
- **Component:** `src/components/analytics/AnalyticsDashboardDark.tsx`
- **API:** `GET /api/analytics`
- **What it shows:** 
  - Event distribution
  - Location distribution
  - Scheme usage
  - Timeline analysis
- **Verification:**
  - Open `http://localhost:3000/analytics`
  - Should show charts and graphs
  - Should aggregate all parsed events

---

## Automated Batch Script

### Script: `scripts/batch_fetch_to_2023.py`

**Features:**
- ✅ Automatically gets oldest tweet ID
- ✅ Fetches 500 tweets per batch
- ✅ Parses each batch
- ✅ Verifies pages (optional)
- ✅ Continues until target date reached
- ✅ Handles errors gracefully
- ✅ Can resume if interrupted

**Usage:**
```bash
# Automatic (recommended)
python3 scripts/batch_fetch_to_2023.py \
  --handle OPChoudhary_Ind \
  --target-date 2023-12-01 \
  --verify-pages

# Manual (step by step)
# Run each batch manually for more control
```

---

## Manual Batch Execution

### Batch 1: July 2025 → June 2025

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

# Step 2: Fetch batch
python3 scripts/fetch_tweets_safe.py \
  --handle OPChoudhary_Ind \
  --max-batches 5 \
  --until-id $OLDEST_ID

# Step 3: Parse batch
python3 scripts/parse_tweets_with_three_layer.py --fallback

# Step 4: Verify
# - Check dashboard: http://localhost:3000/
# - Check review: http://localhost:3000/review
# - Check analytics: http://localhost:3000/analytics
```

### Batch 2-12: Repeat

**For each subsequent batch:**
1. Get NEW oldest tweet ID (from previous batch)
2. Fetch 500 more tweets
3. Parse them
4. Verify pages
5. Repeat

---

## Verification Checklist (After Each Batch)

### ✅ Database Verification
```bash
python3 -c "
import os, psycopg2
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path('.env.local'))
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
with conn.cursor() as cur:
    cur.execute('SELECT COUNT(*) FROM raw_tweets')
    raw = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM parsed_events')
    parsed = cur.fetchone()[0]
    cur.execute('SELECT MIN(created_at) FROM raw_tweets')
    oldest = cur.fetchone()[0]
    print(f'Raw: {raw}, Parsed: {parsed}, Oldest: {oldest}')
conn.close()
"
```

### ✅ Dashboard Verification
- Open: `http://localhost:3000/`
- Check: Recent tweets visible
- Check: Event types displayed
- Check: Locations, schemes shown
- Check: Auto-refresh working (every 30 seconds)

### ✅ Review Page Verification
- Open: `http://localhost:3000/review`
- Check: Tweets needing review appear
- Check: Can approve/reject/flag
- Check: Review status updates

### ✅ Analytics Verification
- Open: `http://localhost:3000/analytics`
- Check: Charts show data
- Check: Event distribution visible
- Check: Location distribution visible
- Check: Scheme usage visible
- Check: Timeline analysis visible

---

## Expected Timeline

| Batch | Date Range | Estimated Time | Cumulative |
|-------|------------|----------------|------------|
| 1 | July 2025 → June 2025 | 2.5 hours | 2.5 hours |
| 2 | June 2025 → May 2025 | 2.5 hours | 5 hours |
| 3 | May 2025 → April 2025 | 2.5 hours | 7.5 hours |
| 4 | April 2025 → March 2025 | 2.5 hours | 10 hours |
| 5 | March 2025 → Feb 2025 | 2.5 hours | 12.5 hours |
| 6 | Feb 2025 → Jan 2025 | 2.5 hours | 15 hours |
| 7 | Jan 2025 → Dec 2024 | 2.5 hours | 17.5 hours |
| 8 | Dec 2024 → Nov 2024 | 2.5 hours | 20 hours |
| 9 | Nov 2024 → Oct 2024 | 2.5 hours | 22.5 hours |
| 10 | Oct 2024 → Sep 2024 | 2.5 hours | 25 hours |
| 11 | Sep 2024 → Aug 2024 | 2.5 hours | 27.5 hours |
| 12 | Aug 2024 → Dec 2023 | 2.5 hours | 30 hours |

**Total Estimated Time:** ~30 hours

**Note:** Can run in background/overnight. Script handles interruptions gracefully.

---

## API Endpoints Verification

### Dashboard API
```bash
curl "http://localhost:3000/api/parsed-events?limit=10"
# Should return: { success: true, data: [...] }
```

### Review API
```bash
curl "http://localhost:3000/api/parsed-events?needs_review=true&limit=10"
# Should return: { success: true, data: [...] }
```

### Analytics API
```bash
curl "http://localhost:3000/api/analytics"
# Should return: { success: true, analytics: {...} }
```

---

## Risk Mitigation

### Rate Limits
- ✅ Script handles automatically with `wait_on_rate_limit=True`
- ✅ New token has fresh quota
- ✅ Can pause/resume anytime

### Duplicates
- ✅ `--until-id` parameter prevents duplicates
- ✅ Database constraint (`ON CONFLICT DO NOTHING`) as backup
- ✅ Verify after each batch

### Parsing Errors
- ✅ Fallback to Python orchestrator if API fails
- ✅ Errors logged, script continues
- ✅ Failed tweets marked as `error` status

### Server Issues
- ✅ Can restart Next.js server
- ✅ Parsing script waits for API
- ✅ Fallback ensures completion

### Page Verification
- ✅ APIs already integrated
- ✅ Dashboard polls every 30 seconds
- ✅ Review page shows `needs_review=true`
- ✅ Analytics aggregates all parsed events

---

## Summary

**Strategy:** Gradual batch processing (500 → parse → verify → 500 → parse → verify)  
**Target:** December 2023  
**Batches:** ~12 batches  
**Time:** ~30 hours total  
**Verification:** After each batch on all pages (dashboard, review, analytics)

**Ready to Execute:** Yes

**Next Action:** Start Batch 1 using automation script or manual commands


