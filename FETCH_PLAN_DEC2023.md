# 📋 Cautious Fetch Plan: December 1, 2023

**Created:** 2025-01-27  
**Target:** Fetch tweets from 2025-02-14 back to 2023-12-01  
**Strategy:** 500-tweet batches with maximum rate limit protection

---

## 🎯 Current Status

- **Oldest Tweet:** 2025-02-14 12:33:37 (Tweet ID: `1890378865639407799`)
- **Target Date:** 2023-12-01
- **Days to Cover:** ~440 days (from Feb 14, 2025 back to Dec 1, 2023)
- **Current Total Tweets:** 2,504

---

## 🛡️ Safety Features Implemented

### 1. Rate Limit Protection
- ✅ Uses `wait_on_rate_limit=True` (automatic rate limit handling)
- ✅ Exponential backoff on errors
- ✅ 30-second delay between batch cycles
- ✅ 10-second delay after each fetch completes
- ✅ Automatic retry with proper waiting

### 2. Batch Strategy
- **Batches per Cycle:** 5 batches × 100 tweets = **500 tweets per cycle**
- **API Calls per Cycle:** 5 requests (respecting API max of 100 tweets per request)
- **Pagination:** Uses `until_id` for backward pagination (fetching older tweets)

### 3. Progress Monitoring
- Real-time progress tracking
- Date range monitoring
- Percentage complete calculation
- Session statistics

### 4. Error Handling
- Graceful interruption (Ctrl+C saves progress)
- Database transaction safety
- Detailed error logging
- Automatic resume capability

---

## 📊 Estimated Timeline

### Conservative Estimate (Free Tier)
- **500 tweets per cycle**
- **5 API calls per cycle**
- **Rate limit:** ~1-5 requests per 15 minutes
- **Time per cycle:** 15-75 minutes (depending on rate limits)
- **Total cycles needed:** ~20-30 cycles (estimated 10,000-15,000 tweets)
- **Total time:** ~5-37 hours (spread across multiple sessions)

### Realistic Approach
- Run in multiple sessions (stop and resume)
- Monitor progress carefully
- Allow time for rate limits to reset
- Be patient with free tier limits

---

## 🚀 How to Run

### Basic Usage
```bash
python3 scripts/cautious_fetch_to_dec2023.py --handle OPChoudhary_Ind
```

### With Safety Limits
```bash
# Limit to 3 batches per session (safety)
python3 scripts/cautious_fetch_to_dec2023.py --handle OPChoudhary_Ind --max-batches-per-session 3
```

### Skip Parsing (Faster)
```bash
# Fetch only, don't parse (faster)
python3 scripts/cautious_fetch_to_dec2023.py --handle OPChoudhary_Ind --skip-parse
```

---

## ✅ Pre-Flight Checklist

Before running, verify:

- [ ] **Database Connection:** `DATABASE_URL` is set in `.env.local`
- [ ] **API Credentials:** `X_BEARER_TOKEN` is set in `.env.local`
- [ ] **Oldest Tweet Verified:** Check database has tweet ID `1890378865639407799`
- [ ] **Rate Limit Status:** Check if you've used API quota recently
- [ ] **Time Available:** Plan for long-running process (can be interrupted)
- [ ] **Disk Space:** Ensure enough space for database growth

---

## 📈 Progress Tracking

The script will display:
- Current oldest tweet date
- Progress percentage
- Tweets fetched per batch
- Total tweets fetched this session
- Days remaining to target

### Example Output
```
📦 BATCH #1
Current Status:
  Total tweets in DB: 2,504
  Oldest tweet date:  2025-02-14
  Progress: 0.0% complete (440 days remaining)
  
⏳ Starting fetch cycle #1...
  📥 Fetching batch (until_id: 1890378865639407799)...
  ✅ Fetched 487 new tweets
  
📊 Batch #1 Results:
  Tweets fetched this batch: 487
  Total fetched this session: 487
  New oldest tweet date: 2025-01-15
  ✅ Progress: Went back 30 days
```

---

## ⚠️ Important Warnings

### Rate Limits
- **Free Tier is VERY LIMITED**
- Script will automatically wait when rate limited
- Don't interrupt during rate limit waits
- Can take hours/days depending on quota

### Interruption
- **Safe to interrupt:** Press Ctrl+C anytime
- Progress is saved after each batch
- Resume by running script again
- No data loss

### API Quota
- Monitor monthly quota (500,000 tweets/month)
- Each batch uses ~5 API calls
- 20-30 cycles = 100-150 API calls
- Well within monthly limits

---

## 🔄 Resuming After Interruption

If interrupted or stopped:

1. **Check current status:**
   ```bash
   python3 check_tweets.py
   ```

2. **Resume fetching:**
   ```bash
   python3 scripts/cautious_fetch_to_dec2023.py --handle OPChoudhary_Ind
   ```
   
   The script automatically:
   - Finds oldest tweet in database
   - Continues from there
   - Uses `until_id` to fetch older tweets

---

## 📝 Monitoring Commands

### Check Database Status
```bash
python3 check_tweets.py
```

### Check Rate Limit Status
```bash
python3 scripts/check_rate_limit.py
```

### Export Readable Format
```bash
python3 scripts/export_tweets_to_readable.py
```

---

## 🎯 Success Criteria

The fetch will be complete when:
- ✅ Oldest tweet date ≤ 2023-12-01
- ✅ All tweets from Dec 1, 2023 to Feb 14, 2025 are in database
- ✅ No errors in fetch process

---

## 📞 Troubleshooting

### Issue: "Rate limit exceeded"
- **Solution:** Script handles automatically - just wait
- Tweepy will sleep until limit resets
- Don't interrupt during wait

### Issue: "No new tweets fetched"
- **Possible causes:**
  - Rate limit hit (wait and retry)
  - Reached end of available tweets
  - All tweets already in database
- **Action:** Continue - script handles this

### Issue: "Database connection error"
- **Check:** DATABASE_URL in .env.local
- **Verify:** Database is running
- **Retry:** Run script again

---

## 🚨 Emergency Stop

If you need to stop immediately:
1. Press `Ctrl+C` (safe - progress is saved)
2. Wait for current batch to complete
3. Check database for progress
4. Resume later when ready

---

**Ready to start?** Run:
```bash
python3 scripts/cautious_fetch_to_dec2023.py --handle OPChoudhary_Ind --max-batches-per-session 3
```

This starts with 3 batches (safety limit) - you can increase later if all goes well.

