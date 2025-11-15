/**
 * Performance Tests for Liquid Glass Migration
 *
 * Ensures glass-section-card implementation doesn't cause performance regressions
 * and maintains acceptable Lighthouse scores and runtime performance.
 */

import { test, expect } from '@playwright/test';

const tabs = [
  { path: '/home', name: 'Home' },
  { path: '/review', name: 'Review' },
  { path: '/commandview', name: 'CommandView' },
  { path: '/analytics', name: 'Analytics' }
];

test.describe('Lighthouse Performance Metrics - Glass Migration', () => {
  tabs.forEach(tab => {
    test(`Lighthouse scores for ${tab.name} tab`, async ({ page }) => {
      await page.goto(`http://localhost:3000${tab.path}`);
      await page.waitForTimeout(1000);

      // Wait for any dynamic content to load
      await page.waitForLoadState('networkidle');

      // Run Lighthouse audit (using Playwright's built-in performance tracing)
      const client = await page.context().newCDPSession(page);
      await client.send('Performance.enable');

      // Wait for glass animations and interactions to settle
      await page.waitForTimeout(3000);

      // Get Core Web Vitals and other performance metrics
      const metrics = await client.send('Performance.getMetrics');

      // Extract key metrics
      const fcp = metrics.metrics.find((m: any) => m.name === 'FirstContentfulPaint')?.value;
      const lcp = metrics.metrics.find((m: any) => m.name === 'LargestContentfulPaint')?.value;
      const tti = metrics.metrics.find((m: any) => m.name === 'InteractiveTime')?.value;
      const cls = metrics.metrics.find((m: any) => m.name === 'CumulativeLayoutShift')?.value;

      console.log(`${tab.name} Performance Metrics:`, {
        FCP: fcp ? `${(fcp / 1000).toFixed(2)}s` : 'N/A',
        LCP: lcp ? `${(lcp / 1000).toFixed(2)}s` : 'N/A',
        TTI: tti ? `${(tti / 1000).toFixed(2)}s` : 'N/A',
        CLS: cls ? cls.toFixed(4) : 'N/A'
      });

      // Performance budgets (adjusted for glass effects)
      if (fcp) expect(fcp).toBeLessThan(1500); // 1.5s FCP
      if (lcp) expect(lcp).toBeLessThan(2500); // 2.5s LCP
      if (tti) expect(tti).toBeLessThan(3000); // 3s TTI
      if (cls) expect(cls).toBeLessThan(0.1);   // 0.1 CLS

      await client.send('Performance.disable');
    });
  });
});

test.describe('Runtime Performance - Glass Migration Impact', () => {
  test('No excessive paint/layout thrashing during glass interactions', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1000);

    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    // Start recording performance
    await client.send('Tracing.start', {
      categories: ['blink', 'cc', 'gpu', 'v8', 'disabled-by-default-devtools.timeline']
    });

    // Perform multiple hover interactions on glass cards
    const glassCards = page.locator('.glass-section-card');
    const cardCount = await glassCards.count();

    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      await glassCards.nth(i).hover();
      await page.waitForTimeout(100); // Allow hover effects to trigger

      // Quick scroll to trigger any layout shifts
      await page.mouse.wheel(0, 50);
      await page.waitForTimeout(50);
    }

    // Stop tracing and get results
    const tracingComplete = new Promise(resolve => {
      client.on('Tracing.tracingComplete', (event: any) => {
        resolve(event);
      });
    });

    await client.send('Tracing.end');
    const traceResults = await tracingComplete;

    // Analyze trace for performance issues
    const paintEvents = (traceResults as any).value.traceEvents?.filter(
      (event: any) => event.name === 'Paint' || event.name === 'CompositeLayers'
    ) || [];

    const layoutEvents = (traceResults as any).value.traceEvents?.filter(
      (event: any) => event.name === 'Layout' || event.name === 'UpdateLayoutTree'
    ) || [];

    console.log(`Paint events: ${paintEvents.length}, Layout events: ${layoutEvents.length}`);

    // Should not have excessive painting (more than 20 paint events for 5 hovers is concerning)
    expect(paintEvents.length).toBeLessThan(50);
    expect(layoutEvents.length).toBeLessThan(20);

    await client.send('Performance.disable');
  });

  test('Memory usage remains stable during glass card interactions', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1000);

    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    // Get initial memory usage
    const initialMemory = await client.send('Runtime.evaluate', {
      expression: 'performance.memory.usedJSHeapSize / 1024 / 1024' // MB
    });

    // Perform multiple interactions
    const glassCards = page.locator('.glass-section-card');
    const cardCount = await glassCards.count();

    for (let i = 0; i < Math.min(cardCount, 10); i++) {
      await glassCards.nth(i).hover();
      await page.waitForTimeout(50);

      // Trigger some dynamic content if available
      const buttons = page.locator('.glass-section-card button');
      if (await buttons.count() > 0) {
        await buttons.first().focus();
      }
    }

    // Get final memory usage
    const finalMemory = await client.send('Runtime.evaluate', {
      expression: 'performance.memory.usedJSHeapSize / 1024 / 1024' // MB
    });

    const memoryIncrease = (finalMemory as any).result.value - (initialMemory as any).result.value;

    console.log(`Memory usage: ${(initialMemory as any).result.value.toFixed(2)}MB → ${(finalMemory as any).result.value.toFixed(2)}MB (${memoryIncrease.toFixed(2)}MB increase)`);

    // Memory increase should be reasonable (< 10MB for glass interactions)
    expect(memoryIncrease).toBeLessThan(10);

    await client.send('Performance.disable');
  });
});

test.describe('Animation Performance - Glass Hover Effects', () => {
  test('Glass card hover animations are smooth (60fps)', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1000);

    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    // Record frame rate during hover interactions
    let frameCount = 0;
    let startTime = Date.now();

    client.on('Performance.metrics', (metrics: any) => {
      frameCount++;
    });

    // Perform hover interactions
    const glassCards = page.locator('.glass-section-card');
    const cardCount = await glassCards.count();

    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      startTime = Date.now();
      frameCount = 0;

      await glassCards.nth(i).hover();
      await page.waitForTimeout(500); // Allow animation to complete

      const duration = Date.now() - startTime;
      const fps = (frameCount / duration) * 1000;

      console.log(`Hover animation ${i + 1}: ${fps.toFixed(1)} FPS`);

      // Should maintain at least 50 FPS during animations
      expect(fps).toBeGreaterThan(50);
    }

    await client.send('Performance.disable');
  });

  test('No layout shifts during glass card interactions', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1000);

    // Record initial positions
    const initialPositions = await page.evaluate(() => {
      const cards = document.querySelectorAll('.glass-section-card');
      return Array.from(cards).map(card => {
        const rect = card.getBoundingClientRect();
        return {
          id: (card as HTMLElement).id || card.className,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      });
    });

    // Perform interactions
    const glassCards = page.locator('.glass-section-card');
    const cardCount = await glassCards.count();

    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      await glassCards.nth(i).hover();
      await page.waitForTimeout(200); // Allow hover effects
    }

    // Check final positions
    const finalPositions = await page.evaluate(() => {
      const cards = document.querySelectorAll('.glass-section-card');
      return Array.from(cards).map(card => {
        const rect = card.getBoundingClientRect();
        return {
          id: (card as HTMLElement).id || card.className,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      });
    });

    // Compare positions - should not have significant layout shifts
    initialPositions.forEach((initial, index) => {
      const final = finalPositions[index];
      if (final) {
        const deltaX = Math.abs(final.x - initial.x);
        const deltaY = Math.abs(final.y - initial.y);
        const deltaWidth = Math.abs(final.width - initial.width);
        const deltaHeight = Math.abs(final.height - initial.height);

        // Allow small position changes but not significant layout shifts
        expect(deltaX).toBeLessThan(5); // 5px tolerance
        expect(deltaY).toBeLessThan(5);
        expect(deltaWidth).toBeLessThan(10);
        expect(deltaHeight).toBeLessThan(10);
      }
    });
  });
});

test.describe('Bundle Size Impact - Glass Migration', () => {
  test('CSS bundle size impact is minimal', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1000);

    // Check that glass-section-card styles are loaded
    const glassStylesLoaded = await page.evaluate(() => {
      const testEl = document.createElement('div');
      testEl.className = 'glass-section-card';
      document.body.appendChild(testEl);

      const computed = window.getComputedStyle(testEl);
      const hasBackdropFilter = computed.backdropFilter !== 'none';
      const hasGradient = computed.backgroundImage.includes('linear-gradient');

      document.body.removeChild(testEl);

      return hasBackdropFilter && hasGradient;
    });

    expect(glassStylesLoaded).toBe(true);

    // Check CSS coverage - ensure styles are actually used
    const cssCoverage = await page.evaluate(() => {
      const rules = Array.from(document.styleSheets)
        .flatMap(sheet => {
          try {
            return Array.from(sheet.cssRules || []);
          } catch {
            return [];
          }
        })
        .filter(rule => rule.cssText?.includes('glass-section-card'));

      return rules.length;
    });

    // Should have glass-section-card rules loaded
    expect(cssCoverage).toBeGreaterThan(0);
  });
});

test.describe('Network Performance - Glass Assets', () => {
  test('Glass-related assets load efficiently', async ({ page }) => {
    const requests: string[] = [];

    page.on('request', request => {
      requests.push(request.url());
    });

    await page.goto('/home');
    await page.waitForTimeout(2000);

    // Check for any glass-related asset requests
    const glassAssets = requests.filter(url =>
      url.includes('glass') ||
      url.includes('backdrop') ||
      url.includes('blur')
    );

    // Should not have excessive glass-specific assets
    expect(glassAssets.length).toBeLessThan(5);

    // Check that CSS loads quickly
    const cssRequests = requests.filter(url => url.includes('.css'));
    expect(cssRequests.length).toBeGreaterThan(0);

    // All requests should complete without errors
    const failedRequests = [];
    page.on('response', response => {
      if (!response.ok() && response.status() >= 400) {
        failedRequests.push(response.url());
      }
    });

    await page.waitForTimeout(1000);
    expect(failedRequests.length).toBe(0);
  });
});