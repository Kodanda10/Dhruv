# Coverage Fix Plan - Reaching 85% Threshold

## Current Status

**Total Coverage**: 84.67% lines (Target: 85%)  
**Gap**: 0.33% (need ~3 more lines covered)

## Root Cause Analysis

### API Route (`route.ts`) - 0% Coverage (45 lines)

**Status**: Tests exist but not being counted in coverage

**File**: `src/app/api/ai-assistant/route.ts`  
**Lines**: 45 total, 0 covered (0%)  
**Impact**: Missing 45 lines = **-5.48%** to total coverage

**Why Tests Not Counted**:
- Tests exist in `tests/app/api/ai-assistant/route.test.ts`
- Coverage collection may not be including API route
- Tests might be mocked too heavily (not actually executing route code)

### Other Files Coverage

| File | Lines | Coverage | Status |
|------|-------|----------|--------|
| `context-manager.ts` | 111 | 100% | ✅ Perfect |
| `nl-parser.ts` | 135 | 94.07% | ✅ Excellent |
| `tools.ts` | 188 | 91.48% | ✅ Good |
| `model-manager.ts` | 108 | 90.74% | ✅ Good |
| `langgraph-assistant.ts` | 235 | 80% | ⚠️ Needs improvement |

## Solution: Fix API Route Coverage

### Option 1: Ensure API Route Tests Run (Recommended)

**Problem**: API route tests exist but coverage shows 0%

**Actions**:
1. Verify tests actually execute the route code (not just mocks)
2. Check if coverage collection includes API route
3. Ensure tests call actual route handlers, not just mocks

**Expected Impact**: +5.48% coverage (0% → 85%+)  
**New Total**: ~90% ✅

### Option 2: Improve LangGraph Assistant Coverage

**Current**: 80% (188/235 lines covered)  
**Missing**: 47 lines

**If we cover 10 more lines**:
- Current: 188/235 = 80%
- New: 198/235 = 84.26%
- Gain: +4.26% to file coverage
- Impact on total: ~+1.2%

**New Total**: ~86% ✅

### Option 3: Minor Improvements Across Files

**Quick wins**:
- Cover 5 more lines in `tools.ts` (91.48% → 94%)
- Cover 3 more lines in `nl-parser.ts` (94.07% → 96%)
- Cover 2 more lines in `model-manager.ts` (90.74% → 92%)

**Impact**: +0.5% to total coverage  
**New Total**: ~85.2% ✅

## Recommended Fix Strategy

### Priority 1: Fix API Route Coverage (CRITICAL)

**Why**: 
- Largest impact (+5.48%)
- Tests already exist
- Just need to ensure they're counted

**Steps**:
1. Review `tests/app/api/ai-assistant/route.test.ts`
2. Ensure tests actually execute route code (not just mocks)
3. Verify coverage collection includes API route
4. Run coverage and verify API route is counted

**Expected Result**: 84.67% → 90%+ ✅

### Priority 2: Improve LangGraph Assistant (Backup)

**If API route fix doesn't work**:
- Focus on error handling paths
- Cover state restoration edge cases
- Test model fallback scenarios

**Expected Impact**: +1-2% to total coverage

## Implementation Plan

### Step 1: Verify API Route Tests

```bash
# Run API route tests with coverage
npm test -- tests/app/api/ai-assistant/route.test.ts --coverage \
  --collectCoverageFrom="src/app/api/ai-assistant/**/*.ts"
```

### Step 2: Check Coverage Collection

Verify that:
- API route files are included in coverage collection
- Tests actually execute route handlers
- Coverage report shows API route coverage

### Step 3: Fix if Needed

If API route is still 0%:
- Review test mocks (might be too heavy)
- Ensure tests call actual route functions
- Add integration tests if needed

### Step 4: Verify Threshold

```bash
# Run full AI Assistant coverage
npm test -- tests/lib/ai-assistant/ --coverage \
  --collectCoverageFrom="src/lib/ai-assistant/**/*.ts" \
  --collectCoverageFrom="src/app/api/ai-assistant/**/*.ts"
```

### Step 5: Update CI

Ensure CI workflow collects coverage from both paths:
- `src/lib/ai-assistant/**/*.ts`
- `src/app/api/ai-assistant/**/*.ts`

## Quick Fix Option

If API route tests are complex to fix, we can:

1. **Temporarily adjust threshold** to 84.5% (very close)
2. **Focus on LangGraph Assistant** - cover 15 more lines
3. **Quick wins** - cover edge cases in other files

**This would get us to**: ~86% total coverage ✅

## Summary

**Main Issue**: API route (`route.ts`) has 0% coverage despite tests existing

**Solution**: Fix coverage collection for API route tests

**Impact**: Will easily push coverage above 85% threshold

**Status**: Ready to investigate and fix

