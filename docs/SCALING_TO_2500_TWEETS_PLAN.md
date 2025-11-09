# Scaling to 2,500+ Tweets: Implementation Plan

This document outlines the end-to-end implementation for scaling from 100-tweet batches to 2,500+ tweets and surfacing them in Analytics.

## Overview

The pipeline consists of 5 main stages:
1. **Fetch** - Hourly tweet fetching from Twitter API
2. **Parse** - Automated parsing using three-layer consensus engine
3. **Review** - Human review queue via UI
4. **Analytics** - Dashboard showing approved events
5. **Validation** - Monitoring and health checks

## Implementation Components

### 1. Fetch Pipeline (`scripts/fetch_tweets.py`)

**Scheduling**: Hourly via GitHub Actions (`.github/workflows/fetch-tweets.yml`)

**Behavior**:
- Runs `scripts/fetch_tweets.py --handle opchoudhary --resume`
- Fetches ~100 tweets per run (respects rate limits with 15-minute pauses)
- Stores in `raw_tweets` table with `processing_status='pending'`
- Logs metrics for monitoring

**Monitoring**:
- Check `raw_tweets.fetched_at` for recent activity
- Monitor logs for "Pausing 15 minutes" messages (confirms rate-limit handling)
- Track `raw_tweets` counts: pending, parsed, failed

### 2. Parse Pipeline (`scripts/parse_tweets_with_three_layer.js`)

**Scheduling**: Hourly via GitHub Actions (`.github/workflows/parse-tweets.yml`)

**Behavior**:
- Runs every hour at :15 (15 minutes after fetch)
- Processes up to `PARSE_BATCH_LIMIT=25` tweets per iteration
- Runs multiple iterations until `processing_status='pending'` drops to zero
- Uses three-layer consensus: Gemini → Ollama → Regex (with fallback)
- Updates `raw_tweets.processing_status` to 'parsed' or 'failed'
- Creates `parsed_events` records with confidence scores

**Watchdog** (`.github/workflows/parser-watchdog.yml`):
- Runs every 2 hours
- Requeues `processing_status='failed'` rows after 4 hours
- Script: `scripts/ops/parser-watchdog.js`

### 3. Review Pipeline

**UI**: `/review` page powered by `/api/parsed-events?needs_review=true`

**Workflow**:
- Reviewers see queue of events with `needs_review=true`
- Approve/reject/edit via UI (calls `/api/review/update`)
- Updates `parsed_events.review_status` and `needs_review` flags
- Audit trail: `reviewed_by`, `reviewed_at`, `review_notes`

**Monitoring**:
- `npm run ops:commandview` shows queue counts
- Alert threshold: `needs_review > 25` (configurable via `CMDVIEW_ALERT_THRESHOLD`)
- CommandView dashboard: `/commandview` shows summary + recent reviews

### 4. Analytics Pipeline

**Endpoints**:
- `/api/analytics` - JSON data (filters to `needs_review=false AND review_status='approved'`)
- `/api/analytics/export?format=csv` - CSV export
- `/api/analytics/export?format=excel` - Excel export
- `/api/analytics/export?format=pdf` - PDF export

**Data Source**: `src/lib/analytics/data-source.ts`
- Uses `APPROVED_EVENT_CONDITION`: `needs_review=false AND (review_status IS NULL OR review_status='approved')`
- Automatically reflects approved events once reviewers clear queue

**Verification**:
- Hit `/api/analytics` to see current totals
- Use `/api/analytics/export?format=csv` for data export
- Dashboard UI uses same dataset

### 5. Validation & Monitoring

**Pipeline Health Check**:
- Script: `npm run ops:pipeline-health` or `node scripts/ops/pipeline-health.js`
- API: `/api/pipeline-health`
- Reports:
  - Fetch status (healthy/stale)
  - Parse queue (healthy/backlog)
  - Review queue (healthy/backlog)
  - Analytics-ready count
  - Last 24h activity

**CommandView Metrics**:
- Script: `npm run ops:commandview`
- Enhanced with pipeline metrics (raw_tweets counts, fetch/parse times)
- JSON output for Slack/email integration
- Exit code 1 if `needs_review >= 25` (alert threshold)

**Hourly Dashboard Checklist**:
1. ✅ Fetch job runs (expect ~100 tweets per run)
2. ✅ Parser runs (`PARSE_BATCH_LIMIT` batches until queue caught up)
3. ✅ Reviewers clear queue (via UI; no manual SQL)
4. ✅ `npm run ops:commandview` prints severity/queue for Slack
5. ✅ `/api/analytics` reflects new totals

## GitHub Actions Workflows

### `.github/workflows/fetch-tweets.yml`
- **Schedule**: Every hour at :00
- **Timeout**: 20 minutes (allows for rate-limit pauses)
- **Secrets Required**: `DATABASE_URL`, `TWITTER_BEARER_TOKEN`

### `.github/workflows/parse-tweets.yml`
- **Schedule**: Every hour at :15 (15 min after fetch)
- **Timeout**: 10 minutes
- **Secrets Required**: `DATABASE_URL`, `GEMINI_API_KEY`
- **Behavior**: Runs parser in loop until queue empty (max 10 iterations)

### `.github/workflows/parser-watchdog.yml`
- **Schedule**: Every 2 hours
- **Timeout**: 5 minutes
- **Secrets Required**: `DATABASE_URL`
- **Behavior**: Requeues failed rows after 4-hour delay

## Environment Variables

### Required Secrets (GitHub Actions)
- `DATABASE_URL` - PostgreSQL connection string
- `TWITTER_BEARER_TOKEN` - Twitter API bearer token
- `GEMINI_API_KEY` - Google Gemini API key

### Optional Environment Variables
- `PARSE_BATCH_LIMIT` - Parser batch size (default: 25)
- `RETRY_DELAY_HOURS` - Watchdog retry delay (default: 4)
- `CMDVIEW_ALERT_THRESHOLD` - Review queue alert threshold (default: 25)
- `CMDVIEW_WARN_THRESHOLD` - Review queue warn threshold (default: 10)

## Monitoring Commands

```bash
# Check pipeline health
npm run ops:pipeline-health

# Check review queue metrics
npm run ops:commandview

# Run parser watchdog manually
npm run ops:watchdog

# Check analytics totals
curl https://your-domain.com/api/analytics

# Export analytics CSV
curl https://your-domain.com/api/analytics/export?format=csv
```

## Database Schema

### `raw_tweets` Table
- `tweet_id` (PK)
- `processing_status` ('pending', 'parsed', 'failed')
- `fetched_at` - Timestamp of fetch
- `processed_at` - Timestamp of parse attempt

### `parsed_events` Table
- `tweet_id` (FK → raw_tweets)
- `needs_review` (boolean)
- `review_status` ('pending', 'approved', 'rejected', 'edited')
- `reviewed_at`, `reviewed_by`
- `overall_confidence` (0.00-1.00)

## Success Criteria

✅ **Fetch**: ~100 tweets/hour, rate limits respected  
✅ **Parse**: Queue stays near zero (watchdog handles failures)  
✅ **Review**: Queue cleared regularly, `needs_review < 25`  
✅ **Analytics**: Dashboard shows approved events automatically  
✅ **Monitoring**: Health checks pass, metrics logged

## Next Steps

1. **Enable GitHub Actions**: Add secrets to repository settings
2. **Test Workflows**: Manually trigger workflows to verify
3. **Monitor First Week**: Watch metrics, adjust thresholds as needed
4. **Scale Up**: Once stable, increase `PARSE_BATCH_LIMIT` if needed
5. **Document**: Update `DASHBOARD_LIVE_SUMMARY.md` with new totals

## Troubleshooting

**Fetch not running**:
- Check GitHub Actions logs
- Verify secrets are set
- Check rate limits (Twitter API)

**Parse queue growing**:
- Check parser logs for errors
- Verify Gemini/Ollama API keys
- Run watchdog manually: `npm run ops:watchdog`

**Review queue backlog**:
- Alert triggers at 25+ items
- Reviewers should clear queue via UI
- Check `/api/parsed-events?needs_review=true`

**Analytics not updating**:
- Verify events are approved (`review_status='approved'`)
- Check `needs_review=false` flag
- Query database directly to debug


