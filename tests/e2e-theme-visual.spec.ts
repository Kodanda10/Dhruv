/**
 * End-to-End Visual Theme Consistency Test
 * 
 * Tests that all dashboard tabs render with identical theme colors
 * by comparing computed styles and taking screenshots.
 */

import { test, expect } from '@playwright/test';

const tabs = [
  { path: '/home', name: 'Home' },
  { path: '/review', name: 'Review' },
  { path: '/commandview', name: 'CommandView' },
  { path: '/analytics', name: 'Analytics' },
];

test.describe('End-to-End Theme Consistency', () => {
  test('All tabs use unified purple-lavender gradient background', async ({ page }) => {
    const backgrounds: Record<string, string> = {};

    for (const tab of tabs) {
      await page.goto(`http://localhost:3000${tab.path}`);
      await page.waitForTimeout(1500); // Wait for gradients to render

      const bg = await page.evaluate(() => {
        const body = document.body;
        const styles = window.getComputedStyle(body);
        return styles.background || styles.backgroundColor || styles.backgroundImage;
      });

      backgrounds[tab.name] = bg;

      // Verify gradient contains unified colors
      expect(bg).toMatch(/#5C47D4|#7D4BCE|#8F6FE8/);
      expect(bg).not.toMatch(/#8B1A8B|#5D3FD3|#FF00|#E500/); // No magenta/red
    }

    // All backgrounds should be similar (same gradient)
    const uniqueBackgrounds = new Set(Object.values(backgrounds));
    console.log('Backgrounds:', backgrounds);
    expect(uniqueBackgrounds.size).toBeLessThanOrEqual(2); // Allow minor variations
  });

  test('All tabs use unified glassmorphic card styling', async ({ page }) => {
    const cardStyles: Record<string, any> = {};

    for (const tab of tabs) {
      await page.goto(`http://localhost:3000${tab.path}`);
      await page.waitForTimeout(1000);

      const style = await page.evaluate(() => {
        const card = document.querySelector('.glassmorphic-card');
        if (!card) return null;
        const styles = window.getComputedStyle(card);
        return {
          background: styles.background,
          border: styles.border,
          boxShadow: styles.boxShadow,
        };
      });

      if (style) {
        cardStyles[tab.name] = style;

        // Verify unified theme colors
        expect(style.background).toMatch(/rgba\(120,\s*90,\s*210|rgba\(177,\s*156,\s*217/);
        expect(style.boxShadow).toMatch(/rgba\(180,\s*255,\s*250/);
      }
    }

    console.log('Card styles:', cardStyles);
    expect(Object.keys(cardStyles).length).toBeGreaterThan(0);
  });

  test('Visual regression - all tabs match unified theme', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const tab of tabs) {
      await page.goto(`http://localhost:3000${tab.path}`);
      await page.waitForTimeout(1200);

      // Take screenshot for visual comparison
      await expect(page).toHaveScreenshot(`theme-${tab.name.toLowerCase()}.png`, {
        threshold: 0.1, // 10% tolerance
        fullPage: true,
      });
    }
  });

  test('No inline style overrides break theme consistency', async ({ page }) => {
    for (const tab of tabs) {
      await page.goto(`http://localhost:3000${tab.path}`);
      await page.waitForTimeout(1000);

      // Check for inline shadow overrides that might break theme
      const inlineShadows = await page.evaluate(() => {
        const cards = document.querySelectorAll('.glassmorphic-card');
        const overrides: string[] = [];
        
        cards.forEach((card) => {
          const style = window.getComputedStyle(card);
          const boxShadow = style.boxShadow;
          // Check if shadow uses white instead of teal glow
          if (boxShadow.includes('rgba(255, 255, 255') && !boxShadow.includes('rgba(180, 255, 250')) {
            overrides.push(boxShadow);
          }
        });
        
        return overrides;
      });

      expect(inlineShadows.length).toBe(0);
    }
  });

  test('Active tab styling matches unified theme', async ({ page }) => {
    await page.goto('http://localhost:3000/analytics');
    await page.waitForTimeout(1000);

    const activeTabStyle = await page.evaluate(() => {
      const activeTab = document.querySelector('.tab-glassmorphic.active');
      if (!activeTab) return null;
      const styles = window.getComputedStyle(activeTab);
      return {
        borderColor: styles.borderColor,
        boxShadow: styles.boxShadow,
      };
    });

    if (activeTabStyle) {
      // Should use teal border #8FFAE8
      expect(activeTabStyle.borderColor).toMatch(/rgb\(143,\s*250,\s*232\)|#8FFAE8/i);
    }
  });
});


