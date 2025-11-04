# Parse Current Tweets & Fetch Next 500 - Execution Plan

**Date:** November 4, 2025  
**Status:** Ready to Execute

---

## Phase 1: Parse Current 471 Tweets ✅

### Objective
Parse all 471 fetched tweets using three-layer consensus engine.

### Steps

1. **Verify Next.js Server is Running**
   ```bash
   # Check if server is running
   curl http://localhost:3000/api/health
   
   # If not, start it:
   npm run dev
   ```

2. **Parse All Pending Tweets**
   ```bash
   source .venv/bin/activate
   python3 scripts/parse_tweets_with_three_layer.py
   ```

3. **Verify Parsing Results**
   ```bash
   # Check parsing status
   python3 -c "
   import os
   from dotenv import load_dotenv
   import psycopg2
   from pathlib import Path
   
   load_dotenv(Path('.env.local'))
   conn = psycopg2.connect(os.getenv('DATABASE_URL'))
   with conn.cursor() as cur:
       cur.execute('SELECT COUNT(*) FROM parsed_events WHERE parsed_by = \"three-layer-consensus\"')
       print(f'Parsed: {cur.fetchone()[0]} tweets')
   conn.close()
   "
   ```

### Expected Outcome
- ✅ 471 tweets parsed with three-layer consensus
- ✅ Data stored in `parsed_events` table
- ✅ Ready for review and analytics pages

---

## Phase 2: Fetch Next 500 Tweets (No Duplicates) ✅

### Objective
Fetch 500 additional tweets from BEFORE the oldest current tweet (going backwards in time).

### Current Status
- **Oldest tweet fetched:** 2025-09-07 (Tweet ID: 1968857351357706384)
- **Newest tweet fetched:** 2025-11-03
- **Next fetch should start:** Before 2025-09-07

### Solution: Use `until` Parameter

The `fetch_tweets_safe.py` script needs to be modified to:
1. Accept an `--until` parameter (ISO date string)
2. Use it in the API call to fetch tweets before that date
3. This ensures no duplicates

### Implementation

#### Option 1: Modify Existing Script (Recommended)

Add `until` parameter support to `fetch_tweets_safe.py`:

```python
# In fetch_all_tweets_safe function, add:
until_date = kwargs.get('until')  # ISO format: '2025-09-07T00:00:00Z'

# In the API call:
response = client.get_users_tweets(
    id=user_id,
    max_results=100,
    pagination_token=pagination_token,
    exclude=['retweets'],
    tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
    until_id=until_date,  # Fetch tweets before this date
)
```

#### Option 2: Use Existing Deduplication (Current Approach)

Current script already handles duplicates via `ON CONFLICT DO NOTHING`. However, to be more efficient, we should fetch only tweets before the oldest date.

### Execution Plan

1. **Get Oldest Tweet Date**
   ```python
   # Already done: 2025-09-07
   ```

2. **Fetch Next 500 Tweets**
   ```bash
   # Option A: Use modified script with --until parameter
   python3 scripts/fetch_tweets_safe.py \
     --handle OPChoudhary_Ind \
     --max-batches 5 \
     --until 2025-09-07T00:00:00Z
   
   # Option B: Use current script (will skip duplicates automatically)
   python3 scripts/fetch_tweets_safe.py \
     --handle OPChoudhary_Ind \
     --max-batches 5
   ```

3. **Verify No Duplicates**
   ```bash
   # Check total count
   python3 -c "
   import os
   from dotenv import load_dotenv
   import psycopg2
   from pathlib import Path
   
   load_dotenv(Path('.env.local'))
   conn = psycopg2.connect(os.getenv('DATABASE_URL'))
   with conn.cursor() as cur:
       cur.execute('SELECT COUNT(DISTINCT tweet_id) FROM raw_tweets')
       unique = cur.fetchone()[0]
       cur.execute('SELECT COUNT(*) FROM raw_tweets')
       total = cur.fetchone()[0]
       print(f'Total: {total}, Unique: {unique}, Duplicates: {total - unique}')
   conn.close()
   "
   ```

---

## Complete Execution Timeline

### Step 1: Parse Current Tweets (15-30 minutes)
```bash
# 1. Start Next.js server
npm run dev

# 2. Parse tweets
source .venv/bin/activate
python3 scripts/parse_tweets_with_three_layer.py
```

### Step 2: Fetch Next 500 Tweets (1-2 hours)
```bash
# Fetch tweets going backwards in time
python3 scripts/fetch_tweets_safe.py \
  --handle OPChoudhary_Ind \
  --max-batches 5
```

### Step 3: Parse New Tweets (15-30 minutes)
```bash
# Parse the newly fetched tweets
python3 scripts/parse_tweets_with_three_layer.py
```

### Step 4: Verify Results
```bash
# Check totals
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
    print(f'Raw tweets: {raw}')
    print(f'Parsed events: {parsed}')
conn.close()
"
```

---

## Important Considerations

### 1. Duplicate Prevention

**Current Approach:**
- ✅ Database uses `ON CONFLICT DO NOTHING` - automatically skips duplicates
- ✅ Safe to re-run fetch script - won't create duplicates

**Better Approach (Future):**
- Use `until_id` parameter in Twitter API to fetch only tweets before oldest date
- More efficient (fewer API calls)
- Faster execution

### 2. Date Continuity

**Current Status:**
- Oldest: 2025-09-07
- Next fetch will get tweets from before 2025-09-07
- Script will automatically skip any duplicates if date range overlaps

### 3. Rate Limits

**Free Tier:**
- 1-5 requests per 15 minutes
- Script handles automatically with `wait_on_rate_limit=True`
- Expected time: 1-2 hours for 5 batches

### 4. Parsing Strategy

**Three-Layer Consensus:**
- Requires Next.js server running
- Uses Gemini + Ollama + Custom engine
- Higher accuracy than single parser
- Stores consensus metadata in database

---

## Expected Results

### After Phase 1 (Parse Current):
- ✅ 471 tweets parsed
- ✅ Available on review page
- ✅ Available on analytics page

### After Phase 2 (Fetch Next 500):
- ✅ ~971 total tweets (471 + 500)
- ✅ Date range extended backwards in time
- ✅ No duplicates

### After Phase 3 (Parse New):
- ✅ ~971 tweets parsed
- ✅ Complete dataset ready

---

## Risk Mitigation

### Risk 1: Next.js Server Not Running
**Mitigation:** Check before parsing, provide start command

### Risk 2: Rate Limits Exhausted
**Mitigation:** Script handles automatically, wait for reset

### Risk 3: Duplicate Tweets
**Mitigation:** Database constraint prevents duplicates, script handles gracefully

### Risk 4: Parsing Errors
**Mitigation:** Script logs errors, continues with remaining tweets, marks failures

---

## Summary

**Immediate Actions:**
1. ✅ Parse current 471 tweets (15-30 min)
2. ✅ Fetch next 500 tweets (1-2 hours)
3. ✅ Parse new tweets (15-30 min)

**Total Estimated Time:** 2-3 hours

**Ready to Execute:** Yes


