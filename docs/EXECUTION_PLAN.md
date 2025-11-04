# Complete Execution Plan: Parse + Fetch Next 500

**Date:** November 4, 2025  
**Status:** Ready to Execute

---

## Phase 1: Parse Current 471 Tweets ✅

### Prerequisites
- ✅ Next.js server running (for three-layer consensus API)
- ✅ Database connection configured
- ✅ 471 tweets already fetched

### Execution

**Step 1: Start Next.js Server**
```bash
# In one terminal
npm run dev
# Server should be running on http://localhost:3000
```

**Step 2: Parse Tweets**
```bash
# In another terminal
source .venv/bin/activate
python3 scripts/parse_tweets_with_three_layer.py
```

**Expected Output:**
- ✅ 471 tweets parsed
- ✅ Stored in `parsed_events` table
- ✅ `parsed_by = 'three-layer-consensus'`
- ✅ Ready for review/analytics pages

**Estimated Time:** 15-30 minutes

---

## Phase 2: Fetch Next 500 Tweets (No Duplicates) ✅

### Current Status
- **Oldest tweet ID:** `1964692971355570337`
- **Oldest tweet date:** `2025-09-07 14:11:21`
- **Next fetch:** Will fetch tweets OLDER than this ID

### Execution

**Step 1: Fetch Next 500 Tweets**
```bash
source .venv/bin/activate
python3 scripts/fetch_tweets_safe.py \
  --handle OPChoudhary_Ind \
  --max-batches 5 \
  --until-id 1964692971355570337
```

**What This Does:**
- ✅ Fetches tweets OLDER than tweet ID `1964692971355570337`
- ✅ Goes backwards in time (older tweets)
- ✅ Automatically skips duplicates via `ON CONFLICT DO NOTHING`
- ✅ Handles rate limits automatically
- ✅ Fetches 5 batches (up to 500 tweets)

**Expected Output:**
- ✅ ~500 new tweets fetched
- ✅ Total: ~971 tweets (471 + 500)
- ✅ Date range extended backwards
- ✅ No duplicates

**Estimated Time:** 1-2 hours (due to rate limits)

---

## Phase 3: Parse New Tweets ✅

**Step 1: Parse Newly Fetched Tweets**
```bash
# Next.js server should still be running
python3 scripts/parse_tweets_with_three_layer.py
```

**Expected Output:**
- ✅ ~500 additional tweets parsed
- ✅ Total: ~971 parsed tweets
- ✅ All available on review/analytics pages

**Estimated Time:** 15-30 minutes

---

## Complete Timeline

| Phase | Action | Time | Status |
|-------|--------|------|--------|
| 1 | Parse current 471 tweets | 15-30 min | Ready |
| 2 | Fetch next 500 tweets | 1-2 hours | Ready |
| 3 | Parse new 500 tweets | 15-30 min | Ready |
| **Total** | **Complete pipeline** | **2-3 hours** | **Ready** |

---

## Verification Commands

### Check Parsing Status
```bash
python3 -c "
import os
from dotenv import load_dotenv
import psycopg2
from pathlib import Path

load_dotenv(Path('.env.local'))
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
with conn.cursor() as cur:
    cur.execute('SELECT COUNT(*) FROM raw_tweets')
    raw = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM parsed_events')
    parsed = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM parsed_events WHERE parsed_by = \"three-layer-consensus\"')
    three_layer = cur.fetchone()[0]
    print(f'Raw tweets: {raw}')
    print(f'Parsed events: {parsed}')
    print(f'Three-layer parsed: {three_layer}')
conn.close()
"
```

### Check Fetch Status
```bash
python3 -c "
import os
from dotenv import load_dotenv
import psycopg2
from pathlib import Path

load_dotenv(Path('.env.local'))
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
with conn.cursor() as cur:
    cur.execute('SELECT MIN(created_at), MAX(created_at) FROM raw_tweets')
    date_range = cur.fetchone()
    cur.execute('SELECT COUNT(*) FROM raw_tweets')
    total = cur.fetchone()[0]
    print(f'Total tweets: {total}')
    print(f'Date range: {date_range[0]} to {date_range[1]}')
conn.close()
"
```

---

## Key Features

### Duplicate Prevention

**Method 1: Database Constraint**
- ✅ `ON CONFLICT DO NOTHING` prevents duplicates
- ✅ Safe to re-run fetch script
- ✅ Automatically skips existing tweets

**Method 2: until_id Parameter** (NEW)
- ✅ Fetch only tweets older than specified ID
- ✅ More efficient (fewer API calls)
- ✅ Explicit date continuity

### Rate Limit Handling

- ✅ Automatic with `wait_on_rate_limit=True`
- ✅ No manual intervention needed
- ✅ Script pauses and resumes automatically

### Error Handling

- ✅ Database errors logged, script continues
- ✅ API errors handled gracefully
- ✅ Progress saved after each batch

---

## Summary

**Ready to Execute:**
1. ✅ Parse current 471 tweets (15-30 min)
2. ✅ Fetch next 500 tweets using `--until-id` (1-2 hours)
3. ✅ Parse new 500 tweets (15-30 min)

**Total Time:** 2-3 hours

**Expected Result:**
- ~971 total tweets
- All parsed with three-layer consensus
- Available on review and analytics pages
- No duplicates


