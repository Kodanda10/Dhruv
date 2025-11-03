# Where Tweets Are Stored

**Date:** November 4, 2025

---

## Storage Location

### Database: PostgreSQL

**Connection Details:**
- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `dhruv_db`
- **User:** `dhruv_user`
- **Connection String:** Stored in `.env.local` as `DATABASE_URL`

### Table: `raw_tweets`

All fetched tweets are stored in the `raw_tweets` PostgreSQL table.

---

## Table Structure

### Columns:

| Column | Type | Description |
|--------|------|-------------|
| `tweet_id` | VARCHAR | Unique Twitter tweet ID (Primary Key) |
| `author_handle` | VARCHAR | Twitter username (e.g., `OPChoudhary_Ind`) |
| `text` | TEXT | Full tweet text content |
| `created_at` | TIMESTAMP | When tweet was posted on Twitter |
| `hashtags` | ARRAY | Array of hashtags found in tweet |
| `mentions` | ARRAY | Array of @mentions found in tweet |
| `urls` | ARRAY | Array of URLs found in tweet |
| `retweet_count` | INTEGER | Number of retweets |
| `like_count` | INTEGER | Number of likes |
| `reply_count` | INTEGER | Number of replies |
| `quote_count` | INTEGER | Number of quote tweets |
| `fetched_at` | TIMESTAMP | When tweet was fetched and stored |
| `processing_status` | VARCHAR | Status: `pending`, `parsed`, `error` |

---

## Current Status

### Stored Tweets:
- **Total:** 471 tweets
- **Pending Parsing:** 465 tweets
- **Author:** @OPChoudhary_Ind

### Date Range:
- **Oldest:** 2025-09-07
- **Newest:** 2025-11-03

---

## How to Access

### 1. Via Python Script:
```python
import os
from dotenv import load_dotenv
import psycopg2
from pathlib import Path

load_dotenv(Path('.env.local'))
conn = psycopg2.connect(os.getenv('DATABASE_URL'))

with conn.cursor() as cur:
    cur.execute('SELECT * FROM raw_tweets LIMIT 10')
    tweets = cur.fetchall()
    
conn.close()
```

### 2. Via PostgreSQL CLI:
```bash
psql -h localhost -p 5432 -U dhruv_user -d dhruv_db

# Then in psql:
SELECT COUNT(*) FROM raw_tweets;
SELECT * FROM raw_tweets LIMIT 10;
```

### 3. Via Database GUI:
- Use any PostgreSQL client (pgAdmin, DBeaver, etc.)
- Connect using the credentials above
- Query the `raw_tweets` table

---

## Sample Query

```sql
-- Get all tweets
SELECT tweet_id, text, created_at, author_handle 
FROM raw_tweets 
ORDER BY created_at DESC 
LIMIT 10;

-- Get pending tweets
SELECT COUNT(*) 
FROM raw_tweets 
WHERE processing_status = 'pending';

-- Get tweets by date range
SELECT * 
FROM raw_tweets 
WHERE created_at >= '2025-10-01' 
  AND created_at <= '2025-11-01'
ORDER BY created_at DESC;
```

---

## Data Flow

```
Twitter API
  ↓
fetch_tweets_safe.py
  ↓
PostgreSQL Database
  ↓
raw_tweets table
  ↓
parse_tweets_with_three_layer.py (or parse_tweets.py)
  ↓
parsed_events table
  ↓
Review Page & Analytics Page
```

---

## Related Tables

### `parsed_events`
After parsing, tweets are stored in `parsed_events` table with structured data:
- Event types
- Locations
- Schemes mentioned
- People mentioned
- Confidence scores
- Review status

### Connection:
- `parsed_events.tweet_id` → `raw_tweets.tweet_id`

---

## File Storage

**Note:** Tweets are NOT stored in files. They are stored directly in PostgreSQL database.

**Previous approach (deprecated):**
- ~~`data/parsed_tweets.json`~~ (static file, no longer used)
- Now using database only for all tweet data

---

## Backup & Export

### Export to JSON:
```python
import json
import psycopg2
import psycopg2.extras

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
    cur.execute('SELECT * FROM raw_tweets')
    tweets = cur.fetchall()
    
    with open('tweets_backup.json', 'w') as f:
        json.dump([dict(tweet) for tweet in tweets], f, indent=2, default=str)
```

### Export to CSV:
```python
import pandas as pd
import psycopg2

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
df = pd.read_sql_query('SELECT * FROM raw_tweets', conn)
df.to_csv('tweets_backup.csv', index=False)
```

---

## Summary

✅ **Storage:** PostgreSQL database (`dhruv_db`)  
✅ **Table:** `raw_tweets`  
✅ **Location:** Local database (localhost:5432)  
✅ **Current:** 471 tweets stored  
✅ **Status:** Ready for parsing


