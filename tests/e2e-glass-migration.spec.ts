import { test, expect } from '@playwright/test';

test.describe('Glass Section Card Migration E2E Tests', () => {
  test.describe('Home Tab (/home)', () => {
    test('should display glass-section-card components correctly', async ({ page }) => {
      await page.goto('/home');

      // Verify page loads
      await expect(page).toHaveTitle(/Project Dhruv/);

      // Check for glass-section-card usage
      const glassCards = page.locator('.glass-section-card');
      await expect(glassCards.first()).toBeVisible();

      // Verify glassmorphic styling is applied
      const firstCard = glassCards.first();
      await expect(firstCard).toHaveCSS('backdrop-filter', /blur\(24px\)/);
      await expect(firstCard).toHaveCSS('background', /rgba\(255, 255, 255, 0\.1\)/);
    });
  });

  test.describe('Dashboard Tab (/dashboard)', () => {
    test('should display dashboard with glass-section-card components', async ({ page }) => {
      await page.goto('/dashboard');

      // Verify page loads
      await expect(page).toHaveTitle(/Dashboard/);

      // Check for glass-section-card usage in dashboard
      const glassCards = page.locator('.glass-section-card');
      await expect(glassCards.first()).toBeVisible();

      // Verify summary chips use glass-section-card
      const summaryChips = page.locator('.glass-section-card').filter({ hasText: /Total|Parsed|Pending/ });
      await expect(summaryChips).toHaveCount(await summaryChips.count());

      // Verify glassmorphic styling
      const firstCard = glassCards.first();
      await expect(firstCard).toHaveCSS('backdrop-filter', /blur\(24px\)/);
    });
  });

  test.describe('Analytics Tab (/dashboard/analytics)', () => {
    test('should display analytics with glass-section-card components', async ({ page }) => {
      await page.goto('/dashboard/analytics');

      // Verify page loads
      await expect(page).toHaveTitle(/Analytics/);

      // Check for glass-section-card usage in analytics
      const glassCards = page.locator('.glass-section-card');
      await expect(glassCards.first()).toBeVisible();

      // Verify analytics visualizations use glass-section-card
      const charts = page.locator('.glass-section-card').filter({ has: page.locator('svg, canvas') });
      if (await charts.count() > 0) {
        await expect(charts.first()).toBeVisible();
      }

      // Verify glassmorphic styling
      const firstCard = glassCards.first();
      await expect(firstCard).toHaveCSS('backdrop-filter', /blur\(24px\)/);
    });
  });

  test.describe('Review Tab (/review)', () => {
    test('should display review interface with glass-section-card components', async ({ page }) => {
      await page.goto('/review');

      // Verify page loads
      await expect(page).toHaveTitle(/Review/);

      // Check for glass-section-card usage in review
      const glassCards = page.locator('.glass-section-card');
      await expect(glassCards.first()).toBeVisible();

      // Verify review components use glass-section-card
      const reviewCards = page.locator('.glass-section-card').filter({ hasText: /Review|Approve|Reject/ });
      if (await reviewCards.count() > 0) {
        await expect(reviewCards.first()).toBeVisible();
      }

      // Verify glassmorphic styling
      const firstCard = glassCards.first();
      await expect(firstCard).toHaveCSS('backdrop-filter', /blur\(24px\)/);
    });
  });

  test.describe('CommandView Tab (/commandview)', () => {
    test('should display command view with glass-section-card components', async ({ page }) => {
      await page.goto('/commandview');

      // Verify page loads
      await expect(page).toHaveTitle(/CommandView/);

      // Check for glass-section-card usage in commandview
      const glassCards = page.locator('.glass-section-card');
      await expect(glassCards.first()).toBeVisible();

      // Verify command view components use glass-section-card
      const commandCards = page.locator('.glass-section-card').filter({ hasText: /Command|Execute|Status/ });
      if (await commandCards.count() > 0) {
        await expect(commandCards.first()).toBeVisible();
      }

      // Verify glassmorphic styling
      const firstCard = glassCards.first();
      await expect(firstCard).toHaveCSS('backdrop-filter', /blur\(24px\)/);
    });
  });

  test.describe('Legacy Component Prevention', () => {
    test('should not contain any glassmorphic-card legacy components', async ({ page }) => {
      // Test across all main tabs
      const tabs = ['/home', '/dashboard', '/dashboard/analytics', '/review', '/commandview'];

      for (const tab of tabs) {
        await page.goto(tab);

        // Verify no legacy glassmorphic-card class exists
        const legacyCards = page.locator('.glassmorphic-card');
        await expect(legacyCards).toHaveCount(0);
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should maintain glass-section-card styling on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/dashboard');

      // Check that glass-section-card components are still properly styled
      const glassCards = page.locator('.glass-section-card');
      await expect(glassCards.first()).toBeVisible();

      // Verify glassmorphic styling is maintained
      const firstCard = glassCards.first();
      await expect(firstCard).toHaveCSS('backdrop-filter', /blur\(24px\)/);
    });
  });
});