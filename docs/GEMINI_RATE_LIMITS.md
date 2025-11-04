# Gemini API Rate Limits - Critical Information

## Free Tier Rate Limits

### Gemini 2.5 Flash (Recommended for parsing)
- **Requests per Minute (RPM):** 10
- **Tokens per Minute (TPM):** 250,000
- **Requests per Day (RPD):** 500
- **Delay between requests:** 6 seconds (60s / 10 RPM)

### Gemini 2.5 Pro
- **Requests per Minute (RPM):** 5
- **Tokens per Minute (TPM):** 250,000
- **Requests per Day (RPD):** 25
- **Delay between requests:** 12 seconds (60s / 5 RPM)

## Paid Tier Rate Limits

### Gemini 2.5 Flash (Paid)
- **Requests per Minute (RPM):** 1,000
- **Tokens per Minute (TPM):** 2,000,000
- **Requests per Day (RPD):** No limit
- **Delay between requests:** 0.06 seconds (60s / 1000 RPM)

### Gemini 2.5 Pro (Paid)
- **Requests per Minute (RPM):** 150
- **Tokens per Minute (TPM):** 2,000,000
- **Requests per Day (RPD):** 10,000
- **Delay between requests:** 0.4 seconds (60s / 150 RPM)

---

## Three-Layer Consensus Engine Usage

Each tweet parsing uses:
- **1 Gemini API call** (Primary layer)
- **1 Ollama API call** (Secondary layer - local, no rate limit)
- **1 Custom parser call** (Fallback - local, no rate limit)

**Therefore:** The rate limit is determined by Gemini API calls only.

---

## Cron Job Configuration

### Default Configuration (Free Tier Flash)
```bash
# Fetch and parse with 6s delay (10 RPM)
python scripts/fetch_new_tweets_incremental.py \
  --max-tweets 100 \
  --parse \
  --parse-delay 6.0
```

### For Gemini Pro (Free Tier)
```bash
# Fetch and parse with 12s delay (5 RPM)
python scripts/fetch_new_tweets_incremental.py \
  --max-tweets 100 \
  --parse \
  --parse-delay 12.0
```

### For Paid Tier (Flash)
```bash
# Fetch and parse with 1s delay (60 RPM - conservative)
python scripts/fetch_new_tweets_incremental.py \
  --max-tweets 100 \
  --parse \
  --parse-delay 1.0
```

---

## Rate Limit Violation Handling

If you exceed rate limits:
1. **Error:** `RATE_LIMIT_EXCEEDED` or `429 Too Many Requests`
2. **Automatic retry:** Script waits 10 seconds and retries once
3. **Fallback:** If retry fails, falls back to Python orchestrator (no Gemini)

---

## Best Practices

1. **Monitor Daily Limits:**
   - Free Flash: 500 requests/day
   - Free Pro: 25 requests/day
   - If running hourly cron: 24 requests/day max (free tier)

2. **Batch Processing:**
   - Process tweets in small batches (10-20 at a time)
   - Add delays between batches
   - Log rate limit status

3. **Error Handling:**
   - Always use `--fallback` flag for production
   - Monitor logs for rate limit errors
   - Adjust `--parse-delay` if hitting limits

4. **Upgrade Considerations:**
   - If processing > 500 tweets/day: Consider paid tier
   - If processing > 25 tweets/day with Pro: Consider paid tier
   - Paid Flash tier: 1000 RPM = 1,440,000 requests/day (no limit)

---

## Current Configuration

The cron job is configured with:
- **Fetch interval:** Every 1-2 hours
- **Max tweets per run:** 100
- **Parse delay:** 6 seconds (10 RPM for Flash free tier)
- **Gemini model:** Flash (default)

This ensures:
- **Daily fetch rate:** ~24-48 requests (well under 500 limit)
- **Per-hour parsing:** ~10 tweets/hour max (600 tweets/day max)
- **Safe margin:** Stays well under free tier limits

---

## Troubleshooting

### "Rate limit exceeded" errors
- **Solution:** Increase `--parse-delay` to 12s or higher
- **Check:** Current RPM = 60 / delay_seconds
- **Verify:** Daily request count (should be < 500 for Flash)

### Slow parsing
- **Solution:** Reduce delay only if on paid tier
- **Check:** Current tier (free vs paid)
- **Consider:** Upgrading to paid tier for higher limits

### Daily limit reached
- **Solution:** Reduce cron frequency or upgrade tier
- **Check:** Current daily request count
- **Consider:** Batching multiple tweets per API call (if API supports)

---

## References

- [Gemini API Rate Limits Documentation](https://ai.google.dev/gemini-api/docs/rate-limits)
- Current limits: As of 2024-2025

