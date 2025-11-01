# Twitter API v2 Rate Limits - Critical Information

## ⚠️ WARNING: API Revocation Risk

Violating rate limits can result in **immediate API access revocation**. Always monitor rate limit headers and respect limits.

---

## Free Tier Rate Limits (As of 2024)

### Monthly Limits
- **500,000 tweets per month** - Total tweet consumption cap
- This includes ALL endpoints that return tweet data

### Endpoint-Specific Limits

#### `GET /2/users/:id` (User Lookup)
- **Different rate limit** than tweet fetching
- Usually 15 requests per 15-minute window

#### `GET /2/users/:id/tweets` (Fetch User Tweets)
- **Rate limit varies** - typically restrictive on free tier
- Uses **15-minute rolling windows**
- Exact numbers depend on your specific free tier access level

###

 Important Notes

1. **Different endpoints have different limits**
   - Checking user info ≠ fetching tweets
   - Always test the ACTUAL endpoint you'll use

2. **Rate limit headers in EVERY response:**
   ```
   x-rate-limit-limit: Maximum requests allowed
   x-rate-limit-remaining: Requests left in window
   x-rate-limit-reset: Unix timestamp when limit resets
   ```

3. **429 Too Many Requests = Rate Limit Hit**
   - Stop immediately
   - Wait until `x-rate-limit-reset` time
   - Do NOT retry rapidly (risks revocation)

---

## Best Practices (Official Twitter Recommendations)

### 1. Monitor Response Headers

**CRITICAL:** Check headers on EVERY response:

```python
# Tweepy v4 with wait_on_rate_limit=True handles this automatically
client = tweepy.Client(
    bearer_token=bearer_token,
    wait_on_rate_limit=True,  # ← ALWAYS use this
)
```

### 2. Exponential Backoff

If you encounter errors:
- 1st retry: Wait 1 second
- 2nd retry: Wait 2 seconds
- 3rd retry: Wait 4 seconds
- 4th retry: Wait 8 seconds
- Cap at 60 seconds

```python
wait_time = min(2 ** retry_count, 60)
time.sleep(wait_time)
```

### 3. Cache Results

- Store fetched tweets in database
- Don't re-fetch same data
- Use `since_id` to get only NEW tweets (not for backward pagination!)

### 4. Batch Requests

- Use `max_results=100` (API maximum)
- Minimize total number of requests
- Use pagination tokens properly

### 5. Prioritize Critical Calls

- Fetch most important data first
- Schedule less critical requests for off-peak times
- Monitor your monthly quota

### 6. Handle Errors Gracefully

```python
try:
    response = client.get_users_tweets(...)
except tweepy.TooManyRequests:
    # Rate limit hit - wait until reset
    logger.error("Rate limit exceeded")
    time.sleep(15 * 60)  # Wait 15 minutes
except tweepy.Unauthorized:
    # Invalid credentials - STOP
    logger.error("Invalid API key - ACCESS REVOKED?")
    sys.exit(1)
except tweepy.Forbidden:
    # Access denied - STOP
    logger.error("API access forbidden - CHECK STATUS")
    sys.exit(1)
```

---

## Our Implementation

### ✅ `scripts/fetch_tweets_safe.py` (RECOMMENDED)

**Safe features:**
- ✅ Uses `wait_on_rate_limit=True` (automatic rate limit handling)
- ✅ Monitors pagination tokens correctly
- ✅ Implements exponential backoff
- ✅ Handles all error types
- ✅ Logs rate limit information
- ✅ Database deduplication (skips already-fetched tweets)
- ✅ Graceful interruption handling

**Usage:**
```bash
# Fetch all tweets safely
python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind

# Test with limited batches
python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind --max-batches 5
```

### ⚠️ Common Mistakes to Avoid

1. **❌ Using `since_id` for backward pagination**
   - `since_id` gets tweets NEWER than ID
   - Use `pagination_token` for older tweets

2. **❌ Not using `wait_on_rate_limit=True`**
   - Manual rate limit handling is error-prone
   - Let Tweepy handle it automatically

3. **❌ Retrying immediately after 429**
   - Rapid retries = API revocation risk
   - Always wait for `x-rate-limit-reset`

4. **❌ Fetching same data repeatedly**
   - Use database to track fetched tweets
   - Implement deduplication

5. **❌ Ignoring error types**
   - 401 Unauthorized = bad credentials
   - 403 Forbidden = access denied (serious!)
   - 429 Too Many Requests = rate limit
   - Different responses require different actions

---

## Pagination Strategy

### ✅ Correct: Use `pagination_token` for older tweets

```python
pagination_token = None

while True:
    response = client.get_users_tweets(
        id=user_id,
        max_results=100,
        pagination_token=pagination_token,  # ← Gets OLDER tweets
    )
    
    if not response.data:
        break
    
    # Process tweets...
    
    # Get next page token
    if response.meta and 'next_token' in response.meta:
        pagination_token = response.meta['next_token']
    else:
        break  # No more tweets
```

### ❌ Wrong: Using `since_id` for pagination

```python
# DON'T DO THIS
since_id = None
tweets = client.get_users_tweets(
    id=user_id,
    since_id=since_id,  # ← This gets NEWER tweets, not older!
)
```

---

## Monitoring & Safety

### Check Current Status

```bash
# Check if rate limit has reset
python scripts/check_rate_limit.py
```

### View Fetch Progress

```bash
# Check how many tweets fetched
python check_tweets.py
```

### Monitor Real-Time

```bash
# Monitor fetch progress (separate terminal)
python scripts/notify_fetch_complete.py
```

---

## Recovery from Rate Limit

If you hit a rate limit:

1. **Stop immediately** - Don't make more requests
2. **Check reset time** - Wait until `x-rate-limit-reset`
3. **Verify credentials** - Ensure API key is still valid
4. **Resume safely** - Use the safe fetcher script

**Time to wait:**
- Typically 15 minutes from when you hit the limit
- Check `x-rate-limit-reset` header for exact time
- Our `wait_on_rate_limit=True` handles this automatically

---

## Summary

### ✅ DO:
- Use `wait_on_rate_limit=True`
- Monitor response headers
- Use `pagination_token` for older tweets
- Implement exponential backoff
- Cache/deduplicate data
- Handle errors gracefully
- Log everything

### ❌ DON'T:
- Ignore rate limits
- Retry rapidly after 429
- Use `since_id` for backward pagination
- Fetch duplicate data
- Ignore error types
- Make unnecessary requests

---

**When in doubt, be conservative. It's better to fetch slowly than lose API access!**

