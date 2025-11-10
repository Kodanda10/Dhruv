# Parsing Status Report

Generated: $(date)

## Current Status

### Total Tweets
- **Total Fetched:** 2,570 tweets
- **Date Range:** 2025-02-14 to 2025-11-04

### Processing Status
- **Parsed:** 1,665 tweets (64.8%)
- **Pending:** 660 tweets (25.7%)
- **Errors:** 245 tweets (9.5%)

## Parsing Progress

### Currently Running
- **Background parsing started** for all pending tweets
- **Using Python orchestrator** (fallback mode - Next.js API not running)
- **Rate limit protection:** 6 seconds delay between tweets (10 RPM for Gemini Flash)
- **Estimated time:** ~66 minutes for 660 tweets (660 × 6s = 3,960s)

### Log Location
```bash
tail -f logs/parsing_all_tweets.log
```

## Next Steps

1. ✅ **Parsing started** - Running in background
2. ⏳ **Monitor progress** - Check logs for updates
3. ⏳ **Verify completion** - Run `python3 scripts/get_complete_status.py`
4. ⏳ **Review parsed events** - Check review queue in dashboard

## Cron Job Status

### Setup
- **Status:** Manual setup required (see `docs/CRON_MANUAL_SETUP.md`)
- **Command:** `crontab -e` then add cron job entry
- **Schedule:** Every 2 hours (recommended)

### Command to Add
```bash
0 */2 * * * cd /Users/abhijita/Projects/Project_Dhruv && python3 scripts/fetch_new_tweets_incremental.py --max-tweets 100 --parse --parse-delay 6.0 >> logs/cron_fetch.log 2>&1
```

## Rate Limit Protection

### Gemini API
- **Current tier:** Flash Free Tier
- **Rate limit:** 10 RPM (requests per minute)
- **Delay:** 6 seconds between tweets
- **Daily limit:** 500 requests/day

### Twitter API
- **Automatic handling:** Tweepy `wait_on_rate_limit=True`
- **No manual configuration needed**

## Monitoring

### Check Parsing Progress
```bash
# View live log
tail -f logs/parsing_all_tweets.log

# Check current status
python3 scripts/get_complete_status.py

# Check process
ps aux | grep parse_tweets_with_three_layer
```

### Check Cron Job
```bash
# View cron jobs
crontab -l

# View cron logs
tail -f logs/cron_fetch.log
```

## Troubleshooting

### Parsing Not Progressing
- Check if process is running: `ps aux | grep parse_tweets`
- Check logs for errors: `tail -50 logs/parsing_all_tweets.log`
- Verify database connection

### Gemini Rate Limit Errors
- Increase delay: `--batch-delay 12.0` (for Pro tier)
- Check daily limit: Should be < 500 requests/day
- Monitor logs for rate limit warnings

### Cron Job Not Running
- Verify cron job exists: `crontab -l`
- Check permissions: May need Terminal Full Disk Access
- Test manually: Run the command directly

