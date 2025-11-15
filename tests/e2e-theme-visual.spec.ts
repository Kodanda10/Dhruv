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

  test('All tabs use dedicated glass styles for liquid glass cards', async ({ page }) => {
    for (const tab of tabs) {
      await page.goto(`http://localhost:3000${tab.path}`);
      await page.waitForTimeout(1000);

      const styles = await page.evaluate(() => {
        const el = document.querySelector('.glass-section-card');
        if (!el) return null;
        const computed = window.getComputedStyle(el);
        return {
          background: computed.background,
          backgroundImage: computed.backgroundImage,
          border: computed.border,
          boxShadow: computed.boxShadow,
        };
      });

      expect(styles).toBeTruthy();
      expect(styles?.backgroundImage || styles?.background).toMatch(/linear-gradient/i);
      expect(styles?.boxShadow).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.25\)/);
      expect(styles?.border).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.2\)/);
    }
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
        const cards = document.querySelectorAll('.glass-section-card');
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

  // ===== GLASS MIGRATION SPECIFIC TESTS =====

  test.describe('Glass Migration Compliance', () => {
    test('All tabs have glass-section-card elements', async ({ page }) => {
      for (const tab of tabs) {
        await page.goto(`http://localhost:3000${tab.path}`);
        await page.waitForTimeout(1000);

        const glassCardsCount = await page.locator('.glass-section-card').count();
        expect(glassCardsCount).toBeGreaterThan(0);

        console.log(`${tab.name}: ${glassCardsCount} glass-section-card elements`);
      }
    });

    test('No legacy glassmorphic-card classes exist', async ({ page }) => {
      for (const tab of tabs) {
        await page.goto(`http://localhost:3000${tab.path}`);
        await page.waitForTimeout(1000);

        const legacyCardsCount = await page.locator('.glassmorphic-card').count();
        expect(legacyCardsCount).toBe(0);

        // Also check for any element containing the class name as text
        const hasLegacyClass = await page.evaluate(() => {
          const allElements = document.querySelectorAll('*');
          for (const el of allElements) {
            if (el.className && typeof el.className === 'string' && el.className.includes('glassmorphic-card')) {
              return true;
            }
          }
          return false;
        });

        expect(hasLegacyClass).toBe(false);
      }
    });

    test('Glass-section-card contract validation', async ({ page }) => {
      await page.goto('http://localhost:3000/home');
      await page.waitForTimeout(1000);

      const glassCardStyles = await page.evaluate(() => {
        const cards = document.querySelectorAll('.glass-section-card');
        const styles: any[] = [];

        cards.forEach((card) => {
          const computed = window.getComputedStyle(card);
          styles.push({
            backdropFilter: computed.backdropFilter,
            backgroundColor: computed.backgroundColor,
            backgroundImage: computed.backgroundImage,
            border: computed.border,
            borderRadius: computed.borderRadius,
            boxShadow: computed.boxShadow,
            color: computed.color,
          });
        });

        return styles;
      });

      expect(glassCardStyles.length).toBeGreaterThan(0);

      glassCardStyles.forEach((style) => {
        // Backdrop blur present
        expect(style.backdropFilter).toMatch(/blur\(24px\)/);

        // Semi-transparent white background
        expect(style.backgroundColor).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.1\)/);

        // Gradient overlay
        expect(style.backgroundImage).toMatch(/linear-gradient/);

        // White border
        expect(style.border).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.2\)/);

        // Rounded corners
        expect(style.borderRadius).toBe('1.5rem');

        // Box shadow
        expect(style.boxShadow).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.25\)/);

        // White text
        expect(style.color).toBe('rgb(255, 255, 255)');
      });
    });

    test('Hover effects work on glass-section-card', async ({ page }) => {
      await page.goto('http://localhost:3000/home');
      await page.waitForTimeout(1000);

      const firstGlassCard = await page.locator('.glass-section-card').first();

      // Get initial styles
      const initialShadow = await firstGlassCard.evaluate((el) => {
        return window.getComputedStyle(el).boxShadow;
      });

      // Hover over the card
      await firstGlassCard.hover();
      await page.waitForTimeout(100); // Allow transition

      // Get hover styles
      const hoverShadow = await firstGlassCard.evaluate((el) => {
        return window.getComputedStyle(el).boxShadow;
      });

      // Shadow should be enhanced on hover
      expect(hoverShadow).not.toBe(initialShadow);
      expect(hoverShadow).toMatch(/0 12px 40px/); // Enhanced shadow
    });

    test('Text readability on glass backgrounds', async ({ page }) => {
      await page.goto('http://localhost:3000/home');
      await page.waitForTimeout(1000);

      const textContrast = await page.evaluate(() => {
        const glassCards = document.querySelectorAll('.glass-section-card');
        const results: any[] = [];

        glassCards.forEach((card) => {
          const textElements = card.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, div');
          textElements.forEach((textEl) => {
            const computed = window.getComputedStyle(textEl);
            results.push({
              text: textEl.textContent?.slice(0, 50),
              color: computed.color,
              backgroundColor: computed.backgroundColor,
              fontSize: computed.fontSize,
            });
          });
        });

        return results;
      });

      textContrast.forEach((result) => {
        // Text should be white
        expect(result.color).toBe('rgb(255, 255, 255)');
        // Should have readable font size
        expect(parseFloat(result.fontSize)).toBeGreaterThan(12);
      });
    });
  });

  test.describe('Responsive Glass Layout', () => {
    const viewports = [
      { name: 'mobile', width: 375, height: 812 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1440, height: 900 }
    ];

    viewports.forEach(viewport => {
      test(`${viewport.name} responsive glass layout`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('http://localhost:3000/home');
        await page.waitForTimeout(1000);

        // All glass cards should be visible (not clipped)
        const glassCards = await page.locator('.glass-section-card');
        const cardCount = await glassCards.count();

        for (let i = 0; i < cardCount; i++) {
          const card = glassCards.nth(i);
          const boundingBox = await card.boundingBox();

          expect(boundingBox).toBeTruthy();
          expect(boundingBox!.x).toBeGreaterThanOrEqual(0);
          expect(boundingBox!.y).toBeGreaterThanOrEqual(0);
          expect(boundingBox!.width).toBeGreaterThan(100); // Minimum readable width
          expect(boundingBox!.height).toBeGreaterThan(50);  // Minimum readable height
        }

        // No horizontal scroll should be introduced
        const scrollWidth = await page.evaluate(() => {
          return document.documentElement.scrollWidth;
        });
        const clientWidth = await page.evaluate(() => {
          return document.documentElement.clientWidth;
        });

        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10); // Allow small tolerance
      });
    });
  });

  test.describe('Performance Impact Assessment', () => {
    test('No excessive paint or layout thrashing', async ({ page }) => {
      await page.goto('http://localhost:3000/home');
      await page.waitForTimeout(1000);

      // Start performance monitoring
      const client = await page.context().newCDPSession(page);
      await client.send('Performance.enable');

      // Perform interactions that might cause layout thrashing
      const glassCards = await page.locator('.glass-section-card');
      const cardCount = await glassCards.count();

      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        await glassCards.nth(i).hover();
        await page.waitForTimeout(50);
      }

      // Get performance metrics
      const metrics = await client.send('Performance.getMetrics');

      const layoutDuration = metrics.metrics.find((m: any) => m.name === 'LayoutDuration')?.value || 0;
      const paintDuration = metrics.metrics.find((m: any) => m.name === 'PaintDuration')?.value || 0;

      // Should not have excessive layout/paint times
      expect(layoutDuration).toBeLessThan(100); // ms
      expect(paintDuration).toBeLessThan(50);   // ms

      await client.send('Performance.disable');
    });
  });
});
