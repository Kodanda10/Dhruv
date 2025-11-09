# Pipeline Architecture Clarification

## Current Situation

You have **2,500+ tweets already in the database** (`raw_tweets` table) that were fetched previously. These tweets likely have `processing_status='pending'` and need to be parsed.

## The Issue with Previous Plan

The previous plan created an **hourly scheduled workflow for parsing**, which doesn't make sense because:
- ✅ Parsing existing tweets is a **one-time operation** (not recurring)
- ✅ Once existing tweets are parsed, we only need to parse **new tweets** as they come in
- ✅ New tweets should be parsed **immediately after fetch** (or in the same workflow)

## Correct Architecture

### Phase 1: One-Time Backfill (Existing 2,500+ Tweets)
**Goal**: Parse all existing tweets in the database

**Solution**: 
- Create a **one-time script** that processes all pending tweets
- Run it manually or via a one-time GitHub Action trigger
- This is NOT a scheduled workflow

**Script**: `scripts/ops/parse-all-pending-tweets.js`
- Processes all `raw_tweets` where `processing_status='pending'`
- Uses the existing three-layer consensus parser
- Can run in batches to avoid timeouts
- Updates `processing_status` to 'parsed' or 'failed'

### Phase 2: Ongoing Operations (New Tweets Only)
**Goal**: Fetch new tweets hourly and parse them immediately

**Solution**:
- **Single workflow**: Fetch → Parse (in sequence)
- Runs hourly to get latest tweets from @opchoudhary
- After fetching, immediately parse the new tweets
- No separate parsing workflow needed

**Workflow**: `.github/workflows/fetch-and-parse-hourly.yml`
- Step 1: Fetch new tweets (`scripts/fetch_tweets.py --resume`)
- Step 2: Parse newly fetched tweets (`scripts/parse_tweets_with_three_layer.js`)
- Both steps in one workflow, runs hourly

## Why Existing Tweets Aren't in Dashboard

The analytics dashboard (`/api/analytics`) filters to:
```sql
needs_review = false AND (review_status IS NULL OR review_status = 'approved')
```

So tweets need to:
1. ✅ Be parsed (create `parsed_events` record)
2. ✅ Be reviewed and approved (or auto-approved if confidence high)
3. ✅ Have `needs_review=false`

**Current state**: Existing tweets are likely:
- ❌ Not parsed yet (`processing_status='pending'`)
- ❌ No `parsed_events` records exist
- ❌ Can't appear in analytics until parsed + reviewed

## Action Plan

### Step 1: Create One-Time Backfill Script
- Script: `scripts/ops/parse-all-pending-tweets.js`
- Processes all pending tweets in batches
- Can be run manually or via one-time GitHub Action

### Step 2: Update Hourly Workflow
- Combine fetch + parse into single workflow
- Remove separate parsing workflow
- Parse new tweets immediately after fetch

### Step 3: Run Backfill
- Execute one-time script to parse all 2,500+ existing tweets
- Monitor progress
- Once complete, only new tweets need parsing

### Step 4: Review & Approve
- Reviewers use `/review` UI to approve parsed events
- Once approved, they appear in analytics dashboard
- This is manual work, not automated

## Summary

| Operation | Type | Frequency | Method |
|-----------|------|-----------|--------|
| Parse existing 2,500+ tweets | One-time | Once | Manual script |
| Fetch new tweets | Ongoing | Hourly | GitHub Actions |
| Parse new tweets | Ongoing | After fetch | Same workflow as fetch |
| Review parsed events | Ongoing | Manual | UI at `/review` |


