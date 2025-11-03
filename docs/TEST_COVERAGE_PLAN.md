# Test Coverage Plan - Parsed Events API Route

## Current Status
- **Statements**: 80.31% (Target: 85%+)
- **Branches**: 53.74% (Target: 70%+)
- **Functions**: 78.26%
- **Lines**: 82.35%

## Uncovered Code (Lines 142-219, 292)
1. **File Fallback Logic** (142-219): Fallback to `parsed_tweets.json` when database fails
2. **PUT Endpoint** (292+): Update endpoint logic

## Test Fixes Needed
1. Fix aggregation test expectations (locations, schemes count correctly but test expectations wrong)
2. Fix timeline aggregation test (date parsing)
3. Fix invalid limit parameter test (mockQueryFn instead of mockQuery)
4. Remove/update performance test (not applicable in unit tests)
5. Add comprehensive tests for file fallback
6. Add tests for PUT endpoint

## Action Plan
1. ✅ Fixed mock setup - Pool now properly mocked
2. ⏳ Fix aggregation test expectations  
3. ⏳ Add file fallback tests
4. ⏳ Add PUT endpoint tests
5. ⏳ Verify 85%+ coverage

