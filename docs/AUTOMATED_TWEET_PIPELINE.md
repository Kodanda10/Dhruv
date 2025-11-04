# Automated Tweet Pipeline Documentation

## Overview

The automated tweet pipeline fetches new tweets hourly, parses them, and updates the dashboard automatically. It includes rate limit protection to prevent API quota exhaustion.

## Pipeline Components

### 1. Rate Limit Check (`scripts/check_rate_limit_before_fetch.py`)

**Purpose:** Check Twitter API rate limit status WITHOUT consuming tweet quota.

**How it works:**
- Uses lightweight `user lookup` endpoint (separate quota from tweets)
- Tests tweet fetching availability (only if user lookup passes)
- Returns exit code 0 if safe to fetch, 1 if rate limited

**Usage:**
```bash
python scripts/check_rate_limit_before_fetch.py
```

**Output:**
- ✅ API STATUS: READY FOR FETCHING → Safe to proceed
- ❌ API STATUS: RATE LIMITED → Wait before fetching

---

### 2. Automated Pipeline (`scripts/automated_tweet_pipeline.py`)

**Purpose:** Complete end-to-end pipeline that runs all steps sequentially.

**Steps:**
1. **Rate Limit Check** - Verifies API quota is available
2. **Fetch Tweets** - Runs `fetch_5_latest_tweets_final.py`
3. **Parse Tweets** - Runs `scripts/parse_tweets.py`
4. **Update Dashboard** - Runs `update_parsed_tweets.py`

**Usage:**
```bash
python scripts/automated_tweet_pipeline.py
```

**Features:**
- ✅ Comprehensive logging to `logs/tweet_pipeline.log`
- ✅ Graceful handling of rate limits (continues pipeline if fetch fails)
- ✅ Timeouts to prevent hanging
- ✅ Summary report at end

---

### 3. GitHub Actions Workflow (`.github/workflows/automated-tweet-pipeline.yml`)

**Purpose:** Runs the pipeline automatically every hour.

**Schedule:**
- **Hourly:** Runs at minute 0 of every hour (1:00, 2:00, 3:00, etc.)
- **Manual:** Can be triggered manually via GitHub Actions UI

**Configuration Required:**
Add these secrets to your GitHub repository:
- `X_BEARER_TOKEN` - Twitter API bearer token
- `DATABASE_URL` - PostgreSQL connection string (if using remote DB)

**Features:**
- ✅ Runs automatically every hour
- ✅ Continues even if rate limited (graceful degradation)
- ✅ Commits updated `parsed_tweets.json` automatically
- ✅ Uploads logs as artifacts
- ✅ Summary report in GitHub Actions UI

---

## Rate Limit Handling Strategy

### Why We Hit Rate Limits Immediately

Twitter API v2 Free Tier has **extremely restrictive limits**:
- **Tweet Fetching:** 1-5 requests per 15-minute window
- **User Lookup:** Separate quota (usually 3 requests per 15 minutes)

### Our Approach

1. **Pre-Check Before Fetching:**
   - Use `check_rate_limit_before_fetch.py` to verify quota
   - Only fetch if quota is available

2. **Automatic Waiting:**
   - `fetch_5_latest_tweets_final.py` uses `wait_on_rate_limit=True`
   - Automatically waits when rate limited
   - Resumes when quota resets

3. **Graceful Degradation:**
   - Pipeline continues even if fetch is rate limited
   - Parsing and dashboard update still run (process existing data)

4. **Hourly Schedule:**
   - Spreads API calls over time
   - Reduces chance of hitting limits
   - Consistent updates without overwhelming API

---

## Local Testing

### Test Rate Limit Checker
```bash
source .venv/bin/activate
python scripts/check_rate_limit_before_fetch.py
```

### Test Complete Pipeline
```bash
source .venv/bin/activate
python scripts/automated_tweet_pipeline.py
```

### Check Pipeline Logs
```bash
tail -f logs/tweet_pipeline.log
```

---

## GitHub Actions Setup

### Step 1: Add Secrets

Go to: `Settings → Secrets and variables → Actions`

Add:
- `X_BEARER_TOKEN`: Your Twitter API bearer token
- `DATABASE_URL`: PostgreSQL connection string (if using remote DB)

### Step 2: Enable Workflow

The workflow is automatically enabled. It will:
- Run every hour automatically
- Be triggerable manually from Actions tab

### Step 3: Monitor Runs

View runs at: `Actions → Automated Tweet Pipeline`

Check:
- ✅ Green checkmark = Success
- ⚠️ Yellow warning = Rate limited (but pipeline continued)
- ❌ Red X = Critical failure

---

## Troubleshooting

### Issue: "Rate limit exceeded immediately"

**Cause:** Previous API calls consumed quota in the last 15 minutes.

**Solution:**
1. Wait 15-20 minutes
2. Check status: `python scripts/check_rate_limit_before_fetch.py`
3. Run pipeline when status shows "READY"

### Issue: "No tweets fetched"

**Possible causes:**
1. Rate limited (check logs)
2. No new tweets from account
3. Database connection issue

**Solution:**
1. Check `logs/tweet_pipeline.log`
2. Verify database: `docker ps | grep postgres`
3. Test fetch manually: `python fetch_5_latest_tweets_final.py`

### Issue: "Pipeline fails in GitHub Actions"

**Check:**
1. Secrets are set correctly
2. Database URL is accessible from GitHub Actions
3. Python dependencies are installed

**Solution:**
1. Check Actions logs for specific error
2. Test locally first: `python scripts/automated_tweet_pipeline.py`
3. Verify secrets are not expired

---

## Pipeline Flow Diagram

```
┌─────────────────────────────────────────┐
│  Hourly Trigger (GitHub Actions)       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  1. Check Rate Limit                   │
│     (Lightweight, no quota used)       │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┐
        │ Quota OK?   │
        └──────┬──────┘
               │
        ┌──────┴──────┐
        │             │
    ┌───▼───┐    ┌───▼───┐
    │  YES  │    │  NO   │
    └───┬───┘    └───┬───┘
        │            │
        │            └─────────┐
        │                      │
        ▼                      ▼
┌─────────────────┐   ┌─────────────────┐
│ 2. Fetch Tweets │   │  Skip Fetch     │
│    (5 latest)   │   │  (Rate Limited) │
└────────┬────────┘   └────────┬────────┘
         │                     │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 3. Parse Tweets      │
         │    (From database)    │
         └──────────┬───────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 4. Update Dashboard │
         │    (parsed_tweets.   │
         │     json)            │
         └──────────┬───────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ 5. Commit Changes   │
         │    (GitHub Actions) │
         └─────────────────────┘
```

---

## Best Practices

1. **Monitor Rate Limits:**
   - Check status before manual runs
   - Let automated pipeline handle scheduling

2. **Review Logs Regularly:**
   - Check `logs/tweet_pipeline.log` weekly
   - Review GitHub Actions logs monthly

3. **Avoid Manual Interference:**
   - Don't run fetch scripts manually during scheduled runs
   - Let automation handle everything

4. **Monitor API Quota:**
   - Free tier: 500,000 tweets/month total
   - Hourly runs: ~5 tweets/hour × 24 hours = 120 tweets/day
   - Monthly: ~3,600 tweets/month (well within limits)

---

## Next Steps

- ✅ Pipeline is automated and running hourly
- ✅ Rate limit protection is in place
- ✅ Dashboard updates automatically
- ⏭️ Monitor first few runs to ensure stability

---

**Last Updated:** 2025-11-03  
**Status:** ✅ Production Ready

