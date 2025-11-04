# GitHub Secrets Setup Guide

## Quick Setup Checklist

Before the GitHub Actions workflow can run, you need to set up these secrets:

- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `X_BEARER_TOKEN` - Twitter API Bearer Token
- [ ] `GEMINI_API_KEY` - Google Gemini API key (or `GOOGLE_API_KEY`)

---

## Step-by-Step Instructions

### 1. Navigate to Secrets Page

1. Go to your GitHub repository
2. Click **Settings** (top menu)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret** button

### 2. Add DATABASE_URL

**Name:** `DATABASE_URL`

**Value:** Your PostgreSQL connection string
```
postgresql://username:password@host:port/database_name
```

**Example:**
```
postgresql://postgres:mypassword@db.example.com:5432/dhruv_db
```

**How to get:**
- Check your `.env.local` file for `DATABASE_URL`
- Or construct from your database credentials

---

### 3. Add X_BEARER_TOKEN

**Name:** `X_BEARER_TOKEN`

**Value:** Your Twitter API v2 Bearer Token

**Example:**
```
AAAAAAAAAAAAAAAAAAAAAABCDE1234567890abcdefghijklmnopqrstuvwxyz
```

**How to get:**
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Navigate to your App → Keys and Tokens
3. Copy the **Bearer Token**

**Important:** 
- This is different from API Key and API Secret
- It's the Bearer Token used for v2 API authentication

---

### 4. Add GEMINI_API_KEY

**Name:** `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)

**Value:** Your Google Gemini API key

**Example:**
```
AIzaSyAbCdEfGhIjKlMnO1234567890pQrStUvWxYz
```

**How to get:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **Create API Key**
3. Copy the generated key

**Note:** 
- Either `GEMINI_API_KEY` or `GOOGLE_API_KEY` works
- The workflow checks both

---

## Verification

After adding all secrets:

1. **Verify secrets exist:**
   - Go to Settings → Secrets and variables → Actions
   - You should see all 3 secrets listed (values are hidden)

2. **Test workflow:**
   - Go to Actions tab
   - Select "Fetch and Parse New Tweets"
   - Click "Run workflow"
   - Monitor the run

3. **Check for errors:**
   - If workflow fails with authentication errors
   - Verify secret names match exactly (case-sensitive!)
   - Verify secret values are correct

---

## Security Best Practices

✅ **DO:**
- Keep secrets in GitHub Secrets (not in code)
- Use different secrets for different environments
- Rotate secrets regularly
- Review secret access logs

❌ **DON'T:**
- Commit secrets to repository
- Share secrets in public channels
- Use production secrets in development
- Expose secrets in logs

---

## Troubleshooting

### "Secret not found" error
- **Cause:** Secret name doesn't match exactly
- **Fix:** Check secret name is exactly `DATABASE_URL`, `X_BEARER_TOKEN`, or `GEMINI_API_KEY`

### "Authentication failed" error
- **Cause:** Secret value is incorrect
- **Fix:** Verify secret value matches your actual credentials

### "Connection refused" error
- **Cause:** Database URL or host is incorrect
- **Fix:** Verify `DATABASE_URL` format and accessibility

---

## Local Testing

Before deploying to GitHub Actions, test locally:

```bash
# Set environment variables
export DATABASE_URL="your_database_url"
export X_BEARER_TOKEN="your_twitter_token"
export GEMINI_API_KEY="your_gemini_key"

# Test fetch script
python3 scripts/fetch_new_tweets_incremental.py --max-tweets 5 --parse --parse-delay 6.0
```

If this works locally, the GitHub Actions workflow should work too.

