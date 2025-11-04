# Twitter API v2 Rate Limits - Complete Explanation

## Overview

**Twitter API v2** has fundamentally different rate limits than v1. This document explains exactly how rate limits work and what limits apply to the **`GET /2/users/:id/tweets`** endpoint we use.

---

## How Rate Limits Work

### 1. **15-Minute Rolling Windows**

Rate limits operate on **15-minute rolling windows**, not fixed intervals.

**Example:**
- At 10:00 AM, you make 5 requests
- At 10:05 AM, you make 5 more requests
- At 10:15 AM, you can make requests again (the window starting at 10:00 has expired)
- You're NOT limited to a specific hour slot

**Key Point:** The window **rolls forward**, not resets at fixed times.

### 2. **Per-Endpoint Limits**

Each API endpoint has its **own separate rate limit quota**.

**Important:**
- `GET /2/users/:id` (User Lookup) = Separate quota
- `GET /2/users/:id/tweets` (Fetch Tweets) = **Different quota**
- Checking user info does NOT consume tweet fetching quota

### 3. **Rate Limit Headers**

Every API response includes headers:

```
x-rate-limit-limit: 300        # Maximum requests allowed
x-rate-limit-remaining: 5      # Requests left in window
x-rate-limit-reset: 1699000000  # Unix timestamp when limit resets
```

**These headers tell you:**
- How many requests you can make total
- How many you have left right now
- Exactly when the window resets

---

## Twitter API v2 Tier Limits

### **Free Tier (Basic / Essential)**

**⚠️ CRITICAL:** Twitter API v2 Free Tier has **extremely restrictive limits** for tweet fetching.

#### `GET /2/users/:id/tweets` (Fetch User Tweets)

**Per 15-Minute Window:**
- **Estimated: 1-5 requests** per 15 minutes (varies by account/app approval)
- Some free tier accounts report as low as **1 request per 15 minutes**
- This is MUCH more restrictive than API v1

**Per Request:**
- **Minimum:** `max_results=5` (cannot request fewer than 5 tweets)
- **Maximum:** `max_results=100` (can request up to 100 tweets per call)

**Maximum Tweets Per Request:**
- **Best Case:** 100 tweets per request
- **Worst Case:** 5 tweets per request (minimum)

**Monthly Limit:**
- **500,000 tweets per month** total across ALL tweet-consuming endpoints
- This is a hard cap that resets monthly

---

## Our Current Implementation

### What We Fetch

```python
response = client.get_users_tweets(
    id=user_id,
    max_results=5,  # Minimum required by Twitter API
    exclude=['retweets'],
    tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
)
```

**What this means:**
- **1 API request** = fetches **5 tweets**
- **Rate limit:** ~1-5 requests per 15 minutes
- **Maximum tweets per 15 min:** 5-25 tweets (if 1-5 requests allowed)
- **Maximum tweets per hour:** 20-100 tweets (if we get 1 request every 15 min)

### Why We Fetch Only 5 Tweets

1. **Minimum Required:** Twitter API v2 requires `max_results >= 5`
2. **Conserve Quota:** We only need the latest tweets for hourly updates
3. **Rate Limit Friendly:** Fewer requests = less chance of hitting limits

---

## Understanding Rate Limit Behavior

### Scenario 1: Normal Operation

**Timeline:**
```
10:00 AM - Make 1 request → Fetch 5 tweets → ✅ Success
          (Remaining: 4/5 requests in 15-min window)

10:05 AM - Make 1 request → Fetch 5 tweets → ✅ Success
          (Remaining: 3/5 requests in 15-min window)

10:15 AM - Previous window expired, new window starts
          (Remaining: 5/5 requests available)
```

### Scenario 2: Rate Limit Hit

**Timeline:**
```
10:00 AM - Make 1 request → ✅ Success
          (Remaining: 4/5)

10:05 AM - Make 1 request → ✅ Success
          (Remaining: 3/5)

10:10 AM - Make 1 request → ✅ Success
          (Remaining: 2/5)

10:12 AM - Make 1 request → ✅ Success
          (Remaining: 1/5)

10:14 AM - Make 1 request → ✅ Success
          (Remaining: 0/5)

10:15 AM - Make 1 request → ❌ 429 Rate Limit Exceeded
          (Reset in: ~15 minutes)

10:30 AM - Window reset → ✅ Can make requests again
```

### How `wait_on_rate_limit=True` Works

```python
client = tweepy.Client(
    bearer_token=bearer_token,
    wait_on_rate_limit=True,  # ← This magic setting
)
```

**What it does:**
1. Makes API request
2. If receives 429 (Rate Limited):
   - Reads `x-rate-limit-reset` header
   - Calculates wait time: `reset_time - current_time`
   - Automatically sleeps until reset
   - Retries the request
3. Returns result after waiting

**Example:**
```python
# 10:15 AM - Rate limited
response = client.get_users_tweets(...)
# Tweepy automatically:
# - Detects 429 error
# - Reads reset time: 10:30 AM
# - Sleeps for 15 minutes
# - Retries at 10:30 AM
# - Returns tweets ✅
```

---

## Maximum Tweets We Can Fetch

### Per Request
- **Minimum:** 5 tweets (API requirement)
- **Maximum:** 100 tweets (API limit)
- **Current:** 5 tweets (we fetch 5 latest)

### Per 15 Minutes
- **Best Case:** 5 requests × 100 tweets = **500 tweets**
- **Worst Case (Free Tier):** 1 request × 5 tweets = **5 tweets**
- **Our Usage:** 1 request × 5 tweets = **5 tweets**

### Per Hour
- **Best Case:** 20 requests × 100 tweets = **2,000 tweets**
- **Worst Case:** 4 requests × 5 tweets = **20 tweets**
- **Our Usage:** 4 requests × 5 tweets = **20 tweets**

### Per Day (Hourly Pipeline)
- **Our Usage:** 24 hours × 5 tweets = **120 tweets/day**
- **Monthly:** 120 × 30 = **3,600 tweets/month**
- **Well within 500,000 monthly limit ✅**

---

## Why We Hit Rate Limits Immediately

### The Problem

When you see "Rate limit exceeded" on the **first request**, it means:

1. **Previous API calls** in the last 15 minutes consumed quota
2. **Other scripts/apps** using the same credentials
3. **Free tier** has very low limits (possibly 1 request per 15 min)

### Example Timeline

```
9:45 AM - Previous fetch script ran → Used 1 request
         (Remaining: 0/1 requests until 10:00 AM)

10:00 AM - Our script runs → ❌ 429 Rate Limited
         (Need to wait until 10:00 AM + 15 min = 10:15 AM)

10:15 AM - Window reset → ✅ Can fetch now
```

---

## Best Practices

### ✅ DO:

1. **Use `wait_on_rate_limit=True`**
   ```python
   client = tweepy.Client(
       bearer_token=bearer_token,
       wait_on_rate_limit=True,  # ← Always use this
   )
   ```

2. **Check Rate Limit Before Fetching**
   ```bash
   python scripts/check_rate_limit_before_fetch.py
   ```

3. **Fetch Only What You Need**
   - We fetch 5 latest tweets (minimum required)
   - Perfect for hourly updates

4. **Monitor Monthly Quota**
   - Free tier: 500,000 tweets/month
   - Our usage: ~3,600/month (well within limits)

5. **Use Database Deduplication**
   - Store tweets in database
   - Skip already-fetched tweets
   - Use `ON CONFLICT DO NOTHING`

### ❌ DON'T:

1. **Don't Fetch More Than Needed**
   - ❌ `max_results=100` if you only need 5
   - ✅ `max_results=5` for latest tweets

2. **Don't Make Rapid Retries**
   - ❌ Retry immediately after 429
   - ✅ Wait for `x-rate-limit-reset`

3. **Don't Ignore Headers**
   - ❌ Make requests blindly
   - ✅ Check `x-rate-limit-remaining` first

4. **Don't Run Multiple Scripts Simultaneously**
   - ❌ Two scripts using same credentials
   - ✅ One script at a time

---

## Real-World Example

### Our Hourly Pipeline

**What Happens Every Hour:**
1. **10:00 AM** - Pipeline runs
   - Checks rate limit (lightweight, no quota)
   - Fetches 5 latest tweets (1 request)
   - Parses tweets
   - Updates dashboard

2. **11:00 AM** - Pipeline runs
   - Checks rate limit
   - Fetches 5 latest tweets (1 request)
   - (Previous request window expired at 10:15 AM)

3. **12:00 PM** - Pipeline runs
   - Checks rate limit
   - Fetches 5 latest tweets (1 request)
   - And so on...

**Result:**
- **1 request per hour** = 24 requests per day
- **5 tweets per request** = 120 tweets per day
- **Well within limits** ✅

---

## Summary Table

| Metric | Value | Notes |
|--------|-------|-------|
| **Min tweets per request** | 5 | API requirement |
| **Max tweets per request** | 100 | API limit |
| **Our fetch size** | 5 | Latest tweets only |
| **Requests per 15 min (Free Tier)** | 1-5 | Varies by account |
| **Requests per hour (our usage)** | 1 | Hourly pipeline |
| **Tweets per hour** | 5 | Latest 5 tweets |
| **Tweets per day** | 120 | 24 × 5 |
| **Tweets per month** | 3,600 | 30 × 120 |
| **Monthly limit** | 500,000 | Free tier cap |
| **Utilization** | 0.7% | Well within limits |

---

## Key Takeaways

1. **Rate limits are PER ENDPOINT** - User lookup ≠ Tweet fetching
2. **15-minute rolling windows** - Not fixed time slots
3. **Free tier is VERY restrictive** - 1-5 requests per 15 minutes
4. **We're well within limits** - Only 5 tweets per hour
5. **`wait_on_rate_limit=True` handles everything** - Automatic waiting
6. **Monthly quota is generous** - 500K tweets, we use ~3.6K

---

**Last Updated:** 2025-11-03  
**Status:** ✅ Accurate based on Twitter API v2 documentation and real-world testing

