# Twitter API Setup Guide

This guide explains how to set up Twitter API credentials for fetching OP Choudhary's tweets.

## Prerequisites

1. Twitter Developer Account
2. Twitter App with API v2 access
3. API credentials (API Key, API Secret, Bearer Token, Access Token, Access Token Secret)

## Step 1: Get Twitter API Credentials

### 1.1 Create Twitter Developer Account

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Sign in with your Twitter account
3. Apply for developer access (usually instant for basic use)

### 1.2 Create a Twitter App

1. Go to [Twitter Developer Portal Dashboard](https://developer.twitter.com/en/portal/dashboard)
2. Click "Create App" or "New App"
3. Fill in app details:
   - App name: `OPChoudharyAnalytics` (or any name)
   - Use case: "Building a social media analytics dashboard"
   - App environment: Production
4. Accept terms and create app

### 1.3 Get API Credentials

1. Go to your app's "Keys and Tokens" tab
2. You'll need these 5 credentials:

#### API Key & Secret
- Click "Generate" under "Consumer Keys"
- Copy `API Key` → this is `X_API_KEY`
- Copy `API Secret` → this is `X_API_SECRET`

#### Bearer Token
- Click "Generate" under "Bearer Token"
- Copy the token → this is `X_BEARER_TOKEN`

#### Access Token & Secret
- Click "Generate" under "Access Token and Secret"
- Copy `Access Token` → this is `X_ACCESS_TOKEN`
- Copy `Access Token Secret` → this is `X_ACCESS_TOKEN_SECRET`

### 1.4 Set App Permissions

1. Go to "Settings" tab
2. Under "User authentication settings":
   - Turn ON "OAuth 1.0a"
   - App permissions: "Read" (we only need to read tweets)
   - Type of App: "Web App"
   - Callback URL: `http://localhost:3000` (or your app URL)
   - Website URL: Your app URL
3. Save settings

## Step 2: Configure Environment Variables

### 2.1 Create .env.local File

Create a file named `.env.local` in the project root:

```bash
cp .env.example .env.local
```

### 2.2 Add Twitter API Credentials

Edit `.env.local` and add your Twitter API credentials:

```bash
# Twitter API (X) Credentials
X_API_KEY=your_actual_api_key_here
X_API_SECRET=your_actual_api_secret_here
X_BEARER_TOKEN=your_actual_bearer_token_here
X_ACCESS_TOKEN=your_actual_access_token_here
X_ACCESS_TOKEN_SECRET=your_actual_access_token_secret_here

# Gemini API (for text parsing)
GEMINI_API_KEY=your_gemini_api_key_here

# Database
DATABASE_URL=postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db

# MapMyIndia (for geocoding)
MAPMYINDIA_CLIENT_ID=your_mapmyindia_client_id_here
MAPMYINDIA_CLIENT_SECRET=your_mapmyindia_client_secret_here

# Feature Flags
FLAG_PARSE=on
NEXT_PUBLIC_FLAG_PARSE=on
ENABLE_TWITTER_FETCH=true
ENABLE_PARSING=true
ENABLE_REVIEW_UI=true
ENABLE_ANALYTICS=true
```

**⚠️ IMPORTANT:** Never commit `.env.local` to git! It's already in `.gitignore`.

## Step 3: Install Python Dependencies

Install the required Python packages:

```bash
cd /Users/abhijita/Projects/Project_Dhruv

# Activate virtual environment (if using one)
source .venv/bin/activate  # or: python -m venv .venv

# Install dependencies
pip install -r api/requirements.txt
```

This will install:
- `tweepy==4.14.0` - Twitter API client
- `psycopg2-binary==2.9.9` - PostgreSQL adapter
- Other dependencies

## Step 4: Setup Database

### 4.1 Start PostgreSQL

```bash
cd infra
docker-compose up -d
```

This starts PostgreSQL on port 5432.

### 4.2 Verify Connection

```bash
psql postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db -c "SELECT version();"
```

## Step 5: Test Twitter API Connection

### 5.1 Test with Python Script

```bash
python api/src/twitter/client.py
```

This should fetch 10 sample tweets from @opchoudhary and print them.

**Expected output:**
```
Twitter client initialized successfully
Fetching tweets for user @opchoudhary (ID: 123456789)
Fetched 10 tweets

--- Tweet 123456789 ---
Date: 2024-01-15T10:30:00+00:00
Text: रायगढ़ में आज एक महत्वपूर्ण बैठक...
Likes: 45
Retweets: 12
```

### 5.2 Run Tests

```bash
npm test -- tests/twitter-api-setup.test.ts
```

All 4 tests should pass:
- ✅ .env.example exists
- ✅ Twitter API credentials in .env.local
- ✅ Twitter client module structure
- ✅ Tweet fetcher script

## Step 6: Fetch Tweets

### 6.1 Fetch Sample Tweets (10 tweets)

```bash
python scripts/fetch_tweets.py --handle opchoudhary --since 2024-12-01 --until 2024-12-31
```

### 6.2 Fetch All Tweets (Dec 2023 - Oct 2025)

```bash
python scripts/fetch_tweets.py --handle opchoudhary --since 2023-12-01 --until 2025-10-31
```

**Note:** Free tier allows 500 tweets per month. If you have more than 500 tweets:
- The script will fetch in batches
- Each batch pauses for 1 minute (rate limiting)
- Estimated time: ~10-15 minutes for 2000 tweets

### 6.3 Resume Interrupted Fetch

If the fetch is interrupted, you can resume:

```bash
python scripts/fetch_tweets.py --handle opchoudhary --resume
```

This continues from the last fetched tweet.

## Step 7: Verify Tweets in Database

```bash
psql postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db -c "
SELECT 
    COUNT(*) as total_tweets,
    MIN(created_at) as oldest_tweet,
    MAX(created_at) as newest_tweet
FROM raw_tweets
WHERE author_handle = 'opchoudhary';
"
```

**Expected output:**
```
 total_tweets |     oldest_tweet      |     newest_tweet      
--------------+-----------------------+-----------------------
         2000 | 2023-12-01 10:30:00   | 2025-10-31 15:45:00
```

## Troubleshooting

### Error: "X_BEARER_TOKEN not found"

**Solution:** Make sure `.env.local` exists and contains `X_BEARER_TOKEN=...`

### Error: "Rate limit exceeded"

**Solution:** 
- Free tier: 500 tweets/month, 15 requests per 15 minutes
- Wait 15 minutes and retry
- Or upgrade to paid tier for higher limits

### Error: "User @opchoudhary not found"

**Solution:**
- Check the username is correct (no @ symbol)
- Verify the account exists and is public
- Check your API app has "Read" permissions

### Error: "Invalid Twitter API credentials"

**Solution:**
- Regenerate API keys in Twitter Developer Portal
- Update `.env.local` with new credentials
- Restart any running processes

## Rate Limits (Free Tier)

| Resource | Limit |
|----------|-------|
| Tweets per month | 500 |
| Requests per 15 minutes | 15 |
| Tweets per request | 100 (max) |
| Rate limit reset | 15 minutes |

**Recommendation:** For OP Choudhary's ~2000 tweets:
- Fetch in batches of 500
- Pause 1 minute between batches
- Total time: ~10-15 minutes

## Next Steps

Once tweets are fetched, proceed to:
1. **Task 3:** Create database schema for parsed events
2. **Task 4:** Build parsing pipeline
3. **Task 5:** Create review UI

## References

- [Twitter API v2 Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [Tweepy Documentation](https://docs.tweepy.org/)
- [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)

