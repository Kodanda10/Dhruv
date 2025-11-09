/**
 * Accessibility Tests using axe-core
 * 
 * Ensures WCAG 2.1 AA compliance across all dashboard pages.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { path: '/home', name: 'Home' },
  { path: '/review', name: 'Review' },
  { path: '/commandview', name: 'CommandView' },
  { path: '/analytics', name: 'Analytics' },
];

for (const page of pages) {
  test(`Accessibility audit for ${page.name}`, async ({ page: p }) => {
    await p.goto(`http://localhost:3000${page.path}`);
    await p.waitForTimeout(1500);
    
    const accessibilityScanResults = await new AxeBuilder({ page: p })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    // Expect zero violations
    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Log violations if any (for debugging)
    if (accessibilityScanResults.violations.length > 0) {
      console.error(`Accessibility violations on ${page.name}:`, 
        JSON.stringify(accessibilityScanResults.violations, null, 2));
    }
  });
  
  test(`Color contrast compliance for ${page.name}`, async ({ page: p }) => {
    await p.goto(`http://localhost:3000${page.path}`);
    await p.waitForTimeout(1500);
    
    const accessibilityScanResults = await new AxeBuilder({ page: p })
      .withTags(['wcag2aa'])
      .analyze();
    
    // Filter for color contrast violations
    const contrastViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'color-contrast'
    );
    
    // WCAG 2.1 AA requires contrast ratio ≥ 4.5:1
    expect(contrastViolations).toEqual([]);
  });
  
  test(`Keyboard navigation for ${page.name}`, async ({ page: p }) => {
    await p.goto(`http://localhost:3000${page.path}`);
    await p.waitForTimeout(1500);
    
    const accessibilityScanResults = await new AxeBuilder({ page: p })
      .withTags(['keyboard'])
      .analyze();
    
    // No keyboard navigation failures
    const keyboardViolations = accessibilityScanResults.violations.filter(
      v => v.id.includes('keyboard') || v.id.includes('focus')
    );
    
    expect(keyboardViolations).toEqual([]);
  });
  
  test(`Screen reader support for ${page.name}`, async ({ page: p }) => {
    await p.goto(`http://localhost:3000${page.path}`);
    await p.waitForTimeout(1500);
    
    const accessibilityScanResults = await new AxeBuilder({ page: p })
      .withTags(['best-practice'])
      .analyze();
    
    // Check for aria-label and role definitions
    const ariaViolations = accessibilityScanResults.violations.filter(
      v => v.id.includes('aria') || v.id.includes('role')
    );
    
    expect(ariaViolations).toEqual([]);
  });
}
