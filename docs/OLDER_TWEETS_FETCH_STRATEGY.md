# Strategy for Fetching Older Tweets - Research Findings

**Date:** 2025-01-27  
**Issue:** We're wasting API calls by re-fetching already-ingested tweets

---

## Problem Analysis

### Current Situation
- ✅ **Already have:** 2,504 tweets from 2025-02-14 to 2025-11-03
- ❌ **Problem:** Script starts from NEWEST tweets (2025-11-04) and goes backward
- ❌ **Result:** First 2-3 batches fetch duplicates (wasting API calls)
- ❌ **Cost:** Hit rate limit after only 3 batches (186 tweets fetched, 0 new)

### Root Cause
Twitter API v2 `get_users_tweets` with `pagination_token`:
- Always starts from NEWEST tweets
- Cannot "jump" to a specific date or tweet ID
- Must paginate sequentially backward
- **No way to resume from a specific point in time**

---

## Research Findings

### 1. Twitter API Limitations
- **Search API:** Only last 7 days
- **User Timeline:** Up to 3,200 most recent tweets
- **No date-based filtering:** Can't request tweets from a specific date range
- **Sequential pagination only:** Must go through all tweets sequentially

### 2. The Correct Approach
Based on research and GitHub examples:

**Option A: Save Pagination Token (Best)**
- Save the last `pagination_token` used during fetch
- Resume from that token to continue backward
- **Problem:** We didn't save tokens from previous fetches

**Option B: Skip Until We Reach Old Territory**
- Start from newest, paginate backward
- Check each tweet's date against our oldest (2025-02-14)
- Skip insertion if date >= oldest (already have it)
- Continue until we find tweets older than 2025-02-14
- **Problem:** Still wastes API calls on duplicates

**Option C: Accept Duplicates (Current)**
- Let deduplication handle it (ON CONFLICT DO NOTHING)
- **Problem:** Wastes API quota on duplicates

---

## Recommended Solution

### Strategy: Smart Skip with Date Checking

**Key Insight:** We can't avoid fetching some duplicates, but we can:
1. Check dates BEFORE inserting to database
2. Skip API calls for batches that are entirely too new
3. Stop when we reach our target date

**Implementation:**
```python
1. Fetch batch of tweets
2. Check oldest tweet date in batch
3. If date >= our oldest date (2025-02-14):
   - Skip database insertion (saves DB writes)
   - Continue to next batch immediately
4. If date < our oldest date:
   - Insert tweets (new data!)
   - Continue until target date reached
```

**Benefits:**
- Still uses API calls, but skips database work on duplicates
- Automatically stops when reaching old territory
- Minimal code changes

---

## Alternative: Save Pagination Token for Future

**For Next Time:**
1. Save last `pagination_token` to database or file
2. Resume from that token to continue backward
3. This avoids re-fetching already-ingested range

**Implementation:**
```python
# Save token after each batch
last_token = response.meta.get('next_token')
save_pagination_token(last_token)

# Resume later
pagination_token = load_pagination_token()
if pagination_token:
    # Continue from where we left off
    response = client.get_users_tweets(
        pagination_token=pagination_token,
        ...
    )
```

---

## Immediate Solution

Since we don't have saved tokens, we need to:

1. **Accept that we'll fetch some duplicates** (already have deduplication)
2. **Optimize:** Skip database insertion for batches that are entirely too new
3. **Test:** Use max_results=2 for testing to minimize API usage
4. **Monitor:** Check dates carefully before inserting

---

## Key Learnings

1. **Twitter API doesn't support date-based filtering** for user tweets
2. **Must paginate sequentially** - cannot jump to specific dates
3. **Pagination tokens are the key** - save them for resuming
4. **Deduplication is essential** - but doesn't save API calls
5. **Test with 1-2 tweets first** - don't waste quota on large batches

---

## Next Steps

1. ✅ Create minimal test script (1-2 tweets)
2. ✅ Implement date-based skipping
3. ✅ Add pagination token saving for future use
4. ✅ Test carefully before full fetch

---

**References:**
- Twitter API v2 Documentation
- GitHub: twitter-advanced-search, Rettiwt-API
- Community discussions on fetching older tweets

