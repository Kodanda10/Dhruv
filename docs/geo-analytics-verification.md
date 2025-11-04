# Geo Analytics Endpoints - Data Structure Verification

**Date:** 2025-01-17  
**Status:** ✅ Verification Complete

## Findings

### ✅ geo_hierarchy Structure Confirmed

**Format:** JSONB Array of GeoHierarchy Objects

**Evidence:**
- TypeScript code (line 185 in `three-layer-consensus-engine.ts`): 
  ```typescript
  consensusResult.final_result.geo_hierarchy = allHierarchies; // Array
  ```
- Test file (`three-layer-consensus.test.ts` line 179):
  ```typescript
  geo_hierarchy: [
    {
      village: 'পंডरी',
      gram_panchayat: 'रायपुर',
      block: 'रायपुर',
      assembly: 'रायपुर शहर उत्तर',
      district: 'रायपुर',
      is_urban: true,
      ulb: 'रायपुर नगर निगम',
      ward_no: 5,
      confidence: 0.95
    }
  ]
  ```

### ❌ Endpoint Query Bug Identified

**Current Queries (INCORRECT):**
```sql
-- This assumes geo_hierarchy is a single object
WHERE geo_hierarchy->>'district' = $1
```

**Problem:** 
- `geo_hierarchy->>'district'` treats `geo_hierarchy` as a single JSONB object
- Actual structure is an **array** of objects: `[{district, assembly, block, ...}, ...]`
- These queries will return NULL or fail to match correctly

**Required Fix:**
- Must use `jsonb_array_elements()` to expand array
- Example correct query:
  ```sql
  FROM parsed_events, 
       jsonb_array_elements(geo_hierarchy) AS geo
  WHERE geo->>'district' = $1
  ```

## Next Steps

1. ✅ Verification complete (this document)
2. ⏭️ Write failing tests (TDD approach)
3. ⏭️ Fix endpoint queries to handle array format
4. ⏭️ Verify tests pass

## Data Structure Reference

Each `geo_hierarchy` array contains objects with:
```typescript
interface GeoHierarchy {
  village: string;
  gram_panchayat?: string;      // For rural
  ulb?: string;                  // For urban
  ward_no?: number;              // For urban
  block: string;
  assembly: string;
  district: string;
  is_urban: boolean;
  confidence: number;
}
```

