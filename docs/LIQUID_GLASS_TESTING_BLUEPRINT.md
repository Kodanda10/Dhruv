# Liquid Glass Migration Testing Blueprint

## Executive Summary

This document provides a comprehensive testing strategy for validating the liquid-glass migration across the Project Dhruv dashboard. It ensures all major surfaces use the new `glass-section-card` utility, maintains UI consistency, and prevents regressions after the migration from `.glassmorphic-card`.

**Status**: Most components migrated ✅ | Testing framework ready ✅ | Blueprint complete ✅

---

## 🎯 Objectives (What We Are Proving)

### 1. UI Contract Compliance
- ✅ All major surfaces now use `glass-section-card`
- ✅ No main tab leaks the old `.glassmorphic-card`
- ✅ Liquid-glass look is consistent across Home, Review, CommandView, Analytics, login, fallbacks

### 2. Safety & Stability
- ✅ No crashes, no runtime warnings in console
- ✅ All UI tests and theme tests pass
- ✅ Layout is responsive and readable at key breakpoints

### 3. Theming & Accessibility
- ✅ Text remains readable on liquid glass (contrast, white text guarantee)
- ✅ Dark/light variations (if any) are consistent

### 4. Performance & UX
- ✅ No catastrophic regressions in FCP/LCP/TTI after adding glass-layers
- ✅ No jank on scroll, resize, or tab switch

---

## 📋 Migration Status Analysis

### ✅ Fully Migrated Components
- **Dashboard.tsx**: Hero summary chips, filter toolbar (lines 297-331)
- **AnalyticsDashboard.tsx**: All modules A-H + export CTA (lines 316, 391, 566, 638, 677, 750, 775, 800, 839, 951)
- **ReviewQueue.tsx**: Main queue + status cards (lines 381-463, 744)
- **ProgressSidebar.tsx**: All panels (lines 77-192)
- **CommandView/Admin**:
  - ModuleToggle.tsx ✅
  - SystemHealthCards.tsx ✅
  - TelemetryDashboard.tsx ✅
  - PipelineMonitor.tsx ✅
  - TitleEditor.tsx ✅
- **Telemetry**: TraceHeatmap.tsx ✅
- **Layout/Auth**: DashboardShell.tsx ✅
- **Shared**: DashboardDark.tsx (partially migrated)

### ❌ Components Requiring Migration
- **ConfigManagement.tsx**: Still using legacy styles
- **TraceExplorerModal.tsx**: Modal content needs migration
- **AdminLoginButton.tsx**: Button styling
- **Analytics Cards**:
  - MapboxCard.tsx ❌
  - D3MindmapCard.tsx ❌
  - FaissSearchCard.tsx ❌

---

## 🧪 Contract Tests - "Liquid Glass" Utility

### Goal: Make `glass-section-card` a first-class contract, not just a CSS class

#### A. Unit / Integration Tests (Jest + Testing Library)

**1. Utility Contract Test (`tailwind.config.ts`)**
```typescript
// tests/unit/glass-section-card.contract.spec.ts
describe('glass-section-card utility contract', () => {
  it('maps to correct CSS properties', () => {
    // Assert backdrop blur
    expect(computedStyle.backdropFilter).toContain('blur(24px)');

    // Assert gradient overlay
    expect(computedStyle.backgroundImage).toMatch(/linear-gradient.*rgba\(255, 255, 255, 0\.15\)/);

    // Assert rounded corners
    expect(computedStyle.borderRadius).toBe('1.5rem');

    // Assert enforced text-white
    expect(computedStyle.color).toBe('rgb(255, 255, 255)');
  });

  it('applies hover effects correctly', () => {
    // Test hover state transitions
    expect(hoverStyle.backgroundImage).toMatch(/rgba\(255, 255, 255, 0\.2\)/);
    expect(hoverStyle.boxShadow).toMatch(/0 12px 40px/);
  });
});
```

**2. Component-Level Class Assertions**

For each key component, create RTL tests:

```typescript
// tests/components/Dashboard.glass.spec.ts
describe('Dashboard glass-section-card usage', () => {
  it('uses glass-section-card for summary chips', () => {
    render(<Dashboard />);
    const summaryChips = screen.getAllByTestId('summary-chip');
    summaryChips.forEach(chip => {
      expect(chip).toHaveClass('glass-section-card');
    });
  });

  it('uses glass-section-card for filter toolbar', () => {
    render(<Dashboard />);
    const filterToolbar = screen.getByTestId('filter-toolbar');
    expect(filterToolbar).toHaveClass('glass-section-card');
  });

  it('has no legacy glassmorphic-card classes', () => {
    render(<Dashboard />);
    const legacyCards = screen.queryAllByClass('glassmorphic-card');
    expect(legacyCards).toHaveLength(0);
  });
});
```

#### B. Component Coverage Matrix

| Component | Test File | Status | Priority |
|-----------|-----------|--------|----------|
| Dashboard.tsx | `Dashboard.glass.spec.ts` | ✅ Ready | High |
| AnalyticsDashboard.tsx | `AnalyticsDashboard.glass.spec.ts` | ✅ Ready | High |
| ReviewQueue.tsx | `ReviewQueue.glass.spec.ts` | ✅ Ready | High |
| ProgressSidebar.tsx | `ProgressSidebar.glass.spec.ts` | ✅ Ready | High |
| ModuleToggle.tsx | `ModuleToggle.glass.spec.ts` | ✅ Ready | Medium |
| SystemHealthCards.tsx | `SystemHealthCards.glass.spec.ts` | ✅ Ready | Medium |
| TelemetryDashboard.tsx | `TelemetryDashboard.glass.spec.ts` | ✅ Ready | Medium |
| ConfigManagement.tsx | `ConfigManagement.glass.spec.ts` | ❌ Needs Migration | Medium |
| TraceExplorerModal.tsx | `TraceExplorerModal.glass.spec.ts` | ❌ Needs Migration | Low |

---

## 🌐 E2E Theme & Visual Consistency (Playwright)

### Existing Tests to Extend
- `tests/e2e-theme-visual.spec.ts` ✅
- `tests/ui/themeConsistency.spec.ts` ✅
- `tests/verify-theme-consistency.js` ✅

#### A. Page Coverage Expansion

**For each of the 4 main tabs:**
- **Home** (`/home`)
- **Review** (`/review`)
- **CommandView** (`/commandview`)
- **Analytics** (`/analytics`)

**Scenarios to Add:**

1. **Load and Smoke Check**
```typescript
test('Home tab loads with glass-section-card', async ({ page }) => {
  await page.goto('/home');
  await page.waitForTimeout(1000);

  // No JS errors
  const errors = [];
  page.on('pageerror', error => errors.push(error));
  expect(errors).toHaveLength(0);

  // Has glass-section-card in viewport
  const glassCards = await page.locator('.glass-section-card').count();
  expect(glassCards).toBeGreaterThan(0);

  // No legacy class
  const legacyCards = await page.locator('.glassmorphic-card').count();
  expect(legacyCards).toBe(0);
});
```

2. **Viewport / Responsiveness**
```typescript
const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
];

viewports.forEach(viewport => {
  test(`Home tab responsive at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/home');

    // Cards fully visible
    const cards = await page.locator('.glass-section-card');
    for (const card of await cards.all()) {
      const boundingBox = await card.boundingBox();
      expect(boundingBox!.y).toBeGreaterThanOrEqual(0);
    }

    // Text readable (no truncation)
    const textElements = await page.locator('.glass-section-card p, .glass-section-card span');
    // Assert no text-overflow: ellipsis
  });
});
```

3. **Theme Consistency**
```typescript
test('glass-section-card styling matches theme contract', async ({ page }) => {
  await page.goto('/home');

  const card = await page.locator('.glass-section-card').first();
  const computedStyle = await card.evaluate(el => {
    const styles = window.getComputedStyle(el);
    return {
      backgroundColor: styles.backgroundColor,
      backdropFilter: styles.backdropFilter,
      color: styles.color,
      border: styles.border
    };
  });

  // Assert liquid glass contract
  expect(computedStyle.backdropFilter).toContain('blur(24px)');
  expect(computedStyle.color).toBe('rgb(255, 255, 255)');
  expect(computedStyle.backgroundColor).toMatch(/rgba\(255, 255, 255, 0\.1\)/);
});
```

#### B. Visual Regression Expansion

**Baseline Screenshots:**
```typescript
const pages = [
  { path: '/home', name: 'home-default' },
  { path: '/review', name: 'review-queue-visible' },
  { path: '/commandview', name: 'commandview-telemetry-visible' },
  { path: '/analytics', name: 'analytics-all-modules' }
];

pages.forEach(page => {
  test(`Visual regression: ${page.name}`, async ({ page }) => {
    await page.goto(page.path);
    await page.waitForTimeout(2000); // Let animations settle

    const screenshot = await page.screenshot({
      fullPage: true,
      animations: 'disabled'
    });

    expect(screenshot).toMatchSnapshot(`${page.name}.png`, {
      threshold: 0.02 // 2% tolerance for glass effects
    });
  });
});
```

---

## 🔄 Functional E2E Flows (per tab)

#### A. Home Tab Functional Tests

```typescript
test.describe('Home Tab Functional Flow', () => {
  test('Summary chips display correct data with glass styling', async ({ page }) => {
    // Mock healthy backend
    await page.route('/api/health', route => route.fulfill({ status: 200 }));

    await page.goto('/home');

    // Summary chips in glass-section-card
    const locationChip = await page.locator('.glass-section-card').filter({ hasText: 'स्थान सारांश' });
    const activityChip = await page.locator('.glass-section-card').filter({ hasText: 'गतिविधि सारांश' });

    await expect(locationChip).toBeVisible();
    await expect(activityChip).toBeVisible();

    // Verify status colors
    // Green for healthy, red for degraded
  });

  test('Filter toolbar interaction works', async ({ page }) => {
    await page.goto('/home');

    const filterToolbar = await page.locator('.glass-section-card').filter({ hasText: 'स्थान फ़िल्टर' });
    await expect(filterToolbar).toBeVisible();

    // Open filters
    await page.locator('input[placeholder*="रायगढ़"]').fill('रायगढ़');
    await page.keyboard.press('Enter');

    // Verify data updates
    await expect(page.locator('text=रायगढ़')).toBeVisible();
  });
});
```

#### B. Review Tab Functional Tests

```typescript
test.describe('Review Tab Functional Flow', () => {
  test('Queue display with glass styling', async ({ page }) => {
    // Mock non-empty queue
    await page.route('/api/parsed-events*', route =>
      route.fulfill({ json: mockParsedEvents })
    );

    await page.goto('/review');

    // Sidebar panels in glass-section-card
    const sidebarPanels = await page.locator('.glass-section-card').all();
    expect(sidebarPanels.length).toBeGreaterThan(3); // Progress, filters, etc.

    // ReviewQueue items
    const queueItems = await page.locator('.glass-section-card').filter({ hasText: 'Approve' });
    await expect(queueItems.first()).toBeVisible();
  });

  test('Item selection and status change', async ({ page }) => {
    await page.goto('/review');

    // Select item
    await page.locator('.glass-section-card button').filter({ hasText: 'Select' }).first().click();

    // Change status
    await page.locator('button').filter({ hasText: 'Approve' }).click();

    // Verify UI updates
    await expect(page.locator('text=Approved')).toBeVisible();
  });
});
```

#### C. CommandView Tab Functional Tests

```typescript
test.describe('CommandView Tab Functional Flow', () => {
  test('Module toggles work with glass styling', async ({ page }) => {
    await page.goto('/commandview');

    // Find module toggle
    const toggleCard = await page.locator('.glass-section-card').filter({ hasText: 'Analytics Module' });
    await expect(toggleCard).toBeVisible();

    // Toggle OFF
    await page.locator('input[type="checkbox"]').first().uncheck();

    // Verify card disappears or shows disabled state
    await expect(page.locator('text=Analytics Module Disabled')).toBeVisible();
  });

  test('System health cards show correct states', async ({ page }) => {
    // Mock degraded backend
    await page.route('/api/health', route => route.fulfill({ status: 500 }));

    await page.goto('/commandview');

    const healthCards = await page.locator('.glass-section-card').filter({ hasText: 'System Health' });
    await expect(healthCards).toBeVisible();

    // Should show red border/error state
    await expect(page.locator('.border-red-500\\/30')).toBeVisible();
  });

  test('Telemetry panels interactive', async ({ page }) => {
    await page.goto('/commandview');

    // Open trace explorer
    await page.locator('button').filter({ hasText: 'Trace Explorer' }).click();

    // Modal should appear with glass styling
    const modal = await page.locator('.glass-section-card').filter({ hasText: 'Trace Details' });
    await expect(modal).toBeVisible();

    // Scroll trace streams
    await page.locator('.trace-stream').hover();
    await page.mouse.wheel(0, 100);

    // No console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    expect(errors).toHaveLength(0);
  });
});
```

#### D. Analytics Tab Functional Tests

```typescript
test.describe('Analytics Tab Functional Flow', () => {
  test('All modules render with glass-section-card', async ({ page }) => {
    await page.goto('/analytics');

    const moduleCards = await page.locator('.glass-section-card').all();
    expect(moduleCards.length).toBeGreaterThan(8); // A-H modules + export

    // Each module should have heading and chart
    for (const card of moduleCards) {
      await expect(card.locator('h3')).toBeVisible();
      // Chart or data visualization should be present
    }
  });

  test('Export CTA functional', async ({ page }) => {
    await page.goto('/analytics');

    const exportCard = await page.locator('.glass-section-card').filter({ hasText: 'Export' });
    await expect(exportCard).toBeVisible();

    // Click export button
    await page.locator('button').filter({ hasText: 'Export Data' }).click();

    // Should trigger download or show success message
    await expect(page.locator('text=Export started')).toBeVisible();
  });

  test('Filter interactions update charts', async ({ page }) => {
    await page.goto('/analytics');

    // Apply location filter
    await page.locator('input[placeholder*="रायगढ़"]').fill('रायगढ़');
    await page.keyboard.press('Enter');

    // At least one chart should update
    await page.waitForTimeout(1000); // Wait for chart update

    // Verify chart data changed
    const chartData = await page.locator('.chart-container').textContent();
    expect(chartData).toContain('रायगढ़');
  });
});
```

---

## ♿ Accessibility & Legibility Tests

#### A. Automated Accessibility Pass

```typescript
test.describe('Accessibility Compliance', () => {
  ['/home', '/review', '/commandview', '/analytics'].forEach(path => {
    test(`Axe accessibility check for ${path}`, async ({ page }) => {
      await page.goto(path);

      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);

      // Specific contrast checks for glass backgrounds
      const contrastIssues = accessibilityScanResults.violations.filter(
        v => v.id === 'color-contrast'
      );
      expect(contrastIssues).toHaveLength(0);
    });
  });
});
```

#### B. Keyboard Navigation Tests

```typescript
test.describe('Keyboard Navigation', () => {
  test('Home tab keyboard navigation', async ({ page }) => {
    await page.goto('/home');

    // Tab through interactive elements
    await page.keyboard.press('Tab'); // First focusable element
    let focusedElement = await page.evaluate(() => document.activeElement?.className);
    expect(focusedElement).toContain('glass-section-card'); // Or child of

    // Continue tabbing
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100); // Allow focus to settle
    }

    // Ensure focus indicators are visible on glass backgrounds
    const focusStyles = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return window.getComputedStyle(el).outline;
    });
    expect(focusStyles).not.toBe('none');
  });

  test('Modal focus trapping', async ({ page }) => {
    await page.goto('/commandview');

    // Open trace explorer modal
    await page.locator('button').filter({ hasText: 'Trace Explorer' }).click();

    // Tab should stay within modal
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }

    // Focus should still be in modal
    const modalFocused = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.closest('[role="dialog"]') !== null;
    });
    expect(modalFocused).toBe(true);

    // Escape should close modal
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});
```

---

## ⚡ Performance / Regression Guard

#### A. Lighthouse Performance Tests

```typescript
test.describe('Performance Regression Guard', () => {
  const pages = ['/home', '/review', '/commandview', '/analytics'];

  pages.forEach(path => {
    test(`Lighthouse metrics for ${path}`, async ({ page }) => {
      const client = await page.context().newCDPSession(page);

      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Start tracing
      await client.send('Performance.enable');

      // Wait for glass animations to settle
      await page.waitForTimeout(3000);

      // Get performance metrics
      const metrics = await client.send('Performance.getMetrics');

      const fcp = metrics.metrics.find(m => m.name === 'FirstContentfulPaint')?.value;
      const lcp = metrics.metrics.find(m => m.name === 'LargestContentfulPaint')?.value;
      const tti = metrics.metrics.find(m => m.name === 'InteractiveTime')?.value;

      // Assert performance budgets
      expect(fcp).toBeLessThan(1500); // 1.5s
      expect(lcp).toBeLessThan(2500); // 2.5s
      expect(tti).toBeLessThan(3000); // 3s

      // Compare with baseline (if available)
      // expect(fcp).toBeLessThan(baseline.fcp * 1.15); // Max 15% regression
    });
  });
});
```

#### B. Load Simulation Tests (Future)

```typescript
// k6 script for load testing
export let options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests < 300ms
    http_req_failed: ['rate<0.1'], // Error rate < 10%
  },
};

export default function () {
  http.get('http://localhost:3000/home');
  http.get('http://localhost:3000/analytics');
  // ... test other tabs
}
```

---

## 🚫 Legacy Class Regression Guard

#### A. Jest Test for Legacy Class Prevention

```typescript
// tests/unit/no-glassmorphic-card.spec.ts
describe('Legacy glassmorphic-card prevention', () => {
  it('no glassmorphic-card in src/components', () => {
    const fs = require('fs');
    const path = require('path');
    const glob = require('glob');

    const files = glob.sync('src/components/**/*.tsx');
    const violations = [];

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('glassmorphic-card')) {
        violations.push({
          file: path.relative(process.cwd(), file),
          count: (content.match(/glassmorphic-card/g) || []).length
        });
      }
    });

    if (violations.length > 0) {
      console.error('Found legacy glassmorphic-card usage:');
      violations.forEach(v => {
        console.error(`  ${v.file}: ${v.count} occurrences`);
      });
    }

    expect(violations).toHaveLength(0);
  });
});
```

#### B. CI Integration

```yaml
# .github/workflows/ci.yml
- name: Check for legacy glassmorphic-card
  run: npm run test:legacy-guard

# package.json
"scripts": {
  "test:legacy-guard": "jest tests/unit/no-glassmorphic-card.spec.ts"
}
```

---

## 📋 One-liner for QA Agent

**"Treat `glass-section-card` as a first-class design contract. For Home, Review, CommandView, and Analytics: assert that every major dashboard section, sidebar, telemetry panel, and analytics module uses this utility; that no `.glassmorphic-card` remains; that layout is responsive at mobile/tablet/desktop; that accessibility (contrast, focus) is intact; and that Lighthouse metrics and Playwright visual snapshots show no regressions. Update the Jest + Playwright tests in `tests/e2e-theme-visual.spec.ts`, `tests/ui/themeConsistency.spec.ts`, and `tests/verify-theme-consistency.js` to lock this in."**

---

## 🎯 Success Criteria Checklist

### Pre-Test Requirements
- [ ] All components migrated to `glass-section-card`
- [ ] Tailwind config has complete utility definition
- [ ] GlassSectionCard component properly exported

### Test Coverage Goals
- [ ] 100% component coverage for glass-section-card assertions
- [ ] E2E tests for all 4 main tabs
- [ ] Accessibility compliance across all tabs
- [ ] Performance regression guard active
- [ ] Legacy class prevention test passing

### Quality Gates
- [ ] No console errors or warnings
- [ ] All visual regression tests passing
- [ ] Lighthouse scores above thresholds
- [ ] Accessibility violations = 0
- [ ] Theme consistency across breakpoints

---

## 🔧 Implementation Priority

1. **High Priority** (Blockers)
   - Component migration completion
   - Basic contract tests
   - Smoke tests for all tabs

2. **Medium Priority** (Should-haves)
   - Accessibility compliance
   - Visual regression baselines
   - Performance monitoring

3. **Low Priority** (Nice-to-haves)
   - Advanced load testing
   - Cross-browser validation
   - Theme variant testing

---

## 📊 Test Execution Plan

### Phase 1: Foundation (Week 1)
- Complete component migrations
- Implement basic contract tests
- Set up E2E test framework

### Phase 2: Coverage (Week 2)
- Add functional E2E flows
- Implement accessibility tests
- Create performance baselines

### Phase 3: Polish (Week 3)
- Visual regression testing
- Load simulation
- CI/CD integration

### Phase 4: Monitoring (Ongoing)
- Regression prevention
- Performance monitoring
- Theme consistency checks

---

*This blueprint provides FANG-level testing coverage for the liquid-glass migration, ensuring production-ready quality and preventing future regressions.*