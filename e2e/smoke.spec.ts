import { test, expect } from '@playwright/test';

test('homepage shows table and content', async ({ page }) => {
  await page.goto('http://localhost:3000');
  // Check for main heading
  await expect(page.getByRole('heading', { name: /सोशल मीडिया एनालिटिक्स/ })).toBeVisible();
  // Check for table with tweets data
  await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
  // Check that page has loaded content
  const table = page.getByRole('table').first();
  await expect(table).toBeVisible();
});

