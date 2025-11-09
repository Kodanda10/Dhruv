# Data Pipeline Status

## ✅ Database Status

- **Total Tweets:** 2,577
- **Total Parsed Events:** 2,325
- **OP Choudhary Tweets:** 2,576 (99.96% of all tweets)
- **Parsed Events from OP Choudhary:** 2,325 (100% of parsed events)
- **Events Needing Review:** 2,030

## ✅ API Endpoints Fixed

### 1. Flask API (`api/src/app.py`)
- ✅ Fixed column name: `author_username` → `author_handle`
- ✅ Endpoint: `/api/parsed-events`
- ✅ Returns: `{ success: true, count: N, events: [...] }`

### 2. Next.js API Route (`src/app/api/parsed-events/route.ts`)
- ✅ Created new route for direct database access
- ✅ Uses correct column: `author_handle`
- ✅ Returns same format as Flask API
- ✅ Includes `total_op_choudhary` count in response
- ✅ Supports query parameters:
  - `status`: Filter by review status
  - `needs_review`: Filter by needs_review flag (true/false)
  - `limit`: Limit number of results (default: 50)
  - `author`: Filter by author handle

## ✅ Data Flow

```
Database (PostgreSQL)
  ↓
  raw_tweets (2,577 tweets, author_handle = 'OPChoudhary_Ind')
  ↓
  parsed_events (2,325 events)
  ↓
Next.js API Route: /api/parsed-events
  ↓
Frontend Components:
  - ReviewQueue.tsx (uses: /api/parsed-events?needs_review=true&limit=100)
  - Dashboard.tsx (uses: /api/parsed-events?limit=200)
```

## ✅ Sample OP Choudhary Tweets

1. **Tweet ID:** `1985938919578616076`
   - Author: `OPChoudhary_Ind`
   - Date: 2025-11-05 05:15:10
   - Text: "सिख पंथ के संस्थापक, प्रथम गुरु एवं मानवता के प्रकाशपुंज श्री गुरु नानक देव जी..."

2. **Tweet ID:** `1985933171205214303`
   - Author: `OPChoudhary_Ind`
   - Date: 2025-11-05 04:52:19
   - Text: "सनातन आस्था के महापर्व 'कार्तिक पूर्णिमा' एवं 'देव दीपावली'..."

3. **Tweet ID:** `1985917270250701212`
   - Author: `OPChoudhary_Ind`
   - Date: 2025-11-05 03:49:08
   - Text: "कैबिनेट के साथी एवं नारायणपुर के लोकप्रिय विधायक माननीय श्री केदार कश्यप जी..."

## 🔧 Configuration

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
  - Default (local): `postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db`
  - Production: Set in deployment environment

### API Base URL
- `NEXT_PUBLIC_API_BASE`: Flask API base URL (optional, defaults to empty for Next.js API routes)

## ✅ Verification Steps

1. **Database Connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM raw_tweets;"
   ```

2. **Test Next.js API:**
   ```bash
   curl http://localhost:3000/api/parsed-events?limit=5
   ```

3. **Test Flask API (if running separately):**
   ```bash
   curl http://localhost:5000/api/parsed-events?limit=5
   ```

4. **Check OP Choudhary Filter:**
   ```bash
   curl "http://localhost:3000/api/parsed-events?author=opchoudhary&limit=3"
   ```

## 📝 Notes

- All tweets are from `OPChoudhary_Ind` (OP Choudhary)
- The frontend now uses the Next.js API route directly (no Flask proxy needed)
- Mock data imports have been removed from components
- Database column is `author_handle`, not `author_username`

## 🚀 Next Steps

1. ✅ Database connection verified
2. ✅ API endpoints fixed
3. ✅ Response format matches frontend expectations
4. ⏳ Restart Next.js dev server to pick up new API route
5. ⏳ Verify frontend displays real data


