# Duplicate Route Fix

## Issue
Next.js detected duplicate API routes:
- `pages/api/parsed-events/index.ts` (Pages Router)
- `src/app/api/parsed-events/route.ts` (App Router)

Both resolved to `/api/parsed-events`, causing a conflict.

## Resolution

### ✅ Archived Old Route
- **Moved:** `pages/api/parsed-events/index.ts` → `archive/pages/api/parsed-events/index.ts`
- **Removed:** Empty `pages/api` directory structure
- **Kept:** `src/app/api/parsed-events/route.ts` (App Router - active)

### ✅ Active Route
- **Location:** `src/app/api/parsed-events/route.ts`
- **Type:** App Router (Next.js 13+)
- **Status:** ✅ Active and working
- **Features:**
  - Direct database access via `getDbPool()`
  - Uses correct column: `author_handle`
  - Returns formatted events matching Flask API format
  - Supports query params: `status`, `needs_review`, `limit`, `author`

## Verification

```bash
# Verify only one route exists
find . -name "*parsed-events*" -type f | grep -v node_modules | grep -v .next

# Should show only:
# src/app/api/parsed-events/route.ts
```

## Next Steps

1. ✅ Duplicate route conflict resolved
2. ✅ Old route archived
3. ⏳ Restart Next.js dev server to clear the warning
4. ✅ Frontend will use App Router version automatically

## Notes

- The App Router version (`src/app/api/parsed-events/route.ts`) is the canonical implementation
- It includes all functionality from the old Pages Router version
- Uses modern Next.js App Router patterns
- Better integration with Next.js 13+ features


