import { test, expect } from '@playwright/test';

test.describe('Labs V2 Review UI', () => {
  const mockEvent = {
    id: 'evt-789',
    tweetText: 'This is a tweet fetched from the API.',
    parsed: {
      location: 'Raigarh',
      eventType: 'Political Rally',
      people: ['API Person'],
      schemes: ['API Scheme'],
    },
  };

  const mockLocationSuggestions = [
    { id: 'loc1', name: 'Raigarh City', score: 0.95, type: 'city' },
    { id: 'loc2', name: 'Raigarh District', score: 0.88, type: 'district' },
  ];

  const mockEventSuggestions = [
    { id: 'evt-type-1', name: 'Political Rally', score: 0.92 },
    { id: 'evt-type-2', name: 'Protest', score: 0.75 },
  ];

  test('[V2R-4] should load the review page and display all components', async ({ page }) => {
    // Mock all necessary API endpoints
    await page.route('**/api/labs-v2/parsed-events/next', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEvent) });
    });
    await page.route('**/api/labs/locations/resolve*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockLocationSuggestions) });
    });
    await page.route('**/api/labs/event-types/suggest', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEventSuggestions) });
    });
    await page.route('**/api/labs-v2/learning/status', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ isEnabled: true }) });
    });
    await page.route('**/api/labs-v2/learning/toggle', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.goto('/labs-v2/review');

    // Main page content checks
    await expect(page).toHaveTitle(/Labs V2 Review/);
    await expect(page.getByRole('heading', { name: 'Labs V2 Review' })).toBeVisible();

    // Learning Banner checks
    await expect(page.getByText('Dynamic Learning Active')).toBeVisible();
    const learningToggle = page.locator('#learning-toggle');
    await expect(learningToggle).toBeVisible();
    await expect(learningToggle).toBeChecked();

    // Click the toggle's label, not the hidden input
    await page.locator('label[for="learning-toggle"]').click();
    
    await expect(learningToggle).not.toBeChecked();

    // Pinned Summary checks
    const pinnedSummarySection = page.locator('div.sticky.top-4');
    await expect(pinnedSummarySection.getByText('Raigarh')).toBeVisible(); // Check resolved location
    await expect(pinnedSummarySection.getByText('Political Rally')).toBeVisible(); // Check resolved event type
    await expect(pinnedSummarySection.locator('span:has-text("People:") + span')).toHaveText('1'); // Check people count
    await expect(pinnedSummarySection.locator('span:has-text("Schemes:") + span')).toHaveText('1'); // Check schemes count
  });
});