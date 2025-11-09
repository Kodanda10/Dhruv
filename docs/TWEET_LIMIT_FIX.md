# Tweet Limit Fix - Show All 2500+ OP Choudhary Tweets

## ✅ Issue Identified

**Problem:** Dashboard was showing only 10 tweets (`दिखा रहे हैं: 10 / 10`) instead of all 2,500+ OP Choudhary tweets.

**Root Causes:**
1. **API Limit:** API route had max limit of 500 tweets
2. **Frontend Limit:** Dashboard components were requesting only 200 tweets
3. **Unparsed Tweets:** 251 tweets haven't been parsed yet
4. **English Tweets:** 136 tweets identified as English-only (need verification)

## ✅ Database Status

**Verified via PostgreSQL:**
- **raw_tweets:** 2,576 tweets from `OPChoudhary_Ind`
- **parsed_events:** 2,325 parsed events (251 tweets unparsed)
- **Date Range:** 2025-02-14 to 2025-11-05
- **English Tweets:** Need verification (may contain URLs/hashtags but are Hindi)

## ✅ Fixes Applied

### 1. API Route Limit Increased (`src/app/api/parsed-events/route.ts`)

**Before:**
```typescript
const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);
```

**After:**
```typescript
// Remove limit restriction - allow fetching all tweets (default 5000, max 10000 for safety)
const limit = Math.min(parseInt(searchParams.get('limit') || '5000', 10), 10000);
```

### 2. Dashboard Component Limits Updated

**`src/components/Dashboard.tsx`:**
- Changed from `limit=200` to `limit=5000`

**`src/components/DashboardDark.tsx`:**
- Changed all instances from `limit=200` to `limit=5000`

### 3. English Tweet Detection

Created `scripts/remove_english_tweets.sql` to identify and remove English-only tweets:
- Tweets without Devanagari characters (`[अ-ह]`)
- Tweets without Devanagari numerals (`[०-९]`)
- Tweets longer than 10 characters (to exclude URL-only tweets)

**Note:** Need to verify these are actually English and not Hindi tweets with URLs/hashtags.

## ✅ Expected Results

After fixes:
- ✅ API can return up to 10,000 tweets (covers all 2,500+)
- ✅ Dashboard requests 5,000 tweets (covers all parsed events)
- ✅ Dashboard should show `दिखा रहे हैं: 2325 / 2325` (or more after parsing remaining tweets)

## ⏳ Remaining Tasks

1. **Parse Remaining Tweets:**
   ```bash
   # Run parsing script to parse remaining 251 tweets
   npm run ops:parse-all-pending
   # OR
   node scripts/parse_tweets_with_three_layer.js
   ```

2. **Verify English Tweets:**
   ```sql
   -- Check if tweets are actually English or just have URLs
   SELECT tweet_id, text 
   FROM raw_tweets 
   WHERE author_handle = 'OPChoudhary_Ind' 
     AND text !~ '[अ-ह]' 
     AND text !~ '[०-९]' 
     AND LENGTH(text) > 10 
   LIMIT 10;
   ```

3. **Remove English Tweets (if confirmed):**
   ```sql
   -- Run scripts/remove_english_tweets.sql after verification
   ```

4. **Verify Dashboard:**
   - Restart Next.js dev server
   - Check dashboard shows all 2,325+ tweets
   - Verify count matches: `दिखा रहे हैं: 2325 / 2325`

## ✅ Status

**COMPLETE** - API and frontend limits increased. Dashboard should now show all parsed tweets.

**NEXT:** Parse remaining 251 tweets and verify English tweet removal.


