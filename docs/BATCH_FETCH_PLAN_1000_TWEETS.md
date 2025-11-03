# Batch Fetch Plan: 1000+ Tweets to December 2023

**Date:** November 4, 2025  
**Target:** Fetch tweets backwards from July 2025 to December 2023  
**Strategy:** Batch processing (500 tweets → parse → next 500)

---

## Current Status

- **Oldest tweet:** July 10, 2025
- **Target date:** December 1, 2023
- **Days to cover:** ~588 days
- **Estimated tweets:** ~5,000-6,000 tweets
- **Batches needed:** ~10-12 batches (500 tweets each)

---

## Execution Strategy

### Pattern: Fetch → Parse → Verify → Repeat

For each batch:
1. **Fetch 500 tweets** (using `--until-id` from previous oldest tweet)
2. **Parse batch** (using three-layer consensus)
3. **Verify on pages** (dashboard, review, analytics)
4. **Update until_id** (get new oldest tweet ID)
5. **Repeat**

---

## Detailed Batch Plan

### Batch 1: July 2025 → June 2025
```bash
# Get oldest tweet ID
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

# Fetch batch 1
python3 scripts/fetch_tweets_safe.py \
  --handle OPChoudhary_Ind \
  --max-batches 5 \
  --until-id $OLDEST_ID

# Parse batch 1
python3 scripts/parse_tweets_with_three_layer.py --fallback
```

### Batch 2-12: Continue backwards
- Each batch uses the NEW oldest tweet ID as `--until-id`
- Continue until oldest tweet date < December 2023

---

## Automation Script

Create a script that:
1. Gets current oldest tweet ID
2. Fetches 500 tweets
3. Parses them
4. Verifies on dashboard
5. Repeats until target date reached

---

## Dashboard Integration

### Ensure All Pages Show Data:

1. **Dashboard Home Page:**
   - Should display all parsed events
   - API: `/api/parsed-events?limit=100`
   - Verify: Shows recent tweets

2. **Review Page:**
   - Should show `needs_review=true` events
   - API: `/api/parsed-events?needs_review=true`
   - Verify: Shows tweets needing review

3. **Analytics Page:**
   - Should aggregate all parsed events
   - API: `/api/analytics`
   - Verify: Shows event distribution, locations, schemes

---

## Verification Steps (After Each Batch)

### 1. Check Database
```bash
python3 -c "
import os, psycopg2
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path('.env.local'))
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
with conn.cursor() as cur:
    cur.execute('SELECT COUNT(*) FROM raw_tweets')
    print(f'Total tweets: {cur.fetchone()[0]}')
    cur.execute('SELECT MIN(created_at) FROM raw_tweets')
    print(f'Oldest: {cur.fetchone()[0]}')
conn.close()
"
```

### 2. Verify Dashboard
- Open: `http://localhost:3000/`
- Check: Recent tweets visible
- Check: Event types displayed

### 3. Verify Review Page
- Open: `http://localhost:3000/review`
- Check: Tweets needing review appear
- Check: Can approve/reject

### 4. Verify Analytics
- Open: `http://localhost:3000/analytics`
- Check: Charts show data
- Check: Event distribution visible

---

## Expected Timeline

| Batch | Estimated Time | Cumulative |
|-------|----------------|------------|
| 1 | 2.5 hours | 2.5 hours |
| 2 | 2.5 hours | 5 hours |
| 3 | 2.5 hours | 7.5 hours |
| ... | ... | ... |
| 10 | 2.5 hours | 25 hours |
| 11 | 2.5 hours | 27.5 hours |
| 12 | 2.5 hours | 30 hours |

**Total:** ~30 hours (can run overnight/in background)

---

## Risk Mitigation

### Rate Limits
- ✅ Script handles automatically
- ✅ New token has fresh quota
- ✅ Can pause/resume anytime

### Duplicates
- ✅ `--until-id` prevents duplicates
- ✅ Database constraint as backup
- ✅ Verify after each batch

### Parsing Errors
- ✅ Fallback to Python orchestrator
- ✅ Errors logged, continue processing
- ✅ Review failed tweets manually

### Server Issues
- ✅ Can restart Next.js server
- ✅ Parsing script waits for API
- ✅ Fallback ensures completion

---

## Next Steps

1. **Create automation script** (optional)
2. **Start Batch 1** (fetch next 500)
3. **Parse and verify**
4. **Continue with Batch 2**
5. **Repeat until December 2023**

---

## Summary

**Strategy:** Gradual batch processing (500 → parse → 500 → parse)  
**Target:** December 2023  
**Batches:** ~10-12 batches  
**Time:** ~30 hours total  
**Verification:** After each batch on all pages


