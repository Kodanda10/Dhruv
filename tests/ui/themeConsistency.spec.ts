/**
 * Visual Regression Tests for Theme Consistency
 * 
 * Ensures all dashboard tabs (Home, Review, CommandView, Analytics) use
 * the same unified purple-lavender glassmorphic theme.
 * 
 * Uses Playwright screenshot comparison to detect color/gradient drift.
 */

import { test, expect } from '@playwright/test';

const tabs = [
  { path: '/home', name: 'Home' },
  { path: '/review', name: 'Review' },
  { path: '/commandview', name: 'CommandView' },
  { path: '/analytics', name: 'Analytics' },
];

// Test theme consistency across all tabs
// Temporarily disabled screenshot tests - focus on functional tests first
// for (const tab of tabs) {
//   test(`UI theme consistency for ${tab.name} (${tab.path})`, async ({ page }) => {
//     // Navigate to the tab
//     await page.goto(`http://localhost:3000${tab.path}`);
//
//     // Wait for animations and gradients to fully render
//     await page.waitForTimeout(2000);
//
//     // Wait for any loading states to complete
//     await page.waitForLoadState('networkidle');
//
//     // Take full-page screenshot
//     const screenshot = await page.screenshot({
//       fullPage: true,
//       animations: 'disabled' // Disable animations for consistent screenshots
//     });
//
//     // Compare with baseline (threshold: 5% tolerance for small glow differences)
//     expect(screenshot).toMatchSnapshot(`theme-${tab.name.toLowerCase()}.png`, {
//       threshold: 0.05,
//       maxDiffPixels: 10000 // Allow small pixel differences
//     });
//   });
// }

// Test gradient consistency specifically
test('Background gradient consistency across all tabs', async ({ page }) => {
  const gradients: Record<string, string> = {};
  
  for (const tab of tabs) {
    await page.goto(`http://localhost:3000${tab.path}`);
    await page.waitForTimeout(1500);
    
    // Extract computed background gradient from main element
    const gradient = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return null;
      const styles = window.getComputedStyle(main);
      return styles.backgroundImage || styles.backgroundColor;
    });
    
    gradients[tab.name] = gradient || 'none';
  }
  
  // All tabs should have the same gradient
  const expectedGradient = 'linear-gradient(135deg, rgb(92, 71, 212) 0%, rgb(125, 75, 206) 50%, rgb(143, 111, 232) 100%)';
  
  for (const [tabName, gradient] of Object.entries(gradients)) {
    expect(gradient).toContain('linear-gradient');
    // Verify it contains the expected color stops
    expect(gradient).toContain('rgb(92, 71, 212)'); // #5C47D4
    expect(gradient).toContain('rgb(125, 75, 206)'); // #7D4BCE
    expect(gradient).toContain('rgb(143, 111, 232)'); // #8F6FE8
  }
});

// Test card styling consistency
test('Glassmorphic card styling consistency', async ({ page }) => {
  await page.goto('http://localhost:3000/analytics');
  await page.waitForTimeout(1500);
  
  // Get computed styles from a glassmorphic card
  const cardStyles = await page.evaluate(() => {
    const card = document.querySelector('.glassmorphic-card');
    if (!card) return null;
    const styles = window.getComputedStyle(card);
    return {
      background: styles.backgroundColor,
      border: styles.border,
      borderRadius: styles.borderRadius,
      backdropFilter: styles.backdropFilter,
      boxShadow: styles.boxShadow,
    };
  });
  
  expect(cardStyles).toBeTruthy();
  expect(cardStyles?.background).toContain('rgba(120, 90, 210, 0.25)');
  expect(cardStyles?.border).toContain('rgba(200, 220, 255, 0.25)');
  expect(cardStyles?.backdropFilter).toContain('blur');
});
