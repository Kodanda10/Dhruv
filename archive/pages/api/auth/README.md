# Archived Pages Router Auth API Routes

These files were moved from `pages/api/auth/` to archive because they conflicted with the App Router routes in `src/app/api/auth/`.

## Archived Files:
- `login.ts` - Old Pages Router login handler
- `logout.ts` - Old Pages Router logout handler  
- `status.ts` - Old Pages Router status handler

## Current Implementation:
All auth routes are now implemented using Next.js App Router in:
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/status/route.ts`

## Migration Date:
Archived on: $(date)

## Reason:
Next.js detected duplicate routes resolving to the same paths, causing 404 errors. The App Router implementation is the correct one to use.
