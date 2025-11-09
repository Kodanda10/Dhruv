import { test, expect } from '@playwright/test';

test.describe('Labs Search UI', () => {
  test('[UI-8] should load the search page and display search elements', async ({ page }) => {
    // This test is designed to fail initially because the /labs/search page does not exist.
    // It will pass once the page is created and contains the expected elements.
    await page.goto('/labs/search');

    await expect(page).toHaveTitle(/FAISS Search/);
    await expect(page.getByPlaceholder('Enter search query')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
    await expect(page.getByText('Search Results')).toBeVisible();
  });

  test('[UI-9] should perform a search and display results', async ({ page }) => {
    // Mock the API response for /api/labs/faiss/search
    await page.route('**/api/labs/faiss/search*', async route => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q');
      if (query === 'test query') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: '1', name: 'Result 1', score: 0.9 },
            { id: '2', name: 'Result 2', score: 0.8 },
          ]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await page.goto('/labs/search');

    await page.getByPlaceholder('Enter search query').fill('test query');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByText('Loading...')).not.toBeVisible();
    await expect(page.getByText('Result 1')).toBeVisible();
    await expect(page.getByText('Result 2')).toBeVisible();
  });

  test('[UI-9] should display an error message on API failure', async ({ page }) => {
    // Mock the API response for /api/labs/faiss/search to simulate an error
    await page.route('**/api/labs/faiss/search*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/labs/search');

    await page.getByPlaceholder('Enter search query').fill('error query');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByText('Loading...')).not.toBeVisible();
    await expect(page.getByText('Error: Internal Server Error')).toBeVisible();
  });
});
