# Twitter API v2 Rate Limits - Quick Summary

## How It Works

1. **15-Minute Rolling Windows** - Limit resets every 15 minutes (rolling, not fixed)
2. **Per-Endpoint Quotas** - Each endpoint has separate limits
3. **Headers Tell You Everything** - Check `x-rate-limit-remaining` in responses

## Our Endpoint: GET /2/users/:id/tweets

### Free Tier Limits:
- **Requests per 15 minutes:** 1-5 requests (very restrictive!)
- **Tweets per request:** 5-100 tweets (min: 5, max: 100)
- **Monthly cap:** 500,000 tweets total

### Our Usage:
- **Per request:** 5 tweets (minimum required)
- **Per hour:** 1 request = 5 tweets
- **Per day:** 24 requests = 120 tweets
- **Per month:** ~3,600 tweets (well within 500K limit)

## Why Rate Limits Hit Immediately

Previous API calls in the last 15 minutes consumed your quota. Wait 15 minutes for the window to reset.

## The Solution

```python
client = tweepy.Client(
    bearer_token=bearer_token,
    wait_on_rate_limit=True,  # Automatically waits when rate limited
)
```

**This handles everything:**
- Detects rate limit (429 error)
- Reads reset time from headers
- Waits automatically
- Retries when ready

## Maximum Tweets We Can Fetch

- **Per request:** 100 tweets (but we only fetch 5)
- **Per 15 minutes:** 500 tweets (best case), 5 tweets (worst case free tier)
- **Per hour:** 2,000 tweets (best case), 20 tweets (worst case)
- **We fetch:** 5 tweets per hour (conservative, perfect for updates)

