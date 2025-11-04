# GitHub Actions Workflow Verification Guide

## ✅ Secrets Added - Next Steps

### 1. Verify Secrets in GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Verify these secrets exist:
   - ✅ `DATABASE_URL`
   - ✅ `X_BEARER_TOKEN`
   - ✅ `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)

### 2. Test Workflow Manually

#### Option A: Test via GitHub UI
1. Go to **Actions** tab
2. Select **Fetch and Parse New Tweets** workflow
3. Click **Run workflow** button (top right)
4. Choose branch: `feat/dashboard-fixes-automated-pipeline`
5. Click **Run workflow**
6. Monitor the run in real-time

#### Option B: Test Locally First
```bash
# Run integrity check
python3 scripts/test_secrets_integrity.py

# Test workflow script
bash scripts/test_github_actions_workflow.sh
```

### 3. Monitor First Run

After triggering the workflow:

1. **Watch the run:**
   - Click on the running workflow
   - View logs in real-time
   - Check each step

2. **Check for errors:**
   - ❌ Red checkmark = failure (check logs)
   - ✅ Green checkmark = success

3. **Download artifacts:**
   - After completion, download logs
   - Check `fetch-parse-logs-{run_id}` artifact

### 4. Verify Scheduled Runs

After first successful manual run:
- Scheduled runs will start automatically
- Check **Actions** tab for scheduled runs (🕐 clock icon)
- Runs occur every 2 hours at :00 of every 2nd hour

---

## Workflow Status Indicators

### ✅ Success
- All steps completed
- Green checkmarks
- Logs show successful fetch/parse

### ❌ Failure
- Red X marks
- Check logs for specific error
- Common issues:
  - Missing secrets
  - Database connection error
  - API authentication error
  - Rate limit exceeded

### 🟡 Running
- Yellow circle
- Workflow in progress
- Check logs for progress

---

## Troubleshooting

### "Secret not found" Error
- **Cause:** Secret name doesn't match exactly
- **Fix:** Verify secret names in GitHub Settings → Secrets
- **Check:** Secret names are case-sensitive

### "Authentication failed" Error
- **Cause:** Invalid secret value
- **Fix:** Re-verify secret values
- **Test:** Run `scripts/test_secrets_integrity.py` locally

### "Connection refused" Error
- **Cause:** Database URL incorrect or unreachable
- **Fix:** Verify `DATABASE_URL` format and accessibility
- **Check:** Database allows connections from GitHub Actions IPs

### Workflow Not Running on Schedule
- **Cause:** Schedule syntax or Actions not enabled
- **Fix:** 
  1. Verify cron syntax in workflow file
  2. Check Actions are enabled for repository
  3. Ensure workflow file is in default branch

---

## Current Status

### Parsing Status
- **Total tweets:** 2,570
- **Parsed:** 1,665 (64.8%)
- **Pending:** 660 (25.7%)
- **Errors:** 245 (9.5%)

### Background Parsing
- **Status:** Running in background
- **Process:** Parsing remaining 660 tweets
- **Rate limit:** 6s delay (10 RPM for Gemini Flash)
- **Estimated time:** ~66 minutes

### GitHub Actions Workflow
- **Status:** Ready (waiting for first manual run)
- **Schedule:** Every 2 hours (starts after first run)
- **Next run:** After you trigger manually

---

## Verification Checklist

- [ ] All secrets added to GitHub
- [ ] Secrets integrity checked locally
- [ ] Workflow file exists (`.github/workflows/fetch-and-parse-tweets.yml`)
- [ ] First manual run completed successfully
- [ ] Scheduled runs appearing (after first run)
- [ ] Logs being generated correctly
- [ ] Tweets being fetched and parsed

---

## Next Actions

1. **Test workflow manually** via GitHub UI
2. **Monitor first run** for any issues
3. **Verify scheduled runs** start after first success
4. **Check logs** regularly for first few runs
5. **Adjust schedule** if needed (edit workflow file)

---

## Support

If workflow fails:
1. Check logs in Actions tab
2. Run `scripts/test_secrets_integrity.py` locally
3. Verify secrets are correct
4. Check database connectivity
5. Review `docs/GITHUB_ACTIONS_SETUP.md` for detailed troubleshooting

