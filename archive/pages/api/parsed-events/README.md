# Archived: Old Pages Router API Route

**Date Archived:** 2025-11-05  
**Reason:** Duplicate route conflict with App Router version

## Original Location
`pages/api/parsed-events/index.ts`

## New Location
`src/app/api/parsed-events/route.ts` (App Router)

## Why Archived
- Next.js detected duplicate route: both `pages/api/parsed-events/index.ts` and `src/app/api/parsed-events/route.ts` resolve to `/api/parsed-events`
- App Router version (`src/app/api/parsed-events/route.ts`) is the active implementation
- App Router version uses correct column name (`author_handle`) and shared database pool

## Migration Notes
- The App Router version includes all functionality from this file
- Uses `getDbPool()` from `@/lib/db/pool` for consistent connection management
- Returns same response format: `{ success: true, count: N, events: [...] }`
- Supports same query parameters: `status`, `needs_review`, `limit`, `author`

## If Needed
If you need to reference the old implementation, it's preserved here. However, the App Router version should be used going forward.


