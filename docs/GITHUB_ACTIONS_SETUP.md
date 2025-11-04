# GitHub Actions Setup for Automated Tweet Fetching

## Overview

GitHub Actions workflow replaces local cron job for automated tweet fetching and parsing. This provides:
- ✅ **Reliability:** Runs on GitHub infrastructure
- ✅ **Monitoring:** Built-in workflow history and logs
- ✅ **Scalability:** No dependency on local machine
- ✅ **Notifications:** Email notifications on failures
- ✅ **Artifacts:** Log files stored for 7 days

---

## Workflow Configuration

### Schedule
- **Frequency:** Every 2 hours
- **Cron:** `0 */2 * * *` (runs at :00 of every 2nd hour)
- **Manual trigger:** Available via GitHub Actions UI

### Timeout
- **Maximum runtime:** 120 minutes (2 hours)
- **Reason:** 100 tweets × 6s delay = ~10 minutes, but allows buffer for rate limits

---

## Required GitHub Secrets

You must configure these secrets in your GitHub repository:

### 1. `DATABASE_URL`
- **Purpose:** PostgreSQL connection string
- **Format:** `postgresql://user:password@host:port/database`
- **How to set:**
  1. Go to repository Settings → Secrets and variables → Actions
  2. Click "New repository secret"
  3. Name: `DATABASE_URL`
  4. Value: Your PostgreSQL connection string

### 2. `X_BEARER_TOKEN`
- **Purpose:** Twitter API v2 Bearer Token
- **Format:** `Bearer token string`
- **How to set:**
  1. Go to repository Settings → Secrets and variables → Actions
  2. Click "New repository secret"
  3. Name: `X_BEARER_TOKEN`
  4. Value: Your Twitter Bearer Token

### 3. `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- **Purpose:** Google Gemini API key for parsing
- **Format:** API key string
- **Note:** Either `GEMINI_API_KEY` or `GOOGLE_API_KEY` works
- **How to set:**
  1. Go to repository Settings → Secrets and variables → Actions
  2. Click "New repository secret"
  3. Name: `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
  4. Value: Your Gemini API key

---

## Setup Instructions

### Step 1: Create Secrets

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each required secret:
   - `DATABASE_URL`
   - `X_BEARER_TOKEN`
   - `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)

### Step 2: Verify Workflow File

Ensure the workflow file exists:
```
.github/workflows/fetch-and-parse-tweets.yml
```

### Step 3: Test Manual Run

1. Go to **Actions** tab in GitHub
2. Select **Fetch and Parse New Tweets** workflow
3. Click **Run workflow** → **Run workflow**
4. Monitor the run in real-time

### Step 4: Verify Scheduled Runs

After first manual run succeeds:
- Scheduled runs will start automatically
- Check **Actions** tab to see scheduled runs
- Runs appear with clock icon (🕐)

---

## Workflow Behavior

### Default Configuration
- **Max tweets per run:** 100
- **Parse delay:** 6.0 seconds (10 RPM for Gemini Flash free tier)
- **Twitter handle:** OPChoudhary_Ind

### Manual Trigger Options
When manually triggering, you can override:
- `max_tweets`: Maximum tweets to fetch (default: 100)
- `parse_delay`: Delay between parsing (default: 6.0s)

### Rate Limit Protection
- **Twitter API:** Automatic via Tweepy (`wait_on_rate_limit=True`)
- **Gemini API:** Configurable delay (default: 6s = 10 RPM)
- **Daily limits:** Monitored automatically

---

## Monitoring

### View Workflow Runs
1. Go to **Actions** tab
2. Click on **Fetch and Parse New Tweets** workflow
3. View run history and status

### Check Logs
- **During run:** Click on running workflow → View logs
- **After completion:** Download artifact `fetch-parse-logs-{run_id}`
- **Artifacts:** Stored for 7 days

### Status Indicators
- ✅ **Green:** Success
- ❌ **Red:** Failure (check logs for details)
- 🟡 **Yellow:** Running
- ⚪ **Gray:** Skipped/Cancelled

---

## Troubleshooting

### Workflow Not Running
1. **Check schedule:** Verify cron syntax is correct
2. **Check repository:** Ensure workflow file is in default branch
3. **Check GitHub Actions:** Verify Actions are enabled for repository

### Authentication Errors
1. **Database:** Verify `DATABASE_URL` secret is correct
2. **Twitter:** Verify `X_BEARER_TOKEN` secret is valid
3. **Gemini:** Verify `GEMINI_API_KEY` secret is set

### Rate Limit Errors
1. **Gemini:** Increase `parse_delay` input (e.g., 12.0 for Pro tier)
2. **Twitter:** Check Twitter API rate limit status
3. **Review logs:** Check artifact logs for specific errors

### Timeout Issues
1. **Increase timeout:** Edit workflow file `timeout-minutes: 120`
2. **Reduce batch size:** Lower `max_tweets` input
3. **Check logs:** Review logs for bottlenecks

---

## Customization

### Change Schedule
Edit `.github/workflows/fetch-and-parse-tweets.yml`:
```yaml
schedule:
  - cron: '0 */1 * * *'  # Every hour
  - cron: '0 */4 * * *'  # Every 4 hours
  - cron: '0 0 * * *'    # Daily at midnight
```

### Change Rate Limits
Edit workflow inputs or default values:
```yaml
parse_delay: '12.0'  # For Gemini Pro (5 RPM)
```

### Add Notifications
Add email/Slack notifications on failure:
```yaml
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      // Add notification logic
```

---

## Comparison: GitHub Actions vs Local Cron

| Feature | GitHub Actions | Local Cron |
|---------|---------------|------------|
| **Reliability** | ✅ High (GitHub infra) | ⚠️ Depends on local machine |
| **Monitoring** | ✅ Built-in UI | ⚠️ Manual log checking |
| **Notifications** | ✅ Built-in | ⚠️ Manual setup |
| **Cost** | ✅ Free (public repos) | ✅ Free |
| **Dependencies** | ✅ Managed | ⚠️ Local setup required |
| **Scalability** | ✅ Unlimited | ⚠️ Limited by machine |

---

## Migration from Local Cron

If you had a local cron job set up:

1. **Disable local cron:**
   ```bash
   crontab -e
   # Remove or comment out the fetch tweet line
   ```

2. **Set up GitHub Actions:**
   - Follow setup instructions above
   - Test with manual run
   - Verify scheduled runs work

3. **Monitor first few runs:**
   - Check Actions tab daily
   - Verify logs are correct
   - Ensure tweets are being fetched

---

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Secrets Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Cron Schedule Syntax](https://crontab.guru/)

