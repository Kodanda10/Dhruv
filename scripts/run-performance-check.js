#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runPerformanceCheck() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const dashboardUrl = `${baseUrl}/dashboard`;

  console.log(`Running performance check on: ${dashboardUrl}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    // Enable performance monitoring
    await page.setCacheEnabled(false);

    const metrics = {};

    // Track navigation timing
    page.on('load', async () => {
      const performanceTiming = JSON.parse(
        await page.evaluate(() => JSON.stringify(window.performance.timing))
      );

      metrics.loadTime = performanceTiming.loadEventEnd - performanceTiming.navigationStart;
      metrics.domContentLoaded = performanceTiming.domContentLoadedEventEnd - performanceTiming.navigationStart;
      metrics.firstPaint = await page.evaluate(() => {
        const paintEntries = performance.getEntriesByType('paint');
        const fpEntry = paintEntries.find(entry => entry.name === 'first-paint');
        return fpEntry ? fpEntry.startTime : null;
      });

      metrics.firstContentfulPaint = await page.evaluate(() => {
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return fcpEntry ? fcpEntry.startTime : null;
      });
    });

    // Navigate to dashboard
    const startTime = Date.now();
    await page.goto(dashboardUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    const navigationTime = Date.now() - startTime;

    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get basic page info
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      glassCards: document.querySelectorAll('.glass-section-card').length,
      legacyCards: document.querySelectorAll('.glassmorphic-card').length,
      hasContent: document.body.innerText.length > 100
    }));

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Save results
    const result = {
      timestamp: new Date().toISOString(),
      url: dashboardUrl,
      navigationTime,
      metrics,
      pageInfo,
      checks: {
        hasGlassCards: pageInfo.glassCards > 0,
        noLegacyCards: pageInfo.legacyCards === 0,
        hasContent: pageInfo.hasContent,
        loadTimeUnderLimit: metrics.loadTime < 3000, // 3s limit
        navigationUnderLimit: navigationTime < 5000 // 5s limit
      }
    };

    const jsonReportPath = path.join(reportsDir, 'performance-check.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(result, null, 2));

    console.log(`Performance report saved to: ${jsonReportPath}`);

    // Display results
    console.log('\n=== Performance Check Results ===');
    console.log(`Page Title: ${pageInfo.title}`);
    console.log(`Navigation Time: ${navigationTime}ms`);
    console.log(`Load Time: ${metrics.loadTime || 'N/A'}ms`);
    console.log(`DOM Content Loaded: ${metrics.domContentLoaded || 'N/A'}ms`);
    console.log(`First Paint: ${metrics.firstPaint ? metrics.firstPaint.toFixed(1) + 'ms' : 'N/A'}`);
    console.log(`First Contentful Paint: ${metrics.firstContentfulPaint ? metrics.firstContentfulPaint.toFixed(1) + 'ms' : 'N/A'}`);
    console.log(`Glass Cards Found: ${pageInfo.glassCards}`);
    console.log(`Legacy Cards Found: ${pageInfo.legacyCards}`);

    // Basic assertions
    const failures = [];

    if (!result.checks.hasGlassCards) {
      failures.push('No glass-section-card components found');
    }
    if (!result.checks.noLegacyCards) {
      failures.push(`${pageInfo.legacyCards} legacy glassmorphic-card components found`);
    }
    if (!result.checks.hasContent) {
      failures.push('Page has insufficient content');
    }
    if (!result.checks.loadTimeUnderLimit && metrics.loadTime) {
      failures.push(`Load time ${metrics.loadTime}ms exceeds 3s limit`);
    }
    if (!result.checks.navigationUnderLimit) {
      failures.push(`Navigation time ${navigationTime}ms exceeds 5s limit`);
    }

    if (failures.length > 0) {
      console.error('\n❌ Performance checks failed:');
      failures.forEach(failure => console.error(`  - ${failure}`));
      process.exit(1);
    } else {
      console.log('\n✅ All performance checks passed!');
    }

    return result;

  } catch (error) {
    console.error('Performance check failed:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceCheck();
}

export { runPerformanceCheck };