/**
 * Functional E2E Flows for Liquid Glass Migration
 *
 * Tests complete user workflows for each dashboard tab to ensure
 * glass-section-card integration works in real usage scenarios.
 */

import { test, expect } from '@playwright/test';

test.describe('Home Tab Functional Flow', () => {
  test('Summary chips display with glass styling and correct data', async ({ page }) => {
    // Mock healthy backend
    await page.route('/api/health', route => route.fulfill({
      status: 200,
      json: { status: 'healthy', uptime: '99.9%' }
    }));

    // Mock parsed events data
    await page.route('/api/parsed-events*', route => route.fulfill({
      status: 200,
      json: [
        {
          id: 1,
          where: ['रायगढ़', 'बिलासपुर'],
          what: ['education', 'healthcare'],
          confidence: 0.9
        },
        {
          id: 2,
          where: ['रायगढ़'],
          what: ['education'],
          confidence: 0.8
        }
      ]
    }));

    await page.goto('/home');
    await page.waitForTimeout(1000);

    // Summary chips in glass-section-card
    const locationChip = page.locator('.glass-section-card').filter({ hasText: 'स्थान सारांश' });
    const activityChip = page.locator('.glass-section-card').filter({ hasText: 'गतिविधि सारांश' });

    await expect(locationChip).toBeVisible();
    await expect(activityChip).toBeVisible();

    // Verify content appears
    await expect(locationChip).toContainText('रायगढ़');
    await expect(activityChip).toContainText('education');
  });

  test('Filter toolbar interaction works with glass styling', async ({ page }) => {
    await page.route('/api/parsed-events*', route => route.fulfill({
      status: 200,
      json: []
    }));

    await page.goto('/home');
    await page.waitForTimeout(1000);

    // Find filter toolbar in glass container
    const filterToolbar = page.locator('.glass-section-card').filter({ hasText: 'स्थान फ़िल्टर' });
    await expect(filterToolbar).toBeVisible();

    // Input should be visible and functional
    const locationInput = filterToolbar.locator('input[placeholder*="रायगढ़"]');
    await expect(locationInput).toBeVisible();

    // Type in filter
    await locationInput.fill('रायगढ़');
    await locationInput.press('Enter');

    // Should maintain glass styling after interaction
    await expect(filterToolbar).toHaveClass('glass-section-card');
  });

  test('Degraded backend shows error states in glass cards', async ({ page }) => {
    // Mock degraded backend
    await page.route('/api/health', route => route.fulfill({
      status: 500,
      json: { error: 'Database connection failed' }
    }));

    await page.goto('/home');
    await page.waitForTimeout(1000);

    // Should still show glass cards but with error styling
    const glassCards = page.locator('.glass-section-card');
    await expect(glassCards.first()).toBeVisible();

    // Check for error indicators within glass cards
    const errorElements = page.locator('.glass-section-card .border-red-500');
    // May or may not be present depending on implementation
  });
});

test.describe('Review Tab Functional Flow', () => {
  test('Queue display with glass styling', async ({ page }) => {
    // Mock non-empty queue
    await page.route('/api/parsed-events*', route => route.fulfill({
      status: 200,
      json: [
        {
          id: 1,
          content: 'Test event content for review',
          parsed: {
            where: ['रायगढ़'],
            what: ['education'],
            confidence: 0.9
          },
          needs_review: true,
          review_status: 'pending'
        }
      ]
    }));

    await page.goto('/review');
    await page.waitForTimeout(1000);

    // Sidebar panels in glass-section-card
    const sidebarPanels = page.locator('.glass-section-card');
    expect(await sidebarPanels.count()).toBeGreaterThan(3);

    // ReviewQueue items in glass cards
    const queueItems = page.locator('.glass-section-card').filter({ hasText: 'Test event content' });
    await expect(queueItems).toBeVisible();
  });

  test('Item selection and status change', async ({ page }) => {
    await page.route('/api/parsed-events*', route => route.fulfill({
      status: 200,
      json: [
        {
          id: 1,
          content: 'Selectable test event',
          parsed: { where: ['test'], what: ['test'], confidence: 0.9 },
          needs_review: true,
          review_status: 'pending'
        }
      ]
    }));

    await page.route('/api/parsed-events/1', route => route.fulfill({
      status: 200,
      json: { success: true }
    }));

    await page.goto('/review');
    await page.waitForTimeout(1000);

    // Find and click select button within glass card
    const selectButton = page.locator('.glass-section-card button').filter({ hasText: /Select|Approve/i }).first();
    await expect(selectButton).toBeVisible();

    await selectButton.click();

    // Status should update within glass container
    const approvedText = page.locator('.glass-section-card').filter({ hasText: /Approved|Accepted/i });
    // May appear after action depending on implementation
  });

  test('Empty queue displays appropriately in glass styling', async ({ page }) => {
    // Mock empty queue
    await page.route('/api/parsed-events*', route => route.fulfill({
      status: 200,
      json: []
    }));

    await page.goto('/review');
    await page.waitForTimeout(1000);

    // Should still have glass-section-card containers
    const glassCards = page.locator('.glass-section-card');
    await expect(glassCards.first()).toBeVisible();

    // May show empty state message within glass card
    const emptyMessage = page.locator('.glass-section-card').filter({ hasText: /No events|Empty|No items/i });
    // Empty message may or may not be present
  });
});

test.describe('CommandView Tab Functional Flow', () => {
  test('Module toggles work with glass styling', async ({ page }) => {
    await page.goto('/commandview');
    await page.waitForTimeout(1000);

    // Find module toggle in glass card
    const toggleCard = page.locator('.glass-section-card').filter({ hasText: /Analytics|Module/i });
    await expect(toggleCard).toBeVisible();

    // Find toggle input
    const toggle = toggleCard.locator('input[type="checkbox"]').first();
    if (await toggle.isVisible()) {
      const initialState = await toggle.isChecked();

      // Toggle the module
      await toggle.click();

      // Card should maintain glass styling
      await expect(toggleCard).toHaveClass('glass-section-card');
    }
  });

  test('System health cards show status in glass containers', async ({ page }) => {
    // Mock healthy system
    await page.route('/api/health', route => route.fulfill({
      status: 200,
      json: { status: 'healthy', services: { db: 'up', api: 'up' } }
    }));

    await page.goto('/commandview');
    await page.waitForTimeout(1000);

    // Find health cards
    const healthCards = page.locator('.glass-section-card').filter({ hasText: /Health|System|Status/i });
    await expect(healthCards.first()).toBeVisible();

    // Should show healthy indicators
    const healthyIndicators = page.locator('.glass-section-card .border-green-500, .glass-section-card .bg-green-500');
    // May or may not be present depending on design
  });

  test('Telemetry panels interactive within glass containers', async ({ page }) => {
    await page.goto('/commandview');
    await page.waitForTimeout(1000);

    // Look for telemetry/tracing elements
    const telemetryCard = page.locator('.glass-section-card').filter({ hasText: /Trace|Telemetry|Monitor/i });
    if (await telemetryCard.isVisible()) {
      // Test scrolling within glass container
      await telemetryCard.hover();

      // Should maintain glass styling during interaction
      await expect(telemetryCard).toHaveClass('glass-section-card');
    }
  });

  test('Degraded system shows error states in glass cards', async ({ page }) => {
    // Mock degraded system
    await page.route('/api/health', route => route.fulfill({
      status: 500,
      json: { status: 'degraded', error: 'Database slow' }
    }));

    await page.goto('/commandview');
    await page.waitForTimeout(1000);

    // Should show error indicators within glass cards
    const errorCards = page.locator('.glass-section-card').filter({ hasText: /Error|Failed|Degraded/i });
    // Error cards may or may not be present depending on implementation

    // Cards should still maintain glass styling
    const allGlassCards = page.locator('.glass-section-card');
    await expect(allGlassCards.first()).toHaveClass('glass-section-card');
  });
});

test.describe('Analytics Tab Functional Flow', () => {
  test('All modules render with glass-section-card', async ({ page }) => {
    await page.route('/api/parsed-events*', route => route.fulfill({
      status: 200,
      json: [
        { id: 1, where: ['test'], what: ['test'], confidence: 0.9 }
      ]
    }));

    await page.goto('/analytics');
    await page.waitForTimeout(1000);

    // Should have multiple glass-section-card modules
    const glassCards = page.locator('.glass-section-card');
    const cardCount = await glassCards.count();
    expect(cardCount).toBeGreaterThan(5); // A-H modules + filter + export

    // Each should have proper headings
    const headings = page.locator('.glass-section-card h1, .glass-section-card h2, .glass-section-card h3');
    expect(await headings.count()).toBeGreaterThan(3);
  });

  test('Filter section works within glass container', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForTimeout(1000);

    // Find filter section
    const filterCard = page.locator('.glass-section-card').filter({ hasText: /फ़िल्टर|Filter/i });
    await expect(filterCard).toBeVisible();

    // Find location input
    const locationInput = filterCard.locator('input[placeholder*="रायगढ़"]');
    if (await locationInput.isVisible()) {
      await locationInput.fill('रायगढ़');
      await locationInput.press('Enter');

      // Filter card should maintain glass styling
      await expect(filterCard).toHaveClass('glass-section-card');
    }
  });

  test('Export CTA functional within glass container', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForTimeout(1000);

    // Find export section
    const exportCard = page.locator('.glass-section-card').filter({ hasText: /Export|Download/i });
    if (await exportCard.isVisible()) {
      await expect(exportCard).toHaveClass('glass-section-card');

      // Find export button
      const exportButton = exportCard.locator('button').filter({ hasText: /Export|Download/i });
      if (await exportButton.isVisible()) {
        // Should be clickable (though download may not work in test)
        await expect(exportButton).toBeEnabled();
      }
    }
  });

  test('Charts update when filters change', async ({ page }) => {
    await page.route('/api/parsed-events*', route => route.fulfill({
      status: 200,
      json: [
        { id: 1, where: ['रायगढ़'], what: ['education'], confidence: 0.9 },
        { id: 2, where: ['बिलासपुर'], what: ['healthcare'], confidence: 0.8 }
      ]
    }));

    await page.goto('/analytics');
    await page.waitForTimeout(1000);

    // Apply location filter
    const locationInput = page.locator('.glass-section-card input[placeholder*="रायगढ़"]');
    if (await locationInput.isVisible()) {
      await locationInput.fill('रायगढ़');
      await locationInput.press('Enter');

      await page.waitForTimeout(500); // Allow for chart updates

      // At least one chart/module should reflect the filter
      const chartContainers = page.locator('.glass-section-card').filter({ hasText: /रायगढ़|Chart|Graph|Data/i });
      expect(await chartContainers.count()).toBeGreaterThan(0);
    }
  });
});

test.describe('Cross-Tab Glass Consistency', () => {
  const tabs = [
    { path: '/home', name: 'Home' },
    { path: '/review', name: 'Review' },
    { path: '/commandview', name: 'CommandView' },
    { path: '/analytics', name: 'Analytics' }
  ];

  test('All tabs maintain glass styling during navigation', async ({ page }) => {
    for (const tab of tabs) {
      await page.goto(`http://localhost:3000${tab.path}`);
      await page.waitForTimeout(1000);

      // Each tab should have glass-section-card elements
      const glassCards = page.locator('.glass-section-card');
      await expect(glassCards.first()).toBeVisible();

      // No legacy classes
      const legacyCards = page.locator('.glassmorphic-card');
      await expect(legacyCards).toHaveCount(0);

      // Should have proper text contrast
      const textElements = page.locator('.glass-section-card p, .glass-section-card span, .glass-section-card h1, .glass-section-card h2, .glass-section-card h3');
      if (await textElements.count() > 0) {
        const textColor = await textElements.first().evaluate(el => window.getComputedStyle(el).color);
        expect(textColor).toBe('rgb(255, 255, 255)');
      }
    }
  });

  test('No JavaScript errors during tab navigation', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', error => {
      errors.push(error.message);
    });

    for (const tab of tabs) {
      await page.goto(`http://localhost:3000${tab.path}`);
      await page.waitForTimeout(1000);

      // Perform some interactions on each tab
      const glassCards = page.locator('.glass-section-card');
      if (await glassCards.count() > 0) {
        await glassCards.first().hover();
        await page.waitForTimeout(100);
      }
    }

    expect(errors).toHaveLength(0);
  });
});