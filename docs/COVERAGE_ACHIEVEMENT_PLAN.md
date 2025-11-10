# Geo Analytics Coverage Achievement Plan

## Current Status
- **Statements**: 60.78% (target: 85%+) ❌
- **Branches**: 8.84% (target: 70%+) ❌  
- **Lines**: 61.58%
- **Tests**: 94 passing, 95 total

## Analysis

### Branch Coverage Breakdown (113 total branches)

1. **Filter Parameter Branches** (18 branches)
   - `if (startDate)` - 3 endpoints × 2 branches = 6
   - `if (endDate)` - 3 endpoints × 2 branches = 6
   - `if (eventType)` - 3 endpoints × 2 branches = 6

2. **Validation Branches** (4 branches)
   - `if (!district)` - by-district endpoint = 2 branches
   - `if (!district || !assembly)` - by-assembly endpoint = 2 branches

3. **Error Handling Branches** (6 branches)
   - `error instanceof Error` - 3 endpoints × 2 branches = 6

4. **Null Coalescing Branches** (~30+ branches)
   - `row.ulb || null`
   - `row.gram_panchayat || null`
   - `startDate || null`
   - `endDate || null`
   - `eventType || null`
   - `row.event_count || '0'`
   - `result?.rows || []`

5. **Ternary Operator Branches** (8 branches)
   - `row.ward_no ? parseInt(...) : null` - 2 endpoints × 2 = 4
   - `row.is_urban === 'true'` comparisons - 3 endpoints × 2 = 6 (but more variations)

6. **SQL CASE Branches** (2 branches)
   - `CASE WHEN geo->>'is_urban' = 'true' THEN 'urban' ELSE 'rural'` - 3 queries × 2 = 6

7. **Optional Chaining Branches** (15+ branches)
   - `districtResult?.rows || []` - 5 queries × 3 endpoints = 15

## Strategy to Achieve 85%+ Statements, 70%+ Branches

### Phase 1: Ensure All Filter Combinations Tested ✅
- Test all combinations of startDate, endDate, eventType
- Test each filter individually
- Test all filters together

### Phase 2: Test All Validation Branches ✅
- Test missing district parameter
- Test missing assembly parameter
- Test missing both parameters

### Phase 3: Test Null Coalescing Branches (Critical)
Need to test:
- Events with null ulb → should use `|| null`
- Events with null gram_panchayat → should use `|| null`
- Events with null ward_no → should use ternary `? parseInt() : null`
- Requests without filters → should use `|| null` for filters
- Query results with null rows → should use `?.rows || []`

### Phase 4: Test Error Paths
- Mock database failures to hit catch blocks
- Test `error instanceof Error` branches (both true and false)

### Phase 5: Test Type Conversions
- Test `row.is_urban === 'true'` → boolean conversion
- Test `row.is_urban !== 'true'` → boolean false
- Test `parseInt(row.event_count || '0')` with null/undefined
- Test `parseInt(row.ward_no)` when ward_no exists

## Implementation Notes

Since database may not be available, we need to:
1. Test as many branches as possible with real data
2. Use targeted mocks ONLY for error paths and hard-to-reach branches
3. Ensure all filter combinations are tested
4. Ensure all null coalescing scenarios are tested

## Test Files Status

✅ `geo-analytics.test.ts` - 14 tests, real DB
✅ `geo-analytics-comprehensive-real.test.ts` - 22 tests, real DB  
✅ `geo-analytics-integration.test.ts` - ~18 tests, real DB
✅ `geo-analytics-branch-coverage-real.test.ts` - ~20 tests, real DB
✅ `geo-analytics-edge-cases.test.ts` - ~15 tests, real DB

**Total: ~89 tests using real database**

## Next Steps

1. Add tests for all null coalescing scenarios
2. Add tests for all ternary operator branches  
3. Add tests for error paths (use minimal mocking)
4. Verify coverage reaches targets
5. Create PR and commit

