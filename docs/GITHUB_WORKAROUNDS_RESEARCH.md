# GitHub Workarounds Research: Fetching Older Tweets

**Date:** 2025-01-27  
**Purpose:** Research GitHub repositories for workarounds to fetch older tweets beyond 3,200 limit

---

## 🔍 Key Finding: New App Won't Help

**Creating a new Twitter API app does NOT solve the problem:**
- ❌ The 3,200 limit is tied to the **user account**, not the app
- ❌ You cannot "start from oldest tweet" - API always returns newest first
- ❌ Multiple apps still see the same 3,200 most recent tweets
- ❌ The limit is enforced at the API level, not app level

---

## 📚 GitHub Repositories Found

### 1. **Rettiwt-API** ⚠️
**Repository:** https://github.com/RishiKant181/Rettiwt-API

**What it does:**
- CLI tool and API for fetching Twitter data
- Works **without official Twitter API key**
- Uses "guest" and "user" authentication methods
- Can fetch older tweets beyond 3,200 limit

**How it works:**
- Accesses Twitter's internal/guest API endpoints
- Bypasses official API restrictions
- Can scrape tweets without API credentials

**⚠️ Risks:**
- May violate Twitter's Terms of Service
- Could lead to IP/account bans
- Uses unofficial endpoints (may break)
- Not officially supported

**Status:** ⚠️ Use at your own risk - may violate ToS

---

### 2. **Twikit** ⚠️
**Repository:** https://github.com/d60/twikit

**What it does:**
- Simple Twitter API scraper
- Works without API key
- Uses Twitter's internal API
- Can post and search tweets

**How it works:**
- Reverse engineers Twitter's internal API
- Uses guest authentication
- Bypasses official API restrictions

**⚠️ Risks:**
- Definitely violates Twitter's ToS
- High risk of account/IP bans
- Unstable (breaks when Twitter changes internal API)
- Not recommended for production use

**Status:** ❌ High risk - violates ToS

---

### 3. **Twitterscraper** ⚠️
**Repository:** https://github.com/taspinar/twitterscraper

**What it does:**
- Python library for scraping tweets
- Can retrieve tweets from specific users
- Supports date range queries
- No API key required

**How it works:**
- Web scraping approach
- Parses HTML/JSON from Twitter web interface
- Bypasses API entirely

**⚠️ Risks:**
- Violates Twitter's Terms of Service
- Can lead to IP bans
- Fragile (breaks when Twitter changes UI)
- May be blocked by Twitter

**Status:** ❌ Not recommended - violates ToS and fragile

---

### 4. **Twitter-API-V2-full-archive-Search-academics** ✅
**Repository:** https://github.com/AdriaPadilla/Twitter-API-V2-full-archive-Search-academics

**What it does:**
- Python script for full-archive search
- Uses Twitter's official Academic Research API
- Requires Academic Research access

**How it works:**
- Uses official `GET /2/tweets/search/all` endpoint
- Legitimate Academic Research access
- Full-archive search capabilities

**✅ Benefits:**
- Official Twitter API
- No ToS violations
- Stable and supported
- Complete tweet history

**Requirements:**
- Academic Research access (need to apply)
- Eligible academic affiliation

**Status:** ✅ Recommended - if you have Academic Research access

---

### 5. **search-tweets-python** ✅
**Repository:** https://github.com/xdevplatform/search-tweets-python

**What it does:**
- Official Twitter Python client
- Supports search and count endpoints
- Includes full-archive search (with elevated access)

**How it works:**
- Official Twitter library
- Uses standard API endpoints
- Supports Academic Research access

**✅ Benefits:**
- Official Twitter repository
- Well-maintained
- Supports all API tiers
- No ToS violations

**Status:** ✅ Recommended - official Twitter library

---

## 🎯 Analysis: Can You Start from Oldest Tweet?

### Question: Can a new app start from oldest tweet (2025-02-14)?

**Answer: ❌ NO**

**Why:**
1. **API Behavior:** Twitter API always returns tweets in reverse chronological order (newest first)
2. **No Starting Point Parameter:** There's no parameter to "start from oldest tweet"
3. **Pagination Only:** You can only paginate backward using `pagination_token`
4. **Same Data:** All apps see the same 3,200 most recent tweets for a user
5. **Limit Enforcement:** The 3,200 limit is at the API/user level, not app level

**What happens if you create a new app:**
- Same 3,200 most recent tweets
- Same pagination behavior
- Still can't access tweets older than the 3,200 limit
- No advantage over existing app

---

## 💡 Alternative Approaches

### Option 1: Use `until_id` + Pagination (Current Approach) ✅
**Status:** Already implemented in `fetch_remaining_tweets.py`

**How it works:**
1. Use `until_id` with oldest tweet ID
2. Continue with `pagination_token`
3. Should work within 3,200 limit

**Code:**
```python
# First batch: Use until_id
response = client.get_users_tweets(
    id=user_id,
    max_results=100,
    until_id=oldest_tweet_id,  # Start from oldest we have
    exclude=['retweets'],
)

# Subsequent batches: Use pagination_token
if response.meta and 'next_token' in response.meta:
    pagination_token = response.meta['next_token']
    response = client.get_users_tweets(
        id=user_id,
        pagination_token=pagination_token,  # Continue backward
        max_results=100,
        exclude=['retweets'],
    )
```

**Limitation:** Only works within 3,200 limit

---

### Option 2: Academic Research Access ✅
**Status:** Need to apply (2-4 weeks)

**Benefits:**
- Full-archive search
- No 3,200 limit
- Official API access
- No ToS violations

**Requirements:**
- Academic affiliation
- Research project
- Non-commercial use

---

### Option 3: Third-Party Tools ⚠️
**Status:** High risk - violates ToS

**Tools:**
- Rettiwt-API
- Twikit
- Twitterscraper

**Risks:**
- Account/IP bans
- ToS violations
- Unstable
- May break

**Recommendation:** ❌ Not recommended for production use

---

## 🔬 Testing: Multiple Apps Strategy

**Question:** Can multiple apps see different tweet windows?

**Answer: ❌ NO**

**Why:**
- The 3,200 limit is per user account, not per app
- All apps see the same 3,200 most recent tweets
- API enforces limit at user level
- Creating multiple apps doesn't give you different windows

**Test Scenario:**
```
App 1: Fetches 3,200 most recent tweets
App 2: Fetches same 3,200 most recent tweets
App 3: Fetches same 3,200 most recent tweets
```

**Result:** All apps see the same tweets - no advantage

---

## 📊 Comparison Table

| Method | ToS Compliant | Stable | Older Tweets | Risk |
|--------|--------------|--------|--------------|------|
| **Official API v2** | ✅ Yes | ✅ Yes | ❌ 3,200 limit | ✅ Low |
| **Academic Research** | ✅ Yes | ✅ Yes | ✅ Full archive | ✅ Low |
| **Rettiwt-API** | ❌ No | ⚠️ Maybe | ✅ Yes | ⚠️ High |
| **Twikit** | ❌ No | ❌ No | ✅ Yes | ❌ Very High |
| **Twitterscraper** | ❌ No | ❌ No | ✅ Yes | ❌ Very High |
| **Multiple Apps** | ✅ Yes | ✅ Yes | ❌ Same limit | ✅ Low |

---

## 🎯 Recommendations

### For Remaining 693 Tweets (Within 3,200 Limit):
1. ✅ **Use current approach** - `until_id` + `pagination_token`
2. ✅ **Continue paginating backward** from oldest tweet
3. ✅ **Should work** within the 3,200 limit

### For Tweets Beyond 3,200 Limit:
1. ✅ **Apply for Academic Research** (if eligible)
2. ✅ **Use Full-Archive Search** endpoint
3. ❌ **Don't use third-party scrapers** (ToS violations)

### What NOT to Do:
1. ❌ **Don't create new app** - won't help
2. ❌ **Don't use unofficial scrapers** - ToS violations
3. ❌ **Don't try multiple apps** - same limit

---

## 📝 Code Example: Testing Multiple Apps

If you want to test if multiple apps see different data:

```python
import tweepy
import os

# Test with App 1
client1 = tweepy.Client(bearer_token=os.getenv('X_BEARER_TOKEN_APP1'))
response1 = client1.get_users_tweets(
    id=user_id,
    max_results=10,
)

# Test with App 2
client2 = tweepy.Client(bearer_token=os.getenv('X_BEARER_TOKEN_APP2'))
response2 = client2.get_users_tweets(
    id=user_id,
    max_results=10,
)

# Compare results
print(f"App 1 oldest: {response1.data[-1].created_at}")
print(f"App 2 oldest: {response2.data[-1].created_at}")
# They will be the same!
```

**Expected Result:** Both apps return the same tweets

---

## 🔗 Resources

- **Rettiwt-API:** https://github.com/RishiKant181/Rettiwt-API
- **Twikit:** https://github.com/d60/twikit
- **Twitterscraper:** https://github.com/taspinar/twitterscraper
- **Academic Research Example:** https://github.com/AdriaPadilla/Twitter-API-V2-full-archive-Search-academics
- **Official Search Client:** https://github.com/xdevplatform/search-tweets-python

---

## ✅ Conclusion

**Creating a new app won't help:**
- Same 3,200 limit
- Same tweet data
- Can't start from oldest tweet
- No advantage

**Best approach:**
1. ✅ Continue with `until_id` + `pagination_token` for remaining 693 tweets
2. ✅ Apply for Academic Research access for tweets beyond 3,200 limit
3. ❌ Avoid third-party scrapers (ToS violations)

**Status:** New app strategy won't work - stick with current approach

