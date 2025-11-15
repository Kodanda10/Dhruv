#!/usr/bin/env node

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runLighthouse(url, options = {}) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage']
  });

  const runnerResult = await lighthouse(url, {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
    port: chrome.port,
    ...options
  });

  await chrome.kill();

  return runnerResult.lhr;
}

async function runDashboardLighthouse() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const dashboardUrl = `${baseUrl}/dashboard`;

  console.log(`Running Lighthouse audit on: ${dashboardUrl}`);

  try {
    const result = await runLighthouse(dashboardUrl);

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Save JSON report
    const jsonReportPath = path.join(reportsDir, 'lighthouse-dashboard.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(result, null, 2));

    // Save HTML report
    const htmlReportPath = path.join(reportsDir, 'lighthouse-dashboard.html');
    const htmlReport = lighthouse.generateReport(result, 'html');
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log(`Reports saved to: ${jsonReportPath} and ${htmlReportPath}`);

    // Basic assertions
    const performance = result.categories.performance.score * 100;
    const accessibility = result.categories.accessibility.score * 100;
    const bestPractices = result.categories['best-practices'].score * 100;

    console.log('\n=== Lighthouse Results ===');
    console.log(`Performance: ${performance.toFixed(1)}/100`);
    console.log(`Accessibility: ${accessibility.toFixed(1)}/100`);
    console.log(`Best Practices: ${bestPractices.toFixed(1)}/100`);

    // Define basic thresholds (adjustable)
    const thresholds = {
      performance: 70,    // LCP ≤ 2.5s equivalent
      accessibility: 90,  // WCAG 2.1 AA standard
      bestPractices: 80
    };

    const failures = [];

    if (performance < thresholds.performance) {
      failures.push(`Performance score ${performance.toFixed(1)} < ${thresholds.performance}`);
    }
    if (accessibility < thresholds.accessibility) {
      failures.push(`Accessibility score ${accessibility.toFixed(1)} < ${thresholds.accessibility}`);
    }
    if (bestPractices < thresholds.bestPractices) {
      failures.push(`Best Practices score ${bestPractices.toFixed(1)} < ${thresholds.bestPractices}`);
    }

    if (failures.length > 0) {
      console.error('\n❌ Lighthouse checks failed:');
      failures.forEach(failure => console.error(`  - ${failure}`));
      process.exit(1);
    } else {
      console.log('\n✅ All Lighthouse checks passed!');
    }

    return result;

  } catch (error) {
    console.error('Lighthouse audit failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDashboardLighthouse();
}

export { runDashboardLighthouse, runLighthouse };