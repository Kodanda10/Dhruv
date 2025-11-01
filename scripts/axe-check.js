#!/usr/bin/env node
const puppeteer = require('puppeteer');
const axeSource = require('axe-core').source;

(async () => {
  const url = process.env.AXE_URL || 'http://localhost:3000';
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: 'new',
  });
  const page = await browser.newPage();
  // Increase timeout and use a more lenient wait condition
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait a bit for client-side rendering to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => await axe.run(document));
  await browser.close();

  if (results.violations.length) {
    console.error('Axe violations:', results.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })));
    process.exit(1);
  } else {
    console.log('Axe: no violations');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

