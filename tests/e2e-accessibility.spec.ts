/**
 * Accessibility Tests for Liquid Glass Migration
 *
 * Ensures glass-section-card implementation maintains WCAG 2.1 AA compliance
 * with proper contrast, keyboard navigation, and screen reader support.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tabs = [
  { path: '/home', name: 'Home' },
  { path: '/review', name: 'Review' },
  { path: '/commandview', name: 'CommandView' },
  { path: '/analytics', name: 'Analytics' }
];

test.describe('Accessibility Compliance - Glass Migration', () => {
  tabs.forEach(tab => {
    test(`Axe accessibility check for ${tab.name} tab`, async ({ page }) => {
      await page.goto(`http://localhost:3000${tab.path}`);
      await page.waitForTimeout(1000);

      // Run axe accessibility scan
      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

      // Should have no violations
      expect(accessibilityScanResults.violations).toEqual([]);

      // Specifically check for contrast issues that might arise with glass backgrounds
      const contrastViolations = accessibilityScanResults.violations.filter(
        v => v.id === 'color-contrast'
      );
      expect(contrastViolations).toHaveLength(0);
    });
  });

  test('Text contrast on glass-section-card backgrounds', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1000);

    const contrastResults = await page.evaluate(() => {
      const glassCards = document.querySelectorAll('.glass-section-card');
      const results: any[] = [];

      glassCards.forEach((card) => {
        const textElements = card.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, button, a');

        textElements.forEach((textEl) => {
          const computed = window.getComputedStyle(textEl);
          const textColor = computed.color;
          const backgroundColor = computed.backgroundColor;
          const fontSize = parseFloat(computed.fontSize);
          const fontWeight = computed.fontWeight;

          results.push({
            element: textEl.tagName.toLowerCase(),
            text: textEl.textContent?.slice(0, 30),
            textColor,
            backgroundColor,
            fontSize,
            fontWeight,
            isBold: fontWeight === 'bold' || parseInt(fontWeight) >= 700
          });
        });
      });

      return results;
    });

    contrastResults.forEach((result) => {
      // Text should be white (#FFFFFF) for sufficient contrast on glass
      expect(result.textColor).toBe('rgb(255, 255, 255)');

      // Font size should be readable (minimum 14px for normal weight, 12px for bold)
      const minFontSize = result.isBold ? 12 : 14;
      expect(result.fontSize).toBeGreaterThanOrEqual(minFontSize);
    });
  });
});

test.describe('Keyboard Navigation - Glass Migration', () => {
  test('Home tab keyboard navigation', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1000);

    // Start tab navigation
    await page.keyboard.press('Tab');

    // Check first focusable element is within glass container
    const firstFocused = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tagName: active?.tagName.toLowerCase(),
        className: active?.className,
        withinGlass: active?.closest('.glass-section-card') !== null
      };
    });

    // First focusable element should be accessible
    expect(firstFocused.withinGlass || firstFocused.tagName === 'body').toBe(true);

    // Continue tab navigation through several elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50); // Allow focus to settle

      const currentFocused = await page.evaluate(() => {
        const active = document.activeElement;
        return {
          visible: active?.offsetWidth > 0 && active?.offsetHeight > 0,
          withinGlass: active?.closest('.glass-section-card') !== null,
          focusVisible: window.getComputedStyle(active!).outline !== 'none' ||
                      active?.classList.contains('focus-visible') ||
                      active?.matches(':focus-visible')
        };
      });

      // Focused element should be visible and have focus indicators
      expect(currentFocused.visible).toBe(true);
      expect(currentFocused.focusVisible).toBe(true);
    }
  });

  test('Review tab keyboard navigation with glass cards', async ({ page }) => {
    // Mock some review items
    await page.route('/api/parsed-events*', route => route.fulfill({
      status: 200,
      json: [
        {
          id: 1,
          content: 'Review item 1',
          parsed: { where: ['test'], what: ['test'], confidence: 0.9 },
          needs_review: true,
          review_status: 'pending'
        }
      ]
    }));

    await page.goto('/review');
    await page.waitForTimeout(1000);

    // Tab to first interactive element in review queue
    await page.keyboard.press('Tab');

    const focusedElement = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        tagName: active?.tagName.toLowerCase(),
        withinGlass: active?.closest('.glass-section-card') !== null,
        isButton: active?.tagName.toLowerCase() === 'button',
        hasAriaLabel: active?.hasAttribute('aria-label')
      };
    });

    // Should focus interactive elements within glass cards
    expect(focusedElement.withinGlass || focusedElement.tagName === 'body').toBe(true);

    // If it's a button, it should be properly labeled
    if (focusedElement.isButton) {
      expect(focusedElement.hasAriaLabel).toBe(true);
    }
  });

  test('CommandView keyboard navigation', async ({ page }) => {
    await page.goto('/commandview');
    await page.waitForTimeout(1000);

    // Test tab navigation through controls
    const tabSequence = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);

      const focused = await page.evaluate(() => {
        const active = document.activeElement;
        return {
          tagName: active?.tagName.toLowerCase(),
          withinGlass: active?.closest('.glass-section-card') !== null,
          isInteractive: ['button', 'input', 'select', 'a'].includes(active?.tagName.toLowerCase() || ''),
          visible: active?.offsetWidth > 0 && active?.offsetHeight > 0
        };
      });

      tabSequence.push(focused);

      if (i > 0 && focused.tagName === 'body') break; // Wrapped around
    }

    // Should find interactive elements within glass cards
    const glassInteractive = tabSequence.filter(item => item.withinGlass && item.isInteractive);
    expect(glassInteractive.length).toBeGreaterThan(0);

    // All focused elements should be visible
    tabSequence.forEach(item => {
      if (item.tagName !== 'body') {
        expect(item.visible).toBe(true);
      }
    });
  });

  test('Modal focus trapping within glass containers', async ({ page }) => {
    await page.goto('/commandview');
    await page.waitForTimeout(1000);

    // Try to open a modal or dialog (if available)
    const modalTriggers = page.locator('button').filter({ hasText: /Trace|Modal|Open/i });
    if (await modalTriggers.count() > 0) {
      await modalTriggers.first().click();
      await page.waitForTimeout(500);

      // Check if modal is open
      const modal = page.locator('[role="dialog"], .modal, .glass-section-card').filter({ hasText: /Trace|Details/i });
      if (await modal.isVisible()) {
        // Tab should stay within modal
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(50);
        }

        // Focus should still be within modal
        const focusInModal = await page.evaluate(() => {
          const active = document.activeElement;
          const modalEl = document.querySelector('[role="dialog"], .modal');
          return modalEl?.contains(active) || false;
        });

        expect(focusInModal).toBe(true);

        // Escape should close modal
        await page.keyboard.press('Escape');
        await expect(modal).not.toBeVisible();
      }
    }
  });

  test('Focus indicators visible on glass backgrounds', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1000);

    // Find focusable elements within glass cards
    const focusableElements = await page.locator('.glass-section-card button, .glass-section-card input, .glass-section-card a').all();

    if (focusableElements.length > 0) {
      // Focus first element
      await focusableElements[0].focus();

      // Check focus styling
      const focusStyles = await focusableElements[0].evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          outline: computed.outline,
          outlineColor: computed.outlineColor,
          boxShadow: computed.boxShadow,
          hasFocusClass: el.classList.contains('focus-visible') ||
                        el.matches(':focus-visible') ||
                        computed.outline !== 'none'
        };
      });

      // Should have visible focus indicator
      expect(focusStyles.hasFocusClass ||
             focusStyles.outline !== 'none' ||
             focusStyles.boxShadow.includes('rgb')).toBe(true);
    }
  });
});

test.describe('Screen Reader Support - Glass Migration', () => {
  test('Glass cards have proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1000);

    const ariaCheck = await page.evaluate(() => {
      const glassCards = document.querySelectorAll('.glass-section-card');
      const results: any[] = [];

      glassCards.forEach((card, index) => {
        const textContent = card.textContent?.trim();
        const hasAriaLabel = card.hasAttribute('aria-label');
        const hasAriaDescribedBy = card.hasAttribute('aria-describedby');
        const hasRole = card.hasAttribute('role');
        const heading = card.querySelector('h1, h2, h3, h4, h5, h6');
        const buttons = card.querySelectorAll('button');

        results.push({
          index,
          hasText: textContent && textContent.length > 0,
          hasAriaLabel,
          hasAriaDescribedBy,
          hasRole,
          hasHeading: !!heading,
          buttonCount: buttons.length,
          buttonsHaveLabels: Array.from(buttons).every(btn =>
            btn.hasAttribute('aria-label') ||
            btn.textContent?.trim() ||
            btn.hasAttribute('title')
          )
        });
      });

      return results;
    });

    ariaCheck.forEach((card) => {
      // Cards with interactive content should be properly labeled
      if (card.buttonCount > 0) {
        expect(card.buttonsHaveLabels).toBe(true);
      }

      // Cards should have meaningful content for screen readers
      expect(card.hasText || card.hasHeading || card.hasAriaLabel).toBe(true);
    });
  });

  test('Form elements within glass cards are properly labeled', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForTimeout(1000);

    const formCheck = await page.evaluate(() => {
      const glassCards = document.querySelectorAll('.glass-section-card');
      const results: any[] = [];

      glassCards.forEach((card) => {
        const inputs = card.querySelectorAll('input, select, textarea');
        const labels = card.querySelectorAll('label');

        inputs.forEach((input) => {
          const inputEl = input as HTMLInputElement;
          const hasLabel = inputEl.hasAttribute('aria-label') ||
                          inputEl.hasAttribute('aria-labelledby') ||
                          inputEl.id && document.querySelector(`label[for="${inputEl.id}"]`);
          const hasPlaceholder = inputEl.hasAttribute('placeholder');

          results.push({
            type: inputEl.type || inputEl.tagName.toLowerCase(),
            hasLabel,
            hasPlaceholder,
            placeholder: inputEl.placeholder,
            ariaLabel: inputEl.getAttribute('aria-label')
          });
        });
      });

      return results;
    });

    formCheck.forEach((input) => {
      // Form inputs should have labels or placeholders
      expect(input.hasLabel || input.hasPlaceholder).toBe(true);
    });
  });
});

test.describe('Color and Contrast - Glass Migration Impact', () => {
  test('No color contrast violations on glass backgrounds', async ({ page }) => {
    await page.goto('/home');
    await page.waitForTimeout(1000);

    // Use axe to check specifically for contrast issues
    const axeResults = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    // Should have no color contrast violations
    const contrastViolations = axeResults.violations.filter(v => v.id === 'color-contrast');
    expect(contrastViolations).toHaveLength(0);

    // Also manually check some text elements
    const textContrast = await page.evaluate(() => {
      const textElements = document.querySelectorAll('.glass-section-card p, .glass-section-card span, .glass-section-card h1, .glass-section-card h2, .glass-section-card h3');
      const results: any[] = [];

      textElements.forEach((el) => {
        const computed = window.getComputedStyle(el);
        const textColor = computed.color;
        const backgroundColor = computed.backgroundColor;
        const fontSize = parseFloat(computed.fontSize);

        results.push({
          textColor,
          backgroundColor,
          fontSize,
          contrastRatio: getContrastRatio(textColor, backgroundColor)
        });
      });

      // Simple contrast calculation (simplified)
      function getContrastRatio(color1: string, color2: string): number {
        // White text (#FFFFFF) on semi-transparent backgrounds should have good contrast
        // This is a simplified check - in practice, use proper color libraries
        return color1 === 'rgb(255, 255, 255)' ? 21 : 1; // Max contrast for white on dark
      }

      return results;
    });

    textContrast.forEach((result) => {
      // Should meet WCAG AA contrast requirements (4.5:1 for normal text)
      expect(result.contrastRatio).toBeGreaterThanOrEqual(4.5);
    });
  });

  test('Color is not solely used to convey information', async ({ page }) => {
    await page.goto('/review');
    await page.waitForTimeout(1000);

    // Check that status indicators have text labels in addition to colors
    const statusElements = await page.locator('.glass-section-card').filter({ hasText: /pending|approved|rejected/i }).all();

    for (const element of statusElements) {
      const hasText = await element.textContent();
      const hasAriaLabel = await element.getAttribute('aria-label');

      // Should have text or aria-label in addition to color
      expect(hasText?.trim() || hasAriaLabel).toBeTruthy();
    }
  });
});