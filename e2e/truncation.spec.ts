import { test, expect } from '@playwright/test';

test('विवरण column shows full text with wrapping and title mirrors content', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const cell = page.locator('td[aria-label="विवरण"]').first();
  const text = await cell.textContent();
  const title = await cell.getAttribute('title');
  // Full text should be visible (no truncation by length constraint now)
  expect((text?.length || 0)).toBeGreaterThan(80);
  // Title mirrors the full text for accessibility tooltip
  expect(title).toBe(text);
});
