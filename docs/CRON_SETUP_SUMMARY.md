# Cron Job Setup Summary - Incremental Tweet Fetching

## Overview

The cron job system has been set up to:
1. **Fetch ONLY new tweets** (incremental, not historical)
2. **Respect Twitter API rate limits** (automatic via Tweepy)
3. **Respect Gemini API rate limits** (configurable delays)
4. **Parse fetched tweets** using three-layer consensus engine
5. **Run automatically** every 1-2 hours

---

## Key Files

### 1. `scripts/fetch_new_tweets_incremental.py`
- **Purpose:** Fetches only NEW tweets (since last fetch)
- **Strategy:** Uses `since_id` to get tweets newer than newest tweet in database
- **Rate Limits:** Automatically handled by Tweepy (`wait_on_rate_limit=True`)
- **Options:**
  - `--handle`: Twitter username (default: OPChoudhary_Ind)
  - `--max-tweets`: Max tweets per run (default: 100)
  - `--parse`: Also parse fetched tweets
  - `--parse-delay`: Delay between parsing tweets (default: 6s = 10 RPM)

### 2. `scripts/parse_tweets_with_three_layer.py`
- **Purpose:** Parse tweets using three-layer consensus
- **Rate Limits:** Configurable delay between tweets
- **Options:**
  - `--limit`: Max tweets to parse
  - `--batch-delay`: Seconds between tweets (default: 6s)
  - `--gemini-rpm`: Gemini RPM limit (default: 10 for Flash)

### 3. `scripts/setup_cron_fetch.sh`
- **Purpose:** Interactive setup script for cron job
- **Features:**
  - Choose 1-hour or 2-hour interval
  - Automatically configures Gemini rate limits
  - Sets up log file

---

## Rate Limit Configuration

### Twitter API
- **Automatic:** Handled by Tweepy (`wait_on_rate_limit=True`)
- **No manual configuration needed**

### Gemini API (Free Tier)
- **Flash:** 10 RPM = 6 seconds delay
- **Pro:** 5 RPM = 12 seconds delay
- **Daily Limits:**
  - Flash: 500 requests/day
  - Pro: 25 requests/day

### Recommended Settings
```bash
# For Gemini Flash (Free Tier)
--parse-delay 6.0    # 10 RPM, safe for free tier

# For Gemini Pro (Free Tier)
--parse-delay 12.0   # 5 RPM, safe for free tier

# For Paid Tier (Flash)
--parse-delay 1.0    # 60 RPM, conservative for paid tier
```

---

## Setup Instructions

### 1. Run Setup Script
```bash
cd /Users/abhijita/Projects/Project_Dhruv
./scripts/setup_cron_fetch.sh
```

### 2. Choose Interval
- Select **1** for every hour
- Select **2** for every 2 hours (recommended)

### 3. Verify Cron Job
```bash
crontab -l
```

Should show:
```
0 */2 * * * cd /Users/abhijita/Projects/Project_Dhruv && python3 scripts/fetch_new_tweets_incremental.py --max-tweets 100 --parse --parse-delay 6.0 >> logs/cron_fetch.log 2>&1
```

### 4. Monitor Logs
```bash
tail -f logs/cron_fetch.log
```

---

## Manual Testing

### Test Fetch Only (No Parsing)
```bash
python3 scripts/fetch_new_tweets_incremental.py --max-tweets 10
```

### Test Fetch + Parse
```bash
python3 scripts/fetch_new_tweets_incremental.py --max-tweets 10 --parse --parse-delay 6.0
```

### Test Parsing Only
```bash
python3 scripts/parse_tweets_with_three_layer.py --limit 10 --batch-delay 6.0
```

---

## Expected Behavior

### Every Cron Run (2-hour interval):
1. **Fetch:** Up to 100 new tweets (since last fetch)
2. **Parse:** Parse fetched tweets with 6s delay between each
3. **Log:** Results to `logs/cron_fetch.log`
4. **Rate Limits:** Automatically respected

### Daily Limits (2-hour interval = 12 runs/day):
- **Twitter:** Well within limits (automatic handling)
- **Gemini Flash:** ~120 requests/day (well under 500 limit)
- **Gemini Pro:** ~120 requests/day (exceeds 25 limit - upgrade needed!)

---

## Troubleshooting

### Cron Job Not Running
```bash
# Check cron service
sudo launchctl list | grep cron

# Check logs
tail -f logs/cron_fetch.log

# Test manually
python3 scripts/fetch_new_tweets_incremental.py --max-tweets 5
```

### Rate Limit Errors
- **Twitter:** Check API key and rate limit status
- **Gemini:** Increase `--parse-delay` (e.g., 12s for Pro)
- **Check logs:** `tail -f logs/cron_fetch.log`

### No New Tweets
- **Normal:** If no new tweets posted, script exits successfully
- **Check:** Database for latest tweet date
- **Verify:** Twitter account is active

---

## Stopping Fetch Scripts

All historical fetching scripts are now stopped. Only the cron job runs automatically.

### To Stop Cron Job
```bash
crontab -e
# Delete the line with fetch_new_tweets_incremental.py
```

### To Verify No Fetch Scripts Running
```bash
ps aux | grep -E "fetch.*tweets|parse.*tweets" | grep -v grep
```

---

## Next Steps

1. ✅ Cron job setup complete
2. ✅ Rate limit protection enabled
3. ⏳ Test manually first before relying on cron
4. ⏳ Monitor logs for first few runs
5. ⏳ Adjust `--parse-delay` if needed based on tier

---

## References

- [Gemini Rate Limits](docs/GEMINI_RATE_LIMITS.md)
- [Twitter API Rate Limits](TWITTER_API_RATE_LIMITS.md)
- Fetch Script: `scripts/fetch_new_tweets_incremental.py`
- Parse Script: `scripts/parse_tweets_with_three_layer.py`

