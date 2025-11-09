# API Route Comparison: Pages Router vs App Router

## Overview

Both files serve the **same endpoint** (`/api/parsed-events`) but use different Next.js routing systems. This document explains the differences and why we migrated.

---

## 📁 File 1: Pages Router (Old - Archived)

**Location:** `archive/pages/api/parsed-events/index.ts.backup`  
**Routing System:** Next.js Pages Router (legacy)  
**Status:** ❌ **Removed** (caused duplicate route conflict)

### Architecture

```typescript
// Pages Router uses a default export handler function
export default async function handler(
  req: NextApiRequest,      // Pages Router request object
  res: NextApiResponse      // Pages Router response object
) {
  // Handle request...
}
```

### Key Characteristics

1. **Request/Response Objects:**
   - Uses `NextApiRequest` and `NextApiResponse` from `next`
   - Manual status code setting: `res.status(200).json(...)`
   - Query params: `req.query.limit`, `req.query.needs_review`

2. **Database Connection:**
   ```typescript
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL || '...'
   });
   ```
   - Creates its own database pool instance
   - No connection sharing across routes

3. **Hindi Event Types:**
   - Has **local** `EVENT_TYPE_HINDI` mapping (35 event types)
   - Hardcoded in the file
   - Fallback logic: `event.event_type_hi || EVENT_TYPE_HINDI[event.event_type]`

4. **SQL Query:**
   ```sql
   SELECT
     pe.id,
     pe.tweet_id,
     rt.text as text,           -- Uses 'text' field
     rt.text as content,         -- Duplicate 'content' field
     rt.created_at as timestamp,
     pe.event_type,
     COALESCE(pe.event_type_hi, '') as event_type_hi,
     -- Missing: author_handle, event_date, date_confidence
   FROM parsed_events pe
   LEFT JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
   ```

5. **Response Format:**
   ```json
   {
     "success": true,
     "source": "database",
     "total": 100,
     "data": [...],      // Primary array
     "events": [...]     // Duplicate array
   }
   ```

6. **Query Parameters:**
   - `limit` (default: 200, max: 500)
   - `needs_review` (boolean)
   - `review_status` (string)
   - `analytics` (boolean, unused)

7. **Missing Features:**
   - ❌ No author filtering (`author_handle`)
   - ❌ No OP Choudhary count
   - ❌ No `event_date` or `date_confidence`
   - ❌ No `reviewed_at` or `reviewed_by`

---

## 📁 File 2: App Router (New - Active)

**Location:** `src/app/api/parsed-events/route.ts`  
**Routing System:** Next.js App Router (modern)  
**Status:** ✅ **Active** (current implementation)

### Architecture

```typescript
// App Router uses named export functions for HTTP methods
export async function GET(request: NextRequest) {
  // Handle GET request...
}

// Can also export POST, PUT, DELETE, etc.
export async function POST(request: NextRequest) { ... }
```

### Key Characteristics

1. **Request/Response Objects:**
   - Uses `NextRequest` and `NextResponse` from `next/server`
   - Modern API: `NextResponse.json(...)`
   - Query params: `searchParams.get('limit')`

2. **Database Connection:**
   ```typescript
   const pool = getDbPool();  // Shared connection pool
   ```
   - Uses centralized `getDbPool()` function
   - **Connection pooling** across all API routes
   - Better performance and resource management

3. **Hindi Event Types:**
   - Uses **shared** `getEventTypeInHindi()` from `@/lib/i18n/event-types-hi`
   - Centralized translation logic (70+ event types)
   - Consistent across entire application

4. **SQL Query:**
   ```sql
   SELECT 
     pe.id,
     pe.tweet_id,
     rt.text as tweet_text,                    -- Clear naming
     rt.created_at as tweet_created_at,        -- Clear naming
     COALESCE(rt.author_handle, 'unknown') as author_username,  -- ✅ Author info
     pe.event_type,
     pe.event_type_confidence,
     pe.event_date,                            -- ✅ Event date
     pe.date_confidence,                       -- ✅ Date confidence
     pe.locations,
     pe.people_mentioned,
     pe.organizations,
     pe.schemes_mentioned,
     pe.overall_confidence,
     pe.needs_review,
     pe.review_status,
     pe.reviewed_at,                           -- ✅ Review metadata
     pe.reviewed_by,                           -- ✅ Reviewer info
     pe.parsed_at,
     pe.parsed_by
   FROM parsed_events pe
   JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
   ```

5. **Response Format:**
   ```json
   {
     "success": true,
     "source": "database",
     "count": 100,
     "total": 100,
     "total_op_choudhary": 2325,  // ✅ OP Choudhary count
     "events": [...],              // Primary array
     "data": [...]                 // Backward compatibility
   }
   ```

6. **Query Parameters:**
   - `limit` (default: 50, max: 500)
   - `needs_review` (string: 'true'/'false')
   - `status` (string: review status)
   - `author` (string: filter by author handle) ✅ **NEW**

7. **Additional Features:**
   - ✅ Author filtering (`?author=OPChoudhary`)
   - ✅ OP Choudhary count in response
   - ✅ Event date and confidence fields
   - ✅ Review metadata (`reviewed_at`, `reviewed_by`)
   - ✅ Backward compatibility fields (`text`, `content`, `timestamp`)
   - ✅ Array safety checks (`Array.isArray()`)

---

## 🔄 Side-by-Side Comparison

| Feature | Pages Router (Old) | App Router (New) |
|---------|-------------------|-------------------|
| **Routing System** | Pages Router (legacy) | App Router (modern) |
| **File Location** | `pages/api/parsed-events/index.ts` | `src/app/api/parsed-events/route.ts` |
| **Export Pattern** | `export default function handler()` | `export async function GET()` |
| **Request Type** | `NextApiRequest` | `NextRequest` |
| **Response Type** | `NextApiResponse` | `NextResponse` |
| **Database Pool** | Local instance | Shared pool (`getDbPool()`) |
| **Hindi Translations** | Local mapping (35 types) | Shared utility (70+ types) |
| **Author Filtering** | ❌ Not supported | ✅ Supported |
| **OP Choudhary Count** | ❌ Not included | ✅ Included |
| **Event Date Fields** | ❌ Missing | ✅ Included |
| **Review Metadata** | ❌ Partial | ✅ Complete |
| **Array Safety** | Basic | Enhanced (`Array.isArray()`) |
| **Backward Compat** | N/A | ✅ Includes old format fields |

---

## 🎯 Why We Migrated

### 1. **Next.js Recommendation**
- App Router is the **modern, recommended** approach
- Pages Router is in maintenance mode
- Better performance and features

### 2. **Code Organization**
- ✅ Shared database pool (better resource management)
- ✅ Centralized Hindi translations (DRY principle)
- ✅ Consistent with other API routes

### 3. **Enhanced Features**
- ✅ Author filtering capability
- ✅ OP Choudhary count tracking
- ✅ Complete event metadata
- ✅ Better error handling

### 4. **Backward Compatibility**
- ✅ Includes all old response fields (`text`, `content`, `timestamp`)
- ✅ Supports both `events` and `data` arrays
- ✅ Frontend code works without changes

---

## 📊 Response Format Comparison

### Old Pages Router Response:
```json
{
  "success": true,
  "source": "database",
  "total": 100,
  "data": [
    {
      "id": 1,
      "tweet_id": "123",
      "text": "Tweet content",
      "content": "Tweet content",
      "timestamp": "2025-11-05T05:15:10Z",
      "event_type": "inspection",
      "event_type_hi": "निरीक्षण",
      "event_type_confidence": 0.73,
      "overall_confidence": 0.69,
      "needs_review": false,
      "review_status": "approved"
    }
  ],
  "events": [...]  // Same as data
}
```

### New App Router Response:
```json
{
  "success": true,
  "source": "database",
  "count": 100,
  "total": 100,
  "total_op_choudhary": 2325,
  "events": [
    {
      "id": 1,
      "tweet_id": "123",
      "tweet_text": "Tweet content",          // ✅ Clear naming
      "tweet_created_at": "2025-11-05T05:15:10Z",
      "author_username": "OPChoudhary_Ind",   // ✅ Author info
      "event_type": "inspection",
      "event_type_hi": "निरीक्षण",
      "event_type_confidence": 0.73,
      "event_date": "2025-11-05",             // ✅ Event date
      "date_confidence": 0.85,                // ✅ Date confidence
      "overall_confidence": 0.69,
      "needs_review": false,
      "review_status": "approved",
      "reviewed_at": "2025-11-06T10:30:00Z", // ✅ Review metadata
      "reviewed_by": "admin",
      // Backward compatibility fields
      "text": "Tweet content",
      "content": "Tweet content",
      "timestamp": "2025-11-05T05:15:10Z"
    }
  ],
  "data": [...]  // Same as events (backward compat)
}
```

---

## ✅ Migration Benefits

1. **No Breaking Changes:** Frontend code continues to work
2. **Better Performance:** Shared connection pooling
3. **More Features:** Author filtering, OP count, complete metadata
4. **Future-Proof:** Using modern Next.js patterns
5. **Code Quality:** Centralized utilities, better organization

---

## 📝 Notes

- **Both files are functionally equivalent** for basic use cases
- **App Router version is superior** in features and architecture
- **Old route was archived** (not deleted) for reference
- **No code was lost** - all functionality preserved and enhanced


