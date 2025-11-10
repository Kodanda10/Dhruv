# Twitter/X API Endpoint Comparison

**Date:** 2025-01-27  
**Purpose:** Compare API v1 vs v2 endpoints for fetching older tweets

---

## 🔍 Key Finding

**Both API v1.1 and v2 have the same 3,200 tweet limit!**

- ❌ **API v1.1** `GET statuses/user_timeline` - 3,200 most recent tweets
- ❌ **API v2** `GET /2/users/:id/tweets` - 3,200 most recent tweets
- ✅ **Full-Archive Search** (Academic/Enterprise only) - Complete history

---

## API v1.1 Endpoints

### `GET statuses/user_timeline`

**Status:** ⚠️ **Deprecated/Being Phased Out**

**Limitations:**
- Same 3,200 tweet limit as v2
- Being deprecated in favor of v2
- May not be available for new apps
- Same pagination limitations

**Endpoint:**
```
GET https://api.twitter.com/1.1/statuses/user_timeline.json
```

**Parameters:**
- `user_id` or `screen_name`
- `count` (max 200 per request)
- `since_id` (get tweets newer than this)
- `max_id` (get tweets older than this)

**Issues:**
- `max_id` works like `until_id` in v2 - doesn't reliably fetch older tweets
- Still limited to 3,200 most recent tweets
- Requires OAuth 1.0a authentication

---

## API v2 Endpoints

### `GET /2/users/:id/tweets` (Current)

**Status:** ✅ **Active and Recommended**

**Limitations:**
- 3,200 most recent tweets limit
- Pagination using `pagination_token`
- `until_id` parameter doesn't work reliably for backward pagination

**Endpoint:**
```
GET https://api.twitter.com/2/users/:id/tweets
```

**Parameters:**
- `id` (user ID)
- `max_results` (5-100 per request)
- `pagination_token` (for pagination)
- `until_id` (doesn't work reliably)
- `start_time` / `end_time` (only filters within 3,200 limit)

---

## Full-Archive Search (Academic/Enterprise Only)

### `GET /2/tweets/search/all`

**Status:** ✅ **Available for Academic/Enterprise**

**Capabilities:**
- ✅ Access to complete tweet history (back to 2006)
- ✅ No 3,200 limit
- ✅ Direct date range queries
- ✅ 10 million tweets/month (Academic)

**Endpoint:**
```
GET https://api.twitter.com/2/tweets/search/all
```

**Parameters:**
- `query` (e.g., `from:username`)
- `start_time` / `end_time` (any date range)
- `max_results` (10-500 per request)

**Requirements:**
- Academic Research access OR
- Enterprise tier (paid)

---

## Comparison Table

| Feature | API v1.1 | API v2 Standard | Full-Archive Search |
|---------|----------|-----------------|---------------------|
| **Status** | Deprecated | Active | Academic/Enterprise |
| **Tweet Limit** | 3,200 | 3,200 | Unlimited |
| **Date Range** | Within 3,200 | Within 3,200 | Any date range |
| **Authentication** | OAuth 1.0a | Bearer Token | Bearer Token |
| **Pagination** | `max_id` | `pagination_token` | `next_token` |
| **Backward Pagination** | ❌ Unreliable | ❌ Unreliable | ✅ Works |
| **Oldest Tweet Access** | 3,200 most recent | 3,200 most recent | Complete history |
| **Cost** | Free (if available) | Free (Basic) | Free (Academic) / Paid (Enterprise) |

---

## Why API v1.1 Won't Help

1. **Same 3,200 Limit:** Both v1 and v2 have identical limitations
2. **Deprecated:** Twitter is phasing out v1.1 in favor of v2
3. **Same Pagination Issues:** `max_id` in v1 has same problems as `until_id` in v2
4. **Not Available:** New apps may not have access to v1.1 endpoints

---

## Current Solution: API v2 with `until_id` + `pagination_token`

**Strategy:**
1. Use `until_id` with oldest tweet ID we have
2. Continue with `pagination_token` for subsequent batches
3. This should work within the 3,200 limit

**Code:**
```python
# First batch: Use until_id
response = client.get_users_tweets(
    id=user_id,
    max_results=100,
    until_id=oldest_tweet_id,  # Start from oldest we have
    exclude=['retweets'],
    tweet_fields=['created_at', 'public_metrics', 'entities'],
)

# Subsequent batches: Use pagination_token
if response.meta and 'next_token' in response.meta:
    pagination_token = response.meta['next_token']
    response = client.get_users_tweets(
        id=user_id,
        max_results=100,
        pagination_token=pagination_token,  # Continue backward
        exclude=['retweets'],
        tweet_fields=['created_at', 'public_metrics', 'entities'],
    )
```

---

## Alternative Solutions

### Option 1: Full-Archive Search (Academic Research)
- **Requires:** Academic Research access
- **Benefits:** Complete history, no 3,200 limit
- **Status:** Need to apply (2-4 weeks)

### Option 2: Enterprise Tier
- **Requires:** Paid subscription
- **Benefits:** Complete history, higher limits
- **Cost:** Expensive

### Option 3: Continue with v2 `until_id` + `pagination_token`
- **Requires:** Nothing new
- **Benefits:** Works within 3,200 limit
- **Status:** Should work for remaining 693 tweets

---

## Recommendation

**For remaining 693 tweets:**
1. ✅ Use API v2 with `until_id` + `pagination_token` approach
2. ✅ This should work within the 3,200 limit
3. ✅ Continue paginating backward from oldest tweet

**For tweets beyond 3,200 limit:**
1. ✅ Apply for Academic Research access (if eligible)
2. ✅ Use Full-Archive Search endpoint
3. ✅ Fetch tweets from 2023-12-01 to 2025-02-14

---

## Testing API v1.1 Availability

If you want to test if v1.1 is available:

```python
import tweepy

# OAuth 1.0a authentication (required for v1.1)
auth = tweepy.OAuth1UserHandler(
    consumer_key=API_KEY,
    consumer_secret=API_SECRET,
    access_token=ACCESS_TOKEN,
    access_token_secret=ACCESS_TOKEN_SECRET,
)

api = tweepy.API(auth)

# Try v1.1 endpoint
try:
    tweets = api.user_timeline(
        screen_name='OPChoudhary_Ind',
        count=200,
        max_id=None,  # Start from newest
    )
    print(f"✅ API v1.1 available: Found {len(tweets)} tweets")
except Exception as e:
    print(f"❌ API v1.1 not available: {e}")
```

**Note:** Even if v1.1 works, it has the same 3,200 limit, so it won't help access older tweets.

---

## Conclusion

**Switching to API v1.1 will NOT solve the problem:**
- Same 3,200 tweet limit
- Same pagination issues
- Deprecated/being phased out
- Not available for new apps

**Best approach:**
1. Continue with API v2 using `until_id` + `pagination_token`
2. Apply for Academic Research access for tweets beyond 3,200 limit

---

**Status:** API v1.1 won't help - same limitations as v2

