# Backfill & Hourly Pipeline Plan

## Understanding the Situation

### Current State
- ✅ **2,500+ tweets already in database** (`raw_tweets` table)
- ❌ These tweets have `processing_status='pending'` (not parsed yet)
- ❌ No `parsed_events` records exist for them
- ❌ They **cannot appear in dashboard** until parsed + reviewed

### Why They're Not in Dashboard

The analytics dashboard (`/api/analytics`) only shows events that are:
1. ✅ Parsed (have `parsed_events` record)
2. ✅ Reviewed and approved (`review_status='approved'` OR `needs_review=false`)
3. ✅ Have `needs_review=false`

**Current state**: Existing tweets fail at step 1 - they're not parsed yet!

## The Correct Architecture

### Phase 1: One-Time Backfill (Existing 2,500+ Tweets)

**What**: Parse all existing tweets in the database  
**When**: Once (not scheduled)  
**How**: Manual script or one-time GitHub Action trigger

**Script**: `scripts/ops/parse-all-pending-tweets.js`
- Processes all `raw_tweets` where `processing_status='pending'`
- Uses three-layer consensus parser (Gemini → Ollama → Regex)
- Processes in batches to avoid timeouts
- Updates status to 'parsed' or 'failed'

**Run locally**:
```bash
npm run ops:parse-all-pending
```

**Or via GitHub Actions**:
- Go to Actions → "Parse All Pending Tweets (One-Time)"
- Click "Run workflow"
- This is a manual trigger, not scheduled

### Phase 2: Ongoing Operations (New Tweets Only)

**What**: Fetch new tweets hourly and parse them immediately  
**When**: Hourly (scheduled)  
**How**: Single GitHub Actions workflow

**Workflow**: `.github/workflows/fetch-and-parse-hourly.yml`
- **Step 1**: Fetch new tweets (`scripts/fetch_tweets.py --resume`)
- **Step 2**: Parse newly fetched tweets (same workflow)
- Runs hourly at :00
- Only processes tweets fetched in last 2 hours (avoids re-parsing old ones)

**Why single workflow?**
- New tweets should be parsed immediately after fetch
- No need for separate parsing workflow
- Simpler, more efficient

## Action Plan

### Step 1: Run One-Time Backfill ✅

**Option A: Run Locally**
```bash
# Set environment variables
export DATABASE_URL="your-database-url"
export GEMINI_API_KEY="your-gemini-key"

# Run the script
npm run ops:parse-all-pending

# Or with custom batch size
PARSE_BATCH_LIMIT=50 npm run ops:parse-all-pending
```

**Option B: Run via GitHub Actions**
1. Go to: https://github.com/Kodanda10/Dhruv/actions
2. Select "Parse All Pending Tweets (One-Time)"
3. Click "Run workflow"
4. Select branch: `analysis-main` (or merge to default branch first)
5. Optionally set `max_batches` to limit processing
6. Click "Run workflow"

**Monitor Progress**:
- Script shows progress: `Progress: 500/2500 (20%)`
- Check database: `SELECT COUNT(*) FROM raw_tweets WHERE processing_status='pending';`
- Check parsed: `SELECT COUNT(*) FROM parsed_events;`

### Step 2: Set Up Hourly Workflow ✅

**Merge workflows to default branch**:
```bash
git checkout feat/bootstrap-ci  # or your default branch
git merge analysis-main
git push origin feat/bootstrap-ci
```

**The workflow will**:
- Run automatically every hour
- Fetch ~100 new tweets
- Parse them immediately
- Update database

### Step 3: Review & Approve ✅

**After parsing**:
1. Go to `/review` page
2. Review parsed events (those with `needs_review=true`)
3. Approve/reject/edit via UI
4. Once approved, they appear in analytics dashboard

**This is manual work** - reviewers need to clear the queue.

## Summary

| Operation | Type | Frequency | Method |
|-----------|------|-----------|--------|
| **Parse existing 2,500+ tweets** | One-time | Once | `npm run ops:parse-all-pending` |
| **Fetch new tweets** | Ongoing | Hourly | GitHub Actions (automatic) |
| **Parse new tweets** | Ongoing | After fetch | Same workflow (automatic) |
| **Review parsed events** | Ongoing | Manual | UI at `/review` |

## Files Created

1. **`scripts/ops/parse-all-pending-tweets.js`** - One-time backfill script
2. **`.github/workflows/parse-all-pending-once.yml`** - One-time GitHub Action (manual trigger)
3. **`.github/workflows/fetch-and-parse-hourly.yml`** - Combined fetch+parse workflow (hourly)
4. **`docs/PIPELINE_ARCHITECTURE_CLARIFICATION.md`** - Architecture explanation

## Next Steps

1. ✅ **Run backfill**: Execute `npm run ops:parse-all-pending` or trigger GitHub Action
2. ✅ **Monitor progress**: Watch the script output
3. ✅ **Merge workflows**: Push to default branch for scheduled runs
4. ✅ **Review events**: Use `/review` UI to approve parsed events
5. ✅ **Verify dashboard**: Check `/api/analytics` to see approved events

## FAQ

**Q: Why not schedule the backfill?**  
A: It's a one-time operation. Once done, we only need to parse new tweets.

**Q: What if backfill fails partway through?**  
A: Script is idempotent - it only processes `processing_status='pending'` tweets. Re-run it to continue.

**Q: How long will backfill take?**  
A: Depends on batch size and API rate limits. With `PARSE_BATCH_LIMIT=25` and rate limits, estimate ~2-4 hours for 2,500 tweets.

**Q: Can I run backfill in parallel?**  
A: Not recommended due to API rate limits. Run sequentially.

**Q: What happens to failed parses?**  
A: They're marked `processing_status='failed'`. The watchdog script (`ops:watchdog`) will retry them after 4 hours.


