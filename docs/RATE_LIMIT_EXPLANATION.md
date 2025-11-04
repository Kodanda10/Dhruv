# Why Rate Limits Occur (And Why It's OK)

**Date:** November 4, 2025

---

## Why Rate Limits Happen

### Free Tier Reality

**Twitter/X API Free Tier:**
- **Monthly Quota:** 500 posts (tweets) per month
- **Rate Limit:** 1-5 requests per 15-minute window
- **Each Request:** Can fetch up to 100 tweets

### What Happened

1. **We've Been Testing:** Earlier tests (fetching 20 tweets, testing API) used up some of the rate limit quota
2. **Rate Limit Window:** Free tier allows only 1-5 requests per 15-minute rolling window
3. **First Batch Succeeded:** Batch #1 fetched 94 tweets successfully
4. **Second Batch Hit Limit:** When trying to fetch Batch #2, the rate limit was hit

### This is NORMAL Behavior!

The script uses `wait_on_rate_limit=True`, which means:
- ✅ **Automatically detects** rate limits
- ✅ **Automatically waits** until the limit resets (typically 15 minutes)
- ✅ **Automatically resumes** when ready
- ✅ **No manual intervention needed**

---

## What You're Seeing

When the script says "Rate limit exceeded. Sleeping for XXX seconds":

1. **This is EXPECTED** - Free tier has very restrictive limits
2. **Script is WORKING CORRECTLY** - It's handling the limit automatically
3. **It will RESUME AUTOMATICALLY** - No need to do anything

---

## Timeline for 500 Tweets

### Scenario: 5 Batches Needed (500 tweets)

**Best Case (5 requests per 15 minutes):**
- Batch 1: Immediate ✅
- Batch 2-5: All within 15 minutes
- **Total: ~15 minutes**

**Worst Case (1 request per 15 minutes):**
- Batch 1: Immediate ✅
- Wait 15 minutes
- Batch 2: Fetches
- Wait 15 minutes
- Batch 3: Fetches
- Wait 15 minutes
- Batch 4: Fetches
- Wait 15 minutes
- Batch 5: Fetches
- **Total: ~1.25 hours**

**Reality:** Somewhere in between (2-5 requests per 15 minutes)

---

## Why This Happens

### Free Tier Design

Twitter/X intentionally limits free tier to:
1. **Prevent abuse** - Protect their infrastructure
2. **Encourage paid plans** - Free tier is intentionally restrictive
3. **Manage server load** - Control API usage

### Monthly Quota

Even if you have 500 posts remaining in your monthly quota:
- You can only make 1-5 requests every 15 minutes
- This is a **rate limit**, not a quota limit
- The script handles this automatically

---

## Current Status

**What Happened:**
- ✅ Batch 1: Fetched successfully (94 tweets, 75 new)
- ⏸️ Batch 2: Hit rate limit → Script is waiting automatically
- ⏳ Batches 3-5: Will fetch after waiting periods

**Script Behavior:**
- Script is **NOT broken** - it's working as designed
- It will **automatically resume** when the rate limit resets
- You can **let it run** - it will complete all 5 batches

---

## What To Do

### Option 1: Let It Run (Recommended)
```bash
# Just let the script run - it will handle everything
python3 scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind --max-batches 5
# Go get coffee - it will finish automatically
```

### Option 2: Check Progress
```bash
# In another terminal, check progress
python3 -c "
import os
from dotenv import load_dotenv
import psycopg2
from pathlib import Path

load_dotenv(Path('.env.local'))
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
with conn.cursor() as cur:
    cur.execute('SELECT COUNT(*) FROM raw_tweets')
    print(f'Tweets fetched: {cur.fetchone()[0]}')
conn.close()
"
```

### Option 3: Resume Later
If you stop the script:
- Already-fetched tweets are saved in database
- Re-run the same command - it will skip duplicates
- Continue from where it left off

---

## Key Points

1. ✅ **Rate limits are EXPECTED** on free tier
2. ✅ **Script handles them AUTOMATICALLY** - no manual work needed
3. ✅ **This is NORMAL behavior** - not a bug
4. ✅ **Let it run** - it will complete all batches
5. ✅ **Progress is saved** - each batch is committed to database

---

## Summary

**Question:** Why did rate limit exceed?  
**Answer:** This is **NORMAL** for free tier. The script is handling it correctly with automatic waiting and resumption.

**Action:** Just let the script run - it will complete all 5 batches automatically!

