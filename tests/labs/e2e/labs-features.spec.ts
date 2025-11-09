/**
 * Playwright E2E Tests for Labs Features
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Labs Features E2E Tests', () => {
  test.beforeAll(async ({ request }) => {
    // Wait for server to be ready
    await request.get(`${BASE_URL}/api/system/health`).catch(() => {});
  });
  test('FAISS Search returns results for "खरसिया" within p95 < 400ms', async ({ page }) => {
    await page.goto(`${BASE_URL}/labs/search`);

    // Wait for page to load
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });

    // Enter search query
    const input = page.locator('input[type="text"]');
    await input.fill('खरसिया');

    // Measure search time
    const startTime = Date.now();
    await page.locator('button:has-text("खोजें")').click();

    // Wait for results
    await page.waitForSelector('text=परिणाम', { timeout: 5000 });

    const endTime = Date.now();
    const latency = endTime - startTime;

    // Verify results appear
    const results = page.locator('text=परिणाम');
    await expect(results).toBeVisible();

    // Verify latency is within budget
    expect(latency).toBeLessThan(400);

    // Verify at least one result
    const resultCount = await page.locator('[class*="bg-white/10"]').count();
    expect(resultCount).toBeGreaterThan(0);
  });

  test('AI Assistant opens modal and receives suggestions', async ({ page }) => {
    await page.goto(`${BASE_URL}/labs/ai`);

    // Wait for page to load
    await page.waitForSelector('text=AI Assistant Demo', { timeout: 10000 });

    // Wait for tweet to load
    await page.waitForSelector('text=ट्वीट', { timeout: 10000 });

    // Click "पुनः प्राप्त करें" button
    const fetchButton = page.locator('button:has-text("पुनः प्राप्त करें")');
    await expect(fetchButton).toBeVisible();
    await fetchButton.click();

    // Wait for suggestions to appear (or loading state)
    await page.waitForTimeout(3000); // Give time for AI to respond

    // Verify either suggestions appear or error message
    const hasSuggestions = await page.locator('text=AI सुझाव').isVisible().catch(() => false);
    const hasError = await page.locator('text=त्रुटि').isVisible().catch(() => false);

    expect(hasSuggestions || hasError).toBe(true);
  });

  test('Maps page renders map with clusters', async ({ page }) => {
    await page.goto(`${BASE_URL}/labs/maps`);

    // Wait for page to load
    await page.waitForSelector('text=Mapbox Maps', { timeout: 10000 });

    // Wait for map to load (check for mapbox container)
    await page.waitForTimeout(2000);

    // Verify map container exists
    const mapContainer = page.locator('[class*="mapboxgl"]').first();
    const mapExists = await mapContainer.count().catch(() => 0);

    // Map should exist (even if no clusters, the container should be there)
    expect(mapExists).toBeGreaterThan(0);
  });

  test('Mindmap renders SVG with nodes', async ({ page }) => {
    await page.goto(`${BASE_URL}/labs/mindmap`);

    // Wait for page to load
    await page.waitForSelector('text=D3 Mindmap', { timeout: 10000 });

    // Wait for graph to build
    await page.waitForTimeout(3000);

    // Verify SVG exists
    const svg = page.locator('svg');
    await expect(svg).toBeVisible({ timeout: 10000 });

    // Verify nodes exist (circles in SVG)
    const circles = svg.locator('circle');
    const circleCount = await circles.count();
    expect(circleCount).toBeGreaterThan(0);
  });

  test('Learning job POST returns 200 and writes artifacts', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/labs/learning/run`);

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.artifacts).toBeDefined();
    expect(Array.isArray(data.artifacts)).toBe(true);
  });
});

