# ✅ Automated Tweet Pipeline - Ready to Use

## Quick Start

### Local Testing (Right Now)

```bash
# 1. Check rate limit status
python scripts/check_rate_limit_before_fetch.py

# 2. Run complete pipeline
python scripts/automated_tweet_pipeline.py
```

### GitHub Actions (Automatic - Every Hour)

The pipeline runs automatically every hour via GitHub Actions.

**To enable:**
1. Add secrets to GitHub: `Settings → Secrets and variables → Actions`
   - `X_BEARER_TOKEN`: Your Twitter API bearer token
   - `DATABASE_URL`: PostgreSQL connection string (optional if using local DB)

2. That's it! It runs automatically at minute 0 of every hour.

---

## What It Does

1. ✅ **Checks rate limit** before fetching (saves quota)
2. ✅ **Fetches 5 latest tweets** from Twitter
3. ✅ **Parses tweets** using your parsing pipeline
4. ✅ **Updates dashboard** (`parsed_tweets.json`)
5. ✅ **Commits changes** (GitHub Actions only)

---

## Rate Limit Protection

### The Problem
Twitter API free tier is VERY restrictive:
- 1-5 requests per 15-minute window for tweet fetching
- Previous tests/scripts may have consumed quota

### The Solution
- ✅ Pre-check rate limit (uses lightweight endpoint, no quota used)
- ✅ Automatic waiting (`wait_on_rate_limit=True`)
- ✅ Graceful degradation (continues pipeline even if fetch is rate limited)

---

## Files Created

1. **`scripts/check_rate_limit_before_fetch.py`**
   - Checks API quota without consuming tweet quota
   - Use before manual runs

2. **`scripts/automated_tweet_pipeline.py`**
   - Complete end-to-end pipeline
   - Handles all steps automatically

3. **`.github/workflows/automated-tweet-pipeline.yml`**
   - Runs hourly automatically
   - Commits changes to repo

4. **`docs/AUTOMATED_TWEET_PIPELINE.md`**
   - Full documentation

---

## Current Status

**Rate Limit:** Currently rate limited (wait ~14 minutes)

**Recommendation:**
- Wait 15-20 minutes
- Run: `python scripts/check_rate_limit_before_fetch.py`
- When it shows "READY", run the pipeline

Or just let GitHub Actions handle it automatically! 🚀

