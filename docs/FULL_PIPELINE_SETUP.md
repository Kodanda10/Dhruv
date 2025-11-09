# Full Pipeline Setup & Execution Guide

## Overview

Complete end-to-end pipeline orchestration for transitioning from demo data to live production pipeline.

## Prerequisites

### 1. Database Setup
- PostgreSQL database running
- `DATABASE_URL` environment variable set
- At least 2,500+ tweets in `raw_tweets` table

### 2. GitHub Secrets
Add these to GitHub → Settings → Secrets and variables → Actions:

- `DATABASE_URL` - PostgreSQL connection string
- `TWITTER_BEARER_TOKEN` - Twitter API bearer token
- `GEMINI_API_KEY` - Google Gemini API key
- `EMAIL_USER` - Gmail address for notifications (optional)
- `EMAIL_PASSWORD` - Gmail app password (optional)

**Note**: Email notifications require Gmail App Password:
1. Enable 2FA on Gmail
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use app password (not regular password) in `EMAIL_PASSWORD`

## Files Created

### Scripts
- ✅ `scripts/ops/db-helpers.js` - Database helper functions
- ✅ `scripts/ops/run-full-pipeline.sh` - Full pipeline orchestrator
- ✅ `scripts/ops/send-email-notification.js` - Email notification helper
- ✅ `scripts/ops/pipeline-monitor.js` - Pipeline health monitor

### Workflows
- ✅ `.github/workflows/run-full-pipeline.yml` - Manual full pipeline run
- ✅ `.github/workflows/pipeline-monitor.yml` - Automated monitoring (every 2h)

### npm Scripts
- ✅ `npm run ops:run-full-pipeline` - Run full pipeline locally
- ✅ `npm run ops:monitor` - Run pipeline monitor
- ✅ `npm run db:count-tweets` - Count tweets in database

## Execution Methods

### Method 1: Run Locally

```bash
# Step 1: Verify tweet count
npm run db:count-tweets

# Step 2: Run full pipeline
npm run ops:run-full-pipeline
```

**Expected Output**:
```
🔍 Step 1: Checking tweet count in database...
✅ Total tweets in DB: 2500+

🧹 Step 2: Removing sample / dummy tweets...
✅ Sample tweets removed: 0

⚙️ Step 3: Running backfill parser for pending tweets...
📊 Pending tweets to parse: 2500
📡 Step 4: Live Parsing Log (monitoring in background)
   Log file: logs/parse-all.log

... (parsing progress) ...

✅ Parser completed
🧭 Step 5: Checking parsed events count...
✅ Parsed events: 2450
✅ Approved events (ready for analytics): 0

📊 Step 6: Verifying Analytics API response...
✅ Analytics API responding

🧪 Step 7: Running pipeline integration tests...
✅ Tests passed

📈 Step 8: Final Pipeline Statistics...
Raw Tweets:
  - Total: 2500
  - Pending: 50
  - Parsed: 2450
  - Failed: 0

Parsed Events: 2450

Review Status:
  - Needs Review: 2450
  - Approved: 0
  - Rejected: 0

✅ FULL PIPELINE COMPLETED SUCCESSFULLY
```

### Method 2: Run via GitHub Actions

1. **Go to GitHub Actions**:
   - Navigate to: https://github.com/Kodanda10/Dhruv/actions
   - Find "🚀 Run Full Pipeline (Backfill + Live Sync)"

2. **Trigger Workflow**:
   - Click "Run workflow"
   - Type `RUN` in confirmation field
   - Click "Run workflow"

3. **Monitor Progress**:
   - Watch logs in real-time
   - Download `parse-logs` artifact after completion

## Pipeline Steps Explained

### Step 1: Verify Database Count
- Checks total tweets in `raw_tweets` table
- Requires ≥100 tweets to proceed
- **Command**: `npm run db:count-tweets`

### Step 2: Remove Sample Tweets
- Removes any tweets marked `is_sample = true`
- Safe operation (only removes test data)
- Skips if `is_sample` column doesn't exist

### Step 3: Run Backfill Parser
- Processes all `processing_status='pending'` tweets
- Uses three-layer consensus parser
- Updates status to 'parsed' or 'failed'
- **Command**: `npm run ops:parse-all-pending`

### Step 4: Monitor Live Logs
- Shows real-time parsing progress
- Logs saved to `logs/parse-all.log`
- Can be monitored with `tail -f logs/parse-all.log`

### Step 5: Check Parsed Events
- Counts total parsed events
- Counts approved events (ready for analytics)
- Verifies data flow

### Step 6: Verify Analytics API
- Tests `/api/analytics` endpoint
- Confirms data reaching dashboard
- Requires server to be running (`npm run dev`)

### Step 7: Run Integration Tests
- Validates full pipeline integration
- Tests fetch → parse → review → analytics flow
- **Command**: `npm test`

### Step 8: Final Statistics
- Shows complete pipeline status
- Raw tweets breakdown
- Parsed events count
- Review queue status

## Monitoring

### Automated Monitoring (Every 2 Hours)

The `pipeline-monitor.yml` workflow:
- Runs automatically every 2 hours
- Checks pipeline health
- Sends email to `9685528000as@gmail.com`
- Alerts on issues:
  - Pending queue > 500 tweets
  - Failed count > 100 tweets
  - Review queue > 50 events

### Manual Monitoring

```bash
# Check pipeline health
npm run ops:pipeline-health

# Check review queue metrics
npm run ops:commandview

# Run monitor manually
npm run ops:monitor
```

## Email Notifications

### Setup Email (Optional)

1. **Gmail Setup**:
   ```bash
   # In .env.local or GitHub Secrets
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   NOTIFICATION_EMAIL=9685528000as@gmail.com
   ```

2. **Test Email**:
   ```bash
   node scripts/ops/pipeline-monitor.js
   ```

3. **First Email**:
   - Sent when monitoring workflow runs successfully
   - Confirms integration working
   - Contains pipeline status report

### Email Content

**Subject**: `📊 Pipeline Status Report - [Date]`

**Body**:
- Raw tweets statistics
- Parsed events count
- Review queue status
- Issues detected (if any)

## Troubleshooting

### Issue: "Too few tweets"
**Solution**: Verify database has tweets:
```bash
npm run db:count-tweets
psql $DATABASE_URL -c "SELECT COUNT(*) FROM raw_tweets;"
```

### Issue: "Email not configured"
**Solution**: Set email credentials (optional):
```bash
export EMAIL_USER=your-email@gmail.com
export EMAIL_PASSWORD=your-app-password
```

### Issue: "Analytics API not reachable"
**Solution**: Start development server:
```bash
npm run dev
```

### Issue: "Parser fails"
**Solution**: Check logs:
```bash
tail -f logs/parse-all.log
# Check for API rate limits or errors
```

### Issue: "Tests fail"
**Solution**: Review test output:
```bash
npm test -- --verbose
```

## Post-Execution Checklist

After running full pipeline:

- [ ] ✅ All tweets parsed (check `parsed_events` count)
- [ ] ✅ Review queue populated (visit `/review`)
- [ ] ✅ Analytics API responding (check `/api/analytics`)
- [ ] ✅ Dashboard showing data (after approval)
- [ ] ✅ Email notification received (if configured)
- [ ] ✅ Monitoring workflow running (check GitHub Actions)

## Next Steps

1. **Review Events**: Visit `/review` to approve parsed events
2. **Verify Dashboard**: Check `/analytics` after approval
3. **Monitor**: Watch automated monitoring emails
4. **Archive**: After successful backfill, archive backfill script

## Expected End State

| Stage | Status |
|-------|--------|
| Raw Tweets | 2,500+ real tweets |
| Sample Data | Removed |
| Parser | Completed (backfill) |
| Review | Operational |
| Analytics | Showing full data (after approval) |
| Fetch Job | Running hourly |
| Monitoring | Running every 2h |
| Email Notifications | Active |

---

**Status**: ✅ **READY TO EXECUTE**

Run `npm run ops:run-full-pipeline` locally or trigger GitHub Action workflow.


