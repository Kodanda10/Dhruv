# Twitter/X API v2 Rate Limits - CORRECTED (Official Documentation)

**Source:** [X Developer Documentation](https://developer.x.com/en/support/x-api/v2)

---

## ⚠️ CRITICAL: Two Types of Limits

Twitter/X API has **TWO SEPARATE LIMIT SYSTEMS**:

1. **Monthly Quota** - Total number of posts/tweets you can consume per month
2. **Rate Limits** - Number of requests you can make per 15-minute window

**You must respect BOTH limits!**

---

## Monthly Quota Limits (By Access Level)

### Free Access (Free Tier)
- **500 posts per month** - Total tweet consumption cap
- **100 reads per month** - Total read operations
- Applies to ALL endpoints that return tweet data

### Basic Access
- **10,000 posts per month**

### Pro Access
- **1,000,000 posts per month**

### Enterprise Access
- **50,000,000+ posts per month** (contract-based)

**Important:** The monthly quota is about **NUMBER OF POSTS/TWEETS**, not requests!

---

## Rate Limits (Requests per 15 Minutes)

### User Tweet Timeline: `GET /2/users/:id/tweets`

**Rate limits vary by access level and authentication method:**

#### With OAuth 2.0 Bearer Token (App-Level):
- **Free Access:** Typically 1-5 requests per 15 minutes (conservative estimate)
- **Basic Access:** Higher limits
- **Pro/Enterprise:** 180+ requests per 15 minutes

#### With OAuth 1.0a User Context (User-Level):
- **Free Access:** Lower limits
- **Higher Tiers:** Up to 900 requests per 15 minutes per user

**Note:** Exact limits for Free Access are not always clearly documented, but testing shows:
- **Estimated: 1-5 requests per 15 minutes** for tweet fetching
- **User lookup: ~15 requests per 15 minutes**

---

## Understanding the Limits

### Example Scenario: Free Access

**Monthly Quota:**
- You have **500 posts** total for the month
- Each API response can return up to **100 tweets** per request
- So you can make **5 requests** (5 × 100 = 500 tweets) over the entire month
- OR make fewer requests if you need to spread them out

**Rate Limit:**
- You can make **1-5 requests per 15 minutes**
- After hitting the rate limit, you must wait 15 minutes

**The Constraint:**
- Even if you have 500 posts remaining in your monthly quota
- You can only make 1-5 requests every 15 minutes
- This means fetching 500 tweets takes at least 15 minutes (if you get 5 requests per window)
- Or up to 5 hours (if you only get 1 request per 15 minutes)

---

## Calculation for Large Batch Fetching

### Scenario: Fetching 2000 tweets with Free Access

**Monthly Quota Check:**
- Need 2000 tweets
- Monthly limit: 500 posts
- **❌ CANNOT FETCH 2000 TWEETS ON FREE TIER IN ONE MONTH**
- Maximum: 500 tweets per month

### Scenario: Fetching 500 tweets (Free Tier Maximum)

**Best Case (5 requests per 15 minutes):**
- 500 tweets ÷ 100 tweets per request = **5 requests needed**
- 5 requests ÷ 5 requests per window = **1 window** (15 minutes)
- **Total time: ~15 minutes**

**Worst Case (1 request per 15 minutes):**
- 500 tweets ÷ 100 tweets per request = **5 requests needed**
- 5 requests ÷ 1 request per window = **5 windows** (75 minutes)
- **Total time: ~1.25 hours**

---

## What This Means for Your Project

### Current Status
- **Monthly Quota:** 500 posts (Free Access)
- **Rate Limit:** ~1-5 requests per 15 minutes
- **Max tweets per request:** 100

### Safe Fetching Strategy

**Option 1: Small Batch (Recommended for Free Tier)**
```bash
# Fetch 500 tweets (monthly limit)
python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind --max-batches 5
```
- Time: 15 minutes to 1.25 hours
- Uses entire monthly quota

**Option 2: Spread Across Multiple Months**
- Fetch 500 tweets per month
- Over 4 months = 2000 tweets total
- Requires planning and patience

**Option 3: Upgrade to Higher Tier**
- Basic: 10,000 posts/month
- Pro: 1,000,000 posts/month
- Allows larger batch fetching

---

## Recommendations

### For Free Access:
1. ✅ **Use `wait_on_rate_limit=True`** - Automatically handles rate limits
2. ✅ **Monitor monthly quota** - Track how many posts you've consumed
3. ✅ **Fetch in batches** - Don't exceed monthly limit
4. ✅ **Plan ahead** - Spread large fetches across months
5. ⚠️ **Be conservative** - Free tier is very limited

### For Production Use:
1. **Upgrade to Basic or Pro** - Much higher limits
2. **Monitor both limits** - Monthly quota AND rate limits
3. **Implement quota tracking** - Log how many posts consumed
4. **Use efficient pagination** - Minimize requests

---

## References

- [X Developer Portal - Rate Limits](https://developer.x.com/en/support/x-api/v2)
- [X API Fundamentals - Rate Limits](https://docs.x.com/x-api/fundamentals/rate-limits)
- [X API v1 Rate Limits](https://developer.x.com/en/docs/x-api/v1/rate-limits)

---

## Key Takeaways

1. **Free Access = 500 posts/month maximum**
2. **Rate limit = 1-5 requests per 15 minutes**
3. **You must respect BOTH limits**
4. **For 2000 tweets, you need multiple months OR upgrade tier**
5. **Use `wait_on_rate_limit=True` to handle rate limits automatically**

