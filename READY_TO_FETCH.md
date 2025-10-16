# ✅ Ready to Fetch Tweets Safely

## Current Status

- ✅ **Database**: Running (PostgreSQL with raw_tweets + parsed_events tables)
- ✅ **API Credentials**: Configured in `.env.local`
- ✅ **Rate Limit Safety**: Implemented (prevents API revocation)
- ✅ **Parsing Pipeline**: Complete and tested (5 modules, 55/55 tests passing)
- ⏳ **Rate Limit**: Currently rate limited, resets in ~5-10 minutes

---

## Safe Fetch Script: `scripts/fetch_tweets_safe.py`

### Features
- ✅ **Automatic rate limit handling** (`wait_on_rate_limit=True`)
- ✅ **Correct pagination** (uses `pagination_token`, not `since_id`)
- ✅ **Database deduplication** (skips already-fetched tweets)
- ✅ **Error handling** (401, 403, 429 with proper responses)
- ✅ **Progress tracking** (logs batches, date ranges, stats)
- ✅ **Resumable** (can interrupt and restart safely)

---

## When to Run

**Option 1: Wait for Rate Limit Reset (~5-10 minutes)**

Check if ready:
```bash
cd /Users/abhijita/Projects/Project_Dhruv
source .venv/bin/activate
python scripts/check_rate_limit.py
```

When it shows "API is accessible", proceed to run the fetcher.

**Option 2: Run Now (it will wait automatically)**

The script will automatically wait when it hits the rate limit.

---

## How to Run

### Full Fetch (All Available Tweets)

```bash
cd /Users/abhijita/Projects/Project_Dhruv
source .venv/bin/activate
python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind
```

**Expected Output:**
```
============================================================
SAFE TWEET FETCHER
Rate Limit Aware - Prevents API Revocation
============================================================
Target: @OPChoudhary_Ind
Excluding: Retweets only
Including: Original tweets + Replies

✓ User found: @OPChoudhary_Ind (ID: 1706770968)
  Name: OP Choudhary
✓ Connected to database

Starting tweet fetch...
============================================================

📥 Batch #1: Fetching up to 100 tweets...
✓ Inserted 100 new tweets (skipped 0 duplicates)
  Date range: 2025-10-03 to 2025-10-16
  Progress: 100 tweets fetched, 100 new tweets stored

📥 Batch #2: Fetching up to 100 tweets...
[Tweepy automatically waits if rate limited]
...
```

**Duration:**
- ~2000 tweets total
- 100 tweets per batch
- ~20 batches
- With rate limiting: ~5-6 hours (automatically handled)

### Test Fetch (First 5 Batches)

```bash
python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind --max-batches 5
```

This fetches 500 tweets maximum (useful for testing).

---

## Monitoring Progress

### Option 1: Check Database

```bash
python check_tweets.py
```

### Option 2: Real-Time Monitor (separate terminal)

```bash
python scripts/notify_fetch_complete.py
```

Shows live updates every 60 seconds.

---

## After Fetching Completes

### 1. Verify Fetch

```bash
python check_tweets.py
```

Expected output:
```
============================================================
TWEET FETCH STATUS
============================================================
Total Tweets Fetched: 2000
Date Range: 2023-12-01 to 2025-10-16

Most Recent Tweets:
------------------------------------------------------------
...
```

### 2. Parse Tweets

```bash
python scripts/parse_tweets.py
```

This runs the complete parsing pipeline:
- Text preprocessing
- Event classification
- Location matching
- Date extraction
- Scheme detection
- Confidence scoring
- Review flagging

### 3. View Parsed Events

```bash
# Check database for parsed events
python -c "
import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path('.env.local'))
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

cur.execute('SELECT COUNT(*) FROM parsed_events')
count = cur.fetchone()[0]
print(f'Parsed events: {count}')

cur.execute('''
    SELECT event_type, COUNT(*) as count
    FROM parsed_events
    GROUP BY event_type
    ORDER BY count DESC
    LIMIT 10
''')

print('\nEvent Types:')
for event_type, count in cur.fetchall():
    print(f'  {event_type}: {count}')

conn.close()
"
```

---

## Safety Notes

### ✅ Safe to Interrupt

You can **Ctrl+C** at any time:
- Progress is saved to database
- No duplicate fetches (automatic deduplication)
- Resume by running the same command again

### ✅ Rate Limit Protection

The script uses `wait_on_rate_limit=True`:
- Automatically monitors `x-rate-limit-*` headers
- Waits when limit is reached
- Resumes when limit resets
- **Prevents API revocation**

### ⚠️ If You See Errors

**401 Unauthorized:**
```
❌ Invalid credentials
→ Check X_BEARER_TOKEN in .env.local
```

**403 Forbidden:**
```
❌ API access denied
→ Check Twitter Developer Portal for suspension
→ Verify API key status
```

**429 Too Many Requests:**
```
⚠️ Rate limit hit (handled automatically)
→ Script will wait and retry
→ Do nothing, let it handle it
```

---

## Quick Reference Commands

```bash
# Check if rate limit has reset
python scripts/check_rate_limit.py

# Fetch all tweets (safe, automatic rate limiting)
python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind

# Test with 5 batches (500 tweets)
python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind --max-batches 5

# Check fetch status
python check_tweets.py

# Monitor progress (separate terminal)
python scripts/notify_fetch_complete.py

# Parse fetched tweets
python scripts/parse_tweets.py
```

---

## Documentation

- **Rate Limits:** `TWITTER_API_RATE_LIMITS.md`
- **Parsing Pipeline:** `TASK_4_PARSING_PIPELINE_COMPLETE.md`
- **Database Schema:** `docs/PARSED_EVENTS_SCHEMA.md`

---

**All systems ready! Safe to fetch when rate limit resets. 🚀**

