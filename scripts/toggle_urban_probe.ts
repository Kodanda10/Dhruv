/**
 * Headful probe: toggle Urban (शहरी) and inspect District popup binding (AntD)
 *
 * What it does:
 *  - Opens the SuShasan filter page headfully.
 *  - Finds the frame (if any) that hosts the filters (by #district).
 *  - Robustly selects the Urban (शहरी) radio (role/AntD wrapper/label fallbacks).
 *  - Verifies selection via aria-checked or AntD checked class.
 *  - Clicks the visible AntD selector for the #district input and binds to #district_list.
 *  - Prints a sample of district options for verification.
 *
 * How to run:
 *   cd /Users/abhijita/Projects/Project_Dhruv
 *   npx ts-node scripts/toggle_urban_probe.ts
 *
 * Tip:
 *   If the probe shows Urban not toggled, try clicking the "शहरी" label once manually
 *   in the opened window and re-run the script.
 */

import { chromium } from 'playwright';
import type { Page, Frame, Locator } from 'playwright';

const TARGET_URL =
  'https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports';

type Ctx = Page | Frame;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getFiltersContext(page: Page): Promise<Ctx> {
  // Find the page or frame that actually hosts the filters (#district)
  if (
    (await page
      .locator('#district')
      .count()
      .catch(() => 0)) > 0
  )
    return page;
  for (const f of page.frames()) {
    if (
      (await f
        .locator('#district')
        .count()
        .catch(() => 0)) > 0
    )
      return f;
  }
  await pause(800);
  if (
    (await page
      .locator('#district')
      .count()
      .catch(() => 0)) > 0
  )
    return page;
  for (const f of page.frames()) {
    if (
      (await f
        .locator('#district')
        .count()
        .catch(() => 0)) > 0
    )
      return f;
  }
  return page;
}

async function isUrbanSelected(ctx: Ctx): Promise<boolean> {
  const roleUrban = ctx.getByRole('radio', { name: 'शहरी' }).first();
  const ariaChecked = await roleUrban
    .getAttribute('aria-checked')
    .then((v) => v === 'true')
    .catch(() => false);

  const wrap = ctx.locator('.ant-radio-wrapper:has-text("शहरी")').first();
  const antChecked = await wrap
    .locator('.ant-radio')
    .evaluate((n) => (n ? n.classList.contains('ant-radio-checked') : false))
    .catch(() => false);

  return ariaChecked || antChecked;
}

async function selectUrban(ctx: Ctx): Promise<void> {
  const tryClick = async (loc: Locator) => {
    try {
      if ((await loc.count().catch(() => 0)) > 0) {
        await loc
          .first()
          .scrollIntoViewIfNeeded()
          .catch(() => {});
        await loc
          .first()
          .click({ force: true })
          .catch(() => {});
        await ctx.waitForTimeout(150).catch(() => {});
        return true;
      }
    } catch {}
    return false;
  };

  // 1) Role-based (if radios expose accessible names)
  const roleUrban = ctx.getByRole('radio', { name: 'शहरी' }).first();
  if ((await roleUrban.count().catch(() => 0)) > 0) {
    await roleUrban.click({ force: true }).catch(async () => {
      await roleUrban.press('Space').catch(() => {});
    });
  } else {
    // 2) AntD wrapper
    const wrap = ctx.locator('.ant-radio-wrapper:has-text("शहरी")').first();
    const input = wrap.locator('input[type="radio"]').first();
    await tryClick(wrap);
    await input.click({ force: true }).catch(() => {});
    // Synthetic mouse events for React/AntD
    await wrap
      .evaluate((el) => {
        ['mousedown', 'mouseup', 'click'].forEach((t) =>
          el.dispatchEvent(new MouseEvent(t, { bubbles: true })),
        );
      })
      .catch(() => {});
  }

  // 3) If still not selected, toggle rural then urban again to force re-render
  if (!(await isUrbanSelected(ctx))) {
    const roleRural = ctx.getByRole('radio', { name: 'ग्रामीण' }).first();
    await roleRural.click({ force: true }).catch(() => {});
    await ctx.waitForTimeout(200).catch(() => {});
    if ((await roleUrban.count().catch(() => 0)) > 0) {
      await roleUrban.click({ force: true }).catch(() => {});
    } else {
      const wrap = ctx.locator('.ant-radio-wrapper:has-text("शहरी")').first();
      await wrap.click({ force: true }).catch(() => {});
    }
  }

  // 4) Final settle and verify an urban-only control becomes visible
  await ctx.waitForTimeout(300).catch(() => {});
  await ctx
    .locator('#urbantype, #urbanbody')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => {});
}

async function openAntDPopupForInput(
  ctx: Ctx,
  inputId: string,
  popupId: string,
): Promise<Locator | null> {
  const input = ctx.locator(`#${inputId}`).first();
  if (!((await input.count().catch(() => 0)) > 0)) return null;

  // Scroll into view
  await input
    .evaluate((el) => (el as HTMLElement).scrollIntoView({ block: 'center' }))
    .catch(() => {});

  // 0) Try focus + keyboard open (AntD often reacts to ArrowDown/Enter)
  await input.focus().catch(() => {});
  await ctx.keyboard.press('ArrowDown').catch(() => {});
  await ctx.keyboard.press('Enter').catch(() => {});
  await ctx.waitForTimeout(200).catch(() => {});
  // Prefer aria-controls/owns if present
  const owns =
    (await input.getAttribute('aria-controls').catch(() => null)) ||
    (await input.getAttribute('aria-owns').catch(() => null)) ||
    popupId;
  if (owns) {
    const popup0 = ctx.locator(`#${owns}:visible`).first();
    if (await popup0.isVisible().catch(() => false)) return popup0;
  }

  // 1) Click the visible AntD selector associated with the input
  const selector = input
    .locator(
      'xpath=ancestor::*[contains(@class,"ant-select")][1]//div[contains(@class,"ant-select-selector")]',
    )
    .first();

  if ((await selector.count().catch(() => 0)) > 0) {
    await selector.click({ force: true }).catch(() => {});
    await ctx.waitForTimeout(250).catch(() => {});
    const popup1 = ctx.locator(`#${owns}:visible`).first();
    if (await popup1.isVisible().catch(() => false)) return popup1;
  }

  // 2) Fallback: label-adjacent AntD selector (जिला / District)
  const nearLabelSelector = ctx
    .locator(
      'xpath=(//*[normalize-space(text())="जिला" or normalize-space(text())="District"])[1]/following::*[contains(@class,"ant-select-selector")][1]',
    )
    .first();
  if ((await nearLabelSelector.count().catch(() => 0)) > 0) {
    await nearLabelSelector.click({ force: true }).catch(() => {});
    await ctx.waitForTimeout(250).catch(() => {});
    const popup2 = ctx.locator(`#${owns}:visible`).first();
    if (await popup2.isVisible().catch(() => false)) return popup2;
  }

  // 3) Last resort: click the hidden input and send Space/ArrowDown again
  await input.click({ force: true }).catch(() => {});
  await ctx.keyboard.press('Space').catch(() => {});
  await ctx.keyboard.press('ArrowDown').catch(() => {});
  await ctx.waitForTimeout(250).catch(() => {});
  const popup3 = ctx.locator(`#${owns}:visible`).first();
  if (await popup3.isVisible().catch(() => false)) return popup3;

  console.log(`[Probe] Popup #${owns} not visible after multiple strategies for #${inputId}.`);
  return null;
}

async function readPopupOptions(popup: Locator, limit = 10): Promise<string[]> {
  const items = popup.locator(
    ['[role="option"]', '.ant-select-item-option-content', '.ant-select-item', 'li'].join(', '),
  );
  const n = Math.min(await items.count().catch(() => 0), limit);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const s = (
      (await items
        .nth(i)
        .innerText()
        .catch(() => '')) || ''
    ).trim();
    if (s) out.push(s);
  }
  return out;
}

(async () => {
  console.log('[Probe] Launching Chromium headful…');
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1366,900'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultTimeout(15000);

  console.log('[Probe] Navigating to portal…');
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const ctx = await getFiltersContext(page);

  console.log('[Probe] Selecting "शहरी"…');
  await selectUrban(ctx);
  const urbanOK = await isUrbanSelected(ctx);
  console.log('[Probe] Urban selected?', urbanOK);

  console.log('[Probe] Opening District popup…');
  const districtPopup = await openAntDPopupForInput(ctx, 'district', 'district_list');
  if (districtPopup) {
    const sample = await readPopupOptions(districtPopup, 10);
    console.log('[Probe] Districts sample:', sample);
  } else {
    console.log('[Probe] Could not open or bind District popup.');
  }

  console.log('[Probe] Keeping window open for 15 seconds (you can inspect the dropdown)…');
  await ctx.waitForTimeout(15000).catch(() => {});
  await browser.close().catch(() => {});
  console.log('[Probe] Closed.');
})().catch((err) => {
  console.error('[Probe][Fatal]', err?.message || err);
  process.exit(1);
});
