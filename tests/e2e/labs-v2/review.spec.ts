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
    { id: 'loc1', name_english: 'Raigarh City', score: 0.95, type: 'city' },
    { id: 'loc2', name_english: 'Raigarh District', score: 0.88, type: 'district' },
  ];

  const mockEventSuggestions = [
    { id: 'evt-type-1', name_english: 'Political Rally', score: 0.92 },
    { id: 'evt-type-2', name_english: 'Protest', score: 0.75 },
  ];

  test('[V2R-4] should load the review page and display all components', async ({ page }) => {
    // Mock all necessary API endpoints
    await page.route('**/api/labs-v2/parsed-events/next', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEvent) });
    });
    await page.route('**/api/labs/locations/resolve*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockLocationSuggestions) });
    });
    await page.route('**/api/labs/locations/confirm', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, logId: 1 }) });
    });
    await page.route('**/api/labs/event-types/suggest', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEventSuggestions) });
    });
    await page.route('**/api/labs/event-types/confirm', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, logId: 1 }) });
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

    // Location Resolver checks
    await expect(page.getByRole('heading', { name: 'Location Resolver' })).toBeVisible();
    await expect(page.getByText('Raigarh City (Score: 0.95)')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Location' }).click(); // Confirm default selection

    // Event Resolver checks
    await expect(page.getByRole('heading', { name: 'Event Resolver' })).toBeVisible();
    await expect(page.getByText('Political Rally (Score: 0.92)')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Event' }).click(); // Confirm default selection

    // People Resolver checks
    await expect(page.getByRole('heading', { name: 'People Resolver' })).toBeVisible();
    await expect(page.locator('div:has(> h3:has-text("People Resolver"))').getByText('API Person')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm People' }).click();

    // Scheme Resolver checks
    await expect(page.getByRole('heading', { name: 'Scheme Resolver' })).toBeVisible();
    await expect(page.locator('div:has(> h3:has-text("Scheme Resolver"))').getByText('API Scheme')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Schemes' }).click();
  });

  test('[V2R-5] Location Resolver manual entry and confirmation', async ({ page }) => {
    // Mock all necessary API endpoints
    await page.route('**/api/labs-v2/parsed-events/next', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEvent) });
    });
    await page.route('**/api/labs/locations/resolve*', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockLocationSuggestions) });
    });
    await page.route('**/api/labs/locations/confirm', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, logId: 1 }) });
    });
    await page.route('**/api/labs-v2/learning/status', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ isEnabled: true }) });
    });

    await page.goto('/labs-v2/review');

    // Switch to manual entry for Location Resolver
    await page.getByRole('heading', { name: 'Location Resolver' }).locator('..').getByRole('button', { name: 'Manual Entry' }).click();
    const manualLocationInput = page.getByRole('heading', { name: 'Location Resolver' }).locator('..').getByPlaceholder('Enter location manually');
    await expect(manualLocationInput).toBeVisible();
    await manualLocationInput.fill('New Manual Location');

    // Confirm manual entry
    await page.getByRole('heading', { name: 'Location Resolver' }).locator('..').getByRole('button', { name: 'Confirm Location' }).click();
    // Verify that the Pinned Summary updates with the manual entry
    const pinnedSummarySection = page.locator('div.sticky.top-4');
    await expect(pinnedSummarySection.getByText('New Manual Location')).toBeVisible();
  });

  test('[V2R-6] Event Resolver manual entry and confirmation', async ({ page }) => {
    // Mock all necessary API endpoints
    await page.route('**/api/labs-v2/parsed-events/next', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEvent) });
    });
    await page.route('**/api/labs/event-types/suggest', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockEventSuggestions) });
    });
    await page.route('**/api/labs/event-types/confirm', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, logId: 1 }) });
    });
    await page.route('**/api/labs-v2/learning/status', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ isEnabled: true }) });
    });

    await page.goto('/labs-v2/review');

    // Switch to manual entry for Event Resolver
    await page.getByRole('heading', { name: 'Event Resolver' }).locator('..').getByRole('button', { name: 'Manual Entry' }).click();
    const manualEventInput = page.getByRole('heading', { name: 'Event Resolver' }).locator('..').getByPlaceholder('Enter event type manually');
    await expect(manualEventInput).toBeVisible();
    await manualEventInput.fill('New Manual Event Type');

    // Confirm manual entry
    await page.getByRole('heading', { name: 'Event Resolver' }).locator('..').getByRole('button', { name: 'Confirm Event' }).click();
    // Verify that the Pinned Summary updates with the manual entry
    const pinnedSummarySection = page.locator('div.sticky.top-4');
    await expect(pinnedSummarySection.getByText('New Manual Event Type')).toBeVisible();
  });
});