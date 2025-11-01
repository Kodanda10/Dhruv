# Start Tweet Fetch

## Instructions

Open a **new terminal window** and run:

```bash
cd /Users/abhijita/Projects/Project_Dhruv
source .venv/bin/activate
python scripts/fetch_tweets.py --handle OPChoudhary_Ind --since 2023-12-01 --until 2025-10-31
```

## What Will Happen

1. **Batch 1**: Fetch 100 tweets (excluding retweets)
2. **Wait**: 15 minutes (rate limit)
3. **Batch 2**: Fetch next 100 tweets
4. **Repeat**: Until all tweets fetched (~20 batches = ~5 hours)

## Expected Output

```
Batch #1: Fetching tweets from 2023-12-01 to 2023-12-31
✓ Batch #1 complete: 100 tweets fetched
✓ Total progress: 100 tweets fetched so far
⏸️  Rate limit: Pausing for 15 minutes before next batch...
   Next batch will start at: 2025-01-XX XX:XX:XX

[15 minutes later...]

Batch #2: Fetching tweets from 2024-01-01 to 2024-01-31
✓ Batch #2 complete: 100 tweets fetched
✓ Total progress: 200 tweets fetched so far
...
```

## Monitor Progress

In another terminal, check database:

```bash
psql postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db -c "
SELECT 
    COUNT(*) as total_tweets,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM raw_tweets
WHERE author_handle = 'OPChoudhary_Ind';
"
```

## Resume If Interrupted

If the fetch is interrupted, resume with:

```bash
python scripts/fetch_tweets.py --handle OPChoudhary_Ind --resume
```

## Time Estimate

- **~2000 tweets total**
- **20 batches needed** (100 tweets each)
- **15 minutes per batch**
- **Total time: ~5 hours**

---

**Note:** The tweet fetch will run in the background while I work on Task 3 (Database Schema).

