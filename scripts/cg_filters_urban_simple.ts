import { chromium } from 'playwright';
import type { Locator, Page, Frame } from 'playwright';

type Ctx = Page | Frame;

const TARGET_URL =
  'https://sshasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports'.replace(
    'sshasantihar',
    'sushasantihar',
  );

const LIMITS = {
  maxDistricts: 3,
  maxUrbanTypes: 3,
  maxULBs: 3,
  maxWards: 5,
  delayMs: 800,
};

const CTRL = {
  district: { inputId: 'district', listId: 'district_list' },
  urbantype: { inputId: 'urbantype', listId: 'urbantype_list' },
  urbanbody: { inputId: 'urbanbody', listId: 'urbanbody_list' },
  ward: { inputId: 'ward', listId: 'ward_list' },
};

type Option = { label: string; value: string };
const DBG = !!process.env.DEBUG;
const debug = (...a: any[]) => {
  if (DBG) console.log('[DEBUG]', ...a);
};

// ---- context/frame helpers ----
async function getFiltersContext(page: Page): Promise<Ctx> {
  // Return the Page or Frame that actually hosts the filters (#district)
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
  await page.waitForTimeout(600).catch(() => {});
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

// ---- AntD helpers (frame-aware) ----
function antSelectRootFromInput(ctx: Ctx, inputId: string): Locator {
  const input = ctx.locator(`#${inputId}`);
  return input.locator('xpath=ancestor::*[contains(@class,"ant-select")][1]');
}
function antSelectBox(root: Locator): Locator {
  return root.locator('.ant-select-selector');
}
function popupFromListId(ctx: Ctx, listId: string): Locator {
  // AntD mounts the listbox in a portal; id is stable.
  return ctx.locator(`#${listId}:visible`);
}

async function openPopup(ctx: Ctx, inputId: string, listId: string): Promise<Locator> {
  // Try clicking visible AntD selector
  const root = antSelectRootFromInput(ctx, inputId);
  const box = antSelectBox(root).first();

  // Scroll into view for reliability
  await root.scrollIntoViewIfNeeded().catch(() => {});
  await ctx.waitForTimeout(100).catch(() => {});

  if ((await box.count().catch(() => 0)) > 0) {
    await box.click({ force: true }).catch(() => {});
    await ctx.waitForTimeout(200).catch(() => {});
  }

  // Prefer aria-controls/owns on the input, else use provided listId
  const input = ctx.locator(`#${inputId}`).first();
  const owns =
    (await input.getAttribute('aria-controls').catch(() => null)) ||
    (await input.getAttribute('aria-owns').catch(() => null)) ||
    listId;

  // If not visible yet, try keyboard open (ArrowDown/Enter)
  let popup = popupFromListId(ctx, owns).first();
  if (!(await popup.isVisible().catch(() => false))) {
    await input.focus().catch(() => {});
    await ctx.keyboard.press('ArrowDown').catch(() => {});
    await ctx.keyboard.press('Enter').catch(() => {});
    await ctx.waitForTimeout(200).catch(() => {});
    popup = popupFromListId(ctx, owns).first();
  }

  // Fallback: label-adjacent AntD selector (जिला / District)
  if (!(await popup.isVisible().catch(() => false))) {
    const nearLabelSelector = ctx
      .locator(
        'xpath=(//*[normalize-space(text())="जिला" or normalize-space(text())="District"])[1]/following::*[contains(@class,"ant-select-selector")][1]',
      )
      .first();
    if ((await nearLabelSelector.count().catch(() => 0)) > 0) {
      await nearLabelSelector.click({ force: true }).catch(() => {});
      await ctx.waitForTimeout(200).catch(() => {});
    }
    popup = popupFromListId(ctx, owns).first();
  }

  // Last try: click the hidden input and send Space/ArrowDown again
  if (!(await popup.isVisible().catch(() => false))) {
    await input.click({ force: true }).catch(() => {});
    await ctx.keyboard.press('Space').catch(() => {});
    await ctx.keyboard.press('ArrowDown').catch(() => {});
    await ctx.waitForTimeout(200).catch(() => {});
    popup = popupFromListId(ctx, owns).first();
  }

  if (!(await popup.isVisible().catch(() => false))) {
    const anyPopup = ctx.locator('.ant-select-dropdown:visible, [role="listbox"]:visible').first();
    if (await anyPopup.isVisible().catch(() => false)) {
      return anyPopup;
    }
  }
  await popup.waitFor({ state: 'visible', timeout: 5000 });
  return popup;
}

async function readOptions(pop: Locator, max = Infinity): Promise<Option[]> {
  const rows = pop.locator('.ant-select-item-option');
  const n = await rows.count();
  const out: Option[] = [];
  for (let i = 0; i < n && out.length < max; i++) {
    const row = rows.nth(i);
    const text = (
      await row
        .locator('.ant-select-item-option-content')
        .innerText()
        .catch(() => '')
    )?.trim();
    if (!text) continue;
    const value = (await row.getAttribute('data-value')) || text;
    out.push({ label: text, value });
  }
  return out;
}

async function selectByLabel(popup: Locator, label: string) {
  debug('selectByLabel starting for:', label);
  // AntD renders text inside .ant-select-item-option-content
  const content = popup.locator('.ant-select-item-option-content', { hasText: label }).first();

  // The scrollable container for virtual lists:
  const holder = popup
    .locator(
      '.rc-virtual-list-holder, .ant-select-dropdown:not(.ant-select-dropdown-hidden) .rc-virtual-list-holder',
    )
    .first();

  // Option row = direct filter on the row that has the content
  const row = popup.locator('.ant-select-item-option').filter({ has: content }).first();

  // Try to find/scroll up to N times
  const MAX_SWEEPS = 40;
  for (let i = 0; i < MAX_SWEEPS; i++) {
    if (await content.count()) {
      // Ensure content is visible
      await content.scrollIntoViewIfNeeded().catch(() => {});
      // Extra safety: scroll the holder if present
      try {
        const y = await content.evaluate((el) => (el as HTMLElement).offsetTop);
        if (await holder.count()) {
          await holder.evaluate((el, top) => {
            (el as HTMLElement).scrollTop = top as number;
          }, y - 40);
        }
      } catch {}
      await content.click({ timeout: 5000 });
      return;
    }

    // If not found yet, scroll the holder a bit and try again
    if (await holder.count()) {
      await holder.evaluate((el) => {
        (el as HTMLElement).scrollTop += 240;
      });
      debug('selectByLabel scrolled holder on sweep:', i);
    } else {
      // Fallback: page-level wheel if no holder detected (rare)
      await popup.page().mouse.wheel(0, 260);
      debug('selectByLabel wheeled page on sweep:', i);
    }
    await popup.page().waitForTimeout(40);
  }

  debug('selectByLabel failed to find:', label);
  throw new Error(`Option not found or not reachable in virtual list: "${label}"`);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ensureUrbanMode(ctx: Ctx) {
  // 1) Use the real AntD radio input
  const urbanRadio = ctx.locator('input.ant-radio-input[value="urban"]');
  if (await urbanRadio.count()) {
    await urbanRadio.check({ force: true });
  }

  // 2) Fire the React change event
  await ctx.evaluate(() => {
    const urban = document.querySelector<HTMLInputElement>('input.ant-radio-input[value="urban"]');
    if (urban) {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
      desc?.set?.call(urban, true);
      urban.dispatchEvent(new Event('input', { bubbles: true }));
      urban.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // 3) Try to wait until UrbanType control is visible
  let urbanTypeVisible = false;
  try {
    await ctx.waitForSelector('#urbantype', { state: 'visible', timeout: 5000 });
    urbanTypeVisible = true;
    debug('UrbanType control is visible');
  } catch {
    // Fallback: click submit button to trigger form submission
    const submitBtn = ctx
      .locator(
        'input[type="submit"], button[type="submit"], button:has-text("Submit"), button:has-text("Go"), button:has-text("Apply")',
      )
      .first();
    if (await submitBtn.count()) {
      await submitBtn.click({ force: true });
      await ctx.waitForTimeout(2000);
      try {
        await ctx.waitForSelector('#urbantype', { state: 'visible', timeout: 5000 });
        urbanTypeVisible = true;
        debug('UrbanType control visible after submit');
      } catch {
        debug('UrbanType control still not visible after submit');
      }
    } else {
      debug('No submit button found');
    }
  }
  if (!urbanTypeVisible) {
    console.log(
      '[WARNING] Urban mode may not be fully activated: #urbantype not visible. Proceeding anyway.',
    );
  }
}

// ---- main ----
(async () => {
  console.log('[CG Filters] Urban cascade starting…');
  if (DBG) console.log('[DEBUG] Debug mode ON');
  const headfulEnv = String(process.env.HEADFUL || '').toLowerCase();
  const headful = headfulEnv === '1' || headfulEnv === 'true' || headfulEnv === 'yes';

  const browser = await chromium.launch({
    headless: !headful,
    args: headful ? ['--window-size=1366,900'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(15000);

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  // Discover the correct context (frame/page) and ensure शहरी mode
  const ctx = await getFiltersContext(page);
  await ensureUrbanMode(ctx);

  // ---- DISTRICTS ----
  let pop = await openPopup(ctx, CTRL.district.inputId, CTRL.district.listId);
  const districts = await readOptions(pop);
  if (!districts.length) throw new Error('No districts found from #district_list');
  console.log(`[CG Filters] Districts found: ${districts.length}`);
  for (const dist of districts.slice(0, LIMITS.maxDistricts)) {
    console.log(`\n▶ जिला: ${dist.label}`);
    pop = await openPopup(ctx, CTRL.district.inputId, CTRL.district.listId);
    await selectByLabel(pop, dist.label);
    await ctx.waitForTimeout(LIMITS.delayMs).catch(() => {});

    // Check if urbantype is visible after district selection
    const urbantypeVisible =
      (await ctx.locator('#urbantype').count()) > 0 &&
      (await ctx.locator('#urbantype').isVisible());
    debug(`Urbantype visible after district: ${urbantypeVisible}`);

    if (urbantypeVisible) {
      // ---- URBAN TYPE (नगर निगम/पालिका/पंचायत) ----
      pop = await openPopup(ctx, CTRL.urbantype.inputId, CTRL.urbantype.listId);
      const types = await readOptions(pop, LIMITS.maxUrbanTypes);
      console.log(`  ↳ Types: ${types.map((t) => t.label).join(', ') || '—'}`);
      for (const t of types) {
        // select type
        pop = await openPopup(ctx, CTRL.urbantype.inputId, CTRL.urbantype.listId);
        await selectByLabel(pop, t.label);
        await ctx.waitForTimeout(LIMITS.delayMs).catch(() => {});

        // ---- ULBs ----
        pop = await openPopup(ctx, CTRL.urbanbody.inputId, CTRL.urbanbody.listId);
        const ulbs = await readOptions(pop, LIMITS.maxULBs);
        console.log(`    • ULBs(${t.label}): ${ulbs.map((u) => u.label).join(', ') || '—'}`);
        for (const ulb of ulbs) {
          // select ULB
          pop = await openPopup(ctx, CTRL.urbanbody.inputId, CTRL.urbanbody.listId);
          await selectByLabel(pop, ulb.label);
          await ctx.waitForTimeout(LIMITS.delayMs).catch(() => {});

          // ---- Wards ----
          pop = await openPopup(ctx, CTRL.ward.inputId, CTRL.ward.listId);
          const wards = await readOptions(pop, LIMITS.maxWards);
          console.log(
            `      · Wards(${ulb.label}): ${wards.map((w) => w.label).join(', ') || '—'}`,
          );
        }
      }
    } else {
      debug('Skipping urbantype, going directly to ULBs');
      // ---- ULBs (without type) ----
      pop = await openPopup(ctx, CTRL.urbanbody.inputId, CTRL.urbanbody.listId);
      const ulbs = await readOptions(pop, LIMITS.maxULBs);
      console.log(`  ↳ ULBs: ${ulbs.map((u) => u.label).join(', ') || '—'}`);
      for (const ulb of ulbs) {
        // select ULB
        pop = await openPopup(ctx, CTRL.urbanbody.inputId, CTRL.urbanbody.listId);
        await selectByLabel(pop, ulb.label);
        await ctx.waitForTimeout(LIMITS.delayMs).catch(() => {});

        // ---- Wards ----
        pop = await openPopup(ctx, CTRL.ward.inputId, CTRL.ward.listId);
        const wards = await readOptions(pop, LIMITS.maxWards);
        console.log(`    · Wards(${ulb.label}): ${wards.map((w) => w.label).join(', ') || '—'}`);
      }
    }
  }

  await browser.close();
  console.log('\n[CG Filters] ✅ Done: Urban (District → Type → ULB → Ward).');
})().catch((err) => {
  console.error('[CG Filters][Fatal]', err);
  process.exit(1);
});
