# Email Notification Setup

## Gmail App Password Setup

To enable email notifications, you need a Gmail App Password (not your regular password).

### Step 1: Enable 2-Factor Authentication

1. Go to: https://myaccount.google.com/security
2. Enable "2-Step Verification" if not already enabled

### Step 2: Generate App Password

1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" and "Other (Custom name)"
3. Enter name: "Pipeline Monitor"
4. Click "Generate"
5. Copy the 16-character password (no spaces)

### Step 3: Configure Environment Variables

**For Local Development** (`.env.local`):
```bash
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
NOTIFICATION_EMAIL=9685528000as@gmail.com
```

**For GitHub Actions** (Repository Secrets):
1. Go to: GitHub → Settings → Secrets and variables → Actions
2. Add secrets:
   - `EMAIL_USER` = your-email@gmail.com
   - `EMAIL_PASSWORD` = your-16-char-app-password
   - `NOTIFICATION_EMAIL` = 9685528000as@gmail.com (already set in workflow)

### Step 4: Test Email

```bash
# Test locally
node scripts/ops/pipeline-monitor.js

# Or trigger GitHub Action manually
# Go to Actions → Pipeline Monitor → Run workflow
```

### Step 5: Verify First Email

After first successful monitoring run, check `9685528000as@gmail.com` for:
- **Subject**: `📊 Pipeline Status Report - [Date]`
- **Content**: Pipeline statistics and health status

## Email Frequency

- **Monitoring Workflow**: Every 2 hours (automatic)
- **Manual Trigger**: Anytime via GitHub Actions
- **Full Pipeline**: On completion (if configured)

## Troubleshooting

### "Email not configured" Warning
- Check environment variables are set
- Verify app password is correct (16 characters, no spaces)
- Ensure 2FA is enabled on Gmail account

### Email Not Received
- Check spam folder
- Verify `NOTIFICATION_EMAIL` is correct
- Check GitHub Actions logs for email errors
- Test locally first: `node scripts/ops/pipeline-monitor.js`

### "Invalid credentials" Error
- Regenerate app password
- Ensure using app password (not regular password)
- Verify email address is correct

## Security Notes

- ✅ App passwords are safer than regular passwords
- ✅ Can be revoked individually
- ✅ No access to account settings
- ✅ Only works for configured apps

---

**After setup**: First email will be sent when monitoring workflow runs successfully (confirms integration working).


