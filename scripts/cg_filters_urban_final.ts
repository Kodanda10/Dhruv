// Run with:
// TS_NODE_COMPILER_OPTIONS='{"module":"CommonJS"}' HEADFUL=0 TS_NODE_TRANSPILE_ONLY=1 npx ts-node scripts/cg_filters_urban_final.ts

import { chromium } from 'playwright';
import type { Locator, Page } from 'playwright';

// ======= CONFIG =======
const TARGET_URL =
  'https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports';
const HEADFUL = process.env.HEADFUL === '1';

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

type Opt = { label: string; value: string };

const log = (...a: any[]) => console.log(...a);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ======= CORE HELPERS =======
function antSelectRootFromInput(page: Page, inputId: string): Locator {
  const input = page.locator(`#${inputId}`);
  return input.locator('xpath=ancestor::*[contains(@class,"ant-select")][1]');
}
function antSelectBox(root: Locator): Locator {
  return root.locator('.ant-select-selector');
}
function popupFromListId(page: Page, listId: string): Locator {
  return page.locator(`#${listId}:visible`);
}

async function openPopup(page: Page, inputId: string, listId: string): Promise<Locator> {
  const root = antSelectRootFromInput(page, inputId);
  const box = antSelectBox(root);
  await box.click({ force: true });
  const pop = popupFromListId(page, listId);
  await pop.waitFor({ state: 'visible', timeout: 6000 });
  return pop;
}

async function readOptions(pop: Locator, max = Infinity): Promise<Opt[]> {
  // AntD: text lives in .ant-select-item-option-content; list may be virtualized
  const rows = pop.locator('.ant-select-item-option');
  const n = await rows.count();
  const out: Opt[] = [];
  for (let i = 0; i < n && out.length < max; i++) {
    const row = rows.nth(i);
    const txt = (
      await row
        .locator('.ant-select-item-option-content')
        .innerText()
        .catch(() => '')
    )?.trim();
    if (!txt) continue;
    const val = (await row.getAttribute('data-value')) || txt;
    out.push({ label: txt, value: val });
  }
  return out;
}

async function selectByLabel(pop: Locator, label: string) {
  // Robust selection in virtualized list
  const content = pop.locator('.ant-select-item-option-content', { hasText: label }).first();
  const holder = pop
    .locator(
      '.rc-virtual-list-holder, .ant-select-dropdown:not(.ant-select-dropdown-hidden) .rc-virtual-list-holder',
    )
    .first();

  const rowFromContent = () =>
    content.locator('xpath=ancestor::*[contains(@class,"ant-select-item-option")][1]');

  const MAX_SWEEPS = 50;
  for (let i = 0; i < MAX_SWEEPS; i++) {
    if (await content.count()) {
      const row = rowFromContent();
      // Ensure in view
      await row.scrollIntoViewIfNeeded().catch(() => {});
      try {
        const y = await row.evaluate((el) => (el as HTMLElement).offsetTop);
        if (await holder.count()) {
          await holder.evaluate((el, top) => {
            (el as HTMLElement).scrollTop = (top as number) - 40;
          }, y);
        }
      } catch {}
      await row.click({ timeout: 5000 });
      return;
    }
    // scroll down gradually to materialize the item
    if (await holder.count()) {
      await holder.evaluate((el) => {
        (el as HTMLElement).scrollTop += 260;
      });
    } else {
      await pop.page().mouse.wheel(0, 280);
    }
    await pop.page().waitForTimeout(45);
  }

  // Fallback: exact role path (in case content locator failed)
  const fallback = pop.getByRole('option', { name: label }).first();
  if (await fallback.count()) {
    await fallback.scrollIntoViewIfNeeded().catch(() => {});
    await fallback.click({ timeout: 5000 });
    return;
  }

  throw new Error(`Option not found or not reachable in virtual list: "${label}"`);
}

// ======= URBAN MODE ENABLER (React/AntD safe) =======
async function ensureUrbanMode(page: Page) {
  // Best-effort: label-based
  const byLabel = page.getByLabel('शहरी', { exact: true });
  if (await byLabel.count()) {
    try {
      await byLabel.check({ force: true });
    } catch {}
  }

  // AntD wrapper span near radio
  const labelSpan = page.locator('.ant-radio-group >> text=शहरी').first();
  if (await labelSpan.count()) {
    await labelSpan.click({ force: true });
  }

  // Raw radio input (preferred if present)
  const raw = page.locator(
    'input.ant-radio-input[value="urban"], input[type="radio"][value="urban"]',
  );
  if (await raw.count()) {
    try {
      await raw.check({ force: true });
    } catch {
      await raw.click({ force: true });
    }
  }

  // React-friendly event dispatch
  await page.evaluate(() => {
    const pick = () =>
      document.querySelector<HTMLInputElement>(
        'input.ant-radio-input[value="urban"], input[type="radio"][value="urban"]',
      );
    const inpt = pick();
    if (inpt) {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
      desc?.set?.call(inpt, true);
      const fire = (n: string) =>
        inpt.dispatchEvent(new Event(n, { bubbles: true, cancelable: true }));
      fire('click');
      fire('input');
      fire('change');
    }
  });

  // Verify UrbanType becomes visible/enabled
  const utInput = page.locator(`#${CTRL.urbantype.inputId}`);
  const utRoot = utInput.locator('xpath=ancestor::*[contains(@class,"ant-select")][1]');
  const enabled = async () => {
    if (!(await utRoot.count())) return false;
    const cl = await utRoot.evaluate((el) => el.classList.contains('ant-select-disabled'));
    const aria = await utRoot.getAttribute('aria-disabled');
    return !cl && aria !== 'true';
  };

  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    if (await enabled()) break;
    await wait(150);
  }

  // Sanity: can open the list?
  try {
    const box = antSelectBox(utRoot);
    await box.click({ force: true });
    const pop = popupFromListId(page, CTRL.urbantype.listId);
    await pop.waitFor({ state: 'visible', timeout: 2500 });
    await page.keyboard.press('Escape').catch(() => {});
  } catch {
    throw new Error(
      'UrbanType did not mount after switching to शहरी. Radio change handler not firing.',
    );
  }
}

// ======= MAIN =======
(async () => {
  log('[CG Filters] Urban cascade starting…');

  const browser = await chromium.launch({
    headless: !HEADFUL,
    args: HEADFUL ? ['--window-size=1440,1100'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(18000);

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  // Switch to Urban and verify dependent filters are alive
  await ensureUrbanMode(page);

  // ---- DISTRICTS ----
  let pop = await openPopup(page, CTRL.district.inputId, CTRL.district.listId);
  const districts = await readOptions(pop);
  if (!districts.length) throw new Error('No districts found from #district_list');
  log(`[CG Filters] Districts found: ${districts.length}`);

  for (const dist of districts.slice(0, LIMITS.maxDistricts)) {
    log(`\n▶ जिला: ${dist.label}`);
    pop = await openPopup(page, CTRL.district.inputId, CTRL.district.listId);
    await selectByLabel(pop, dist.label);
    await wait(LIMITS.delayMs);

    // ---- URBAN TYPE (नगर निगम/पालिका/पंचायत) ----
    pop = await openPopup(page, CTRL.urbantype.inputId, CTRL.urbantype.listId);
    const types = await readOptions(pop, LIMITS.maxUrbanTypes);
    log(`  ↳ Types: ${types.map((t) => t.label).join(', ') || '—'}`);
    for (const t of types) {
      pop = await openPopup(page, CTRL.urbantype.inputId, CTRL.urbantype.listId);
      await selectByLabel(pop, t.label);
      await wait(LIMITS.delayMs);

      // ---- ULBs ----
      pop = await openPopup(page, CTRL.urbanbody.inputId, CTRL.urbanbody.listId);
      const ulbs = await readOptions(pop, LIMITS.maxULBs);
      log(`    • ULBs(${t.label}): ${ulbs.map((u) => u.label).join(', ') || '—'}`);

      for (const ulb of ulbs) {
        pop = await openPopup(page, CTRL.urbanbody.inputId, CTRL.urbanbody.listId);
        await selectByLabel(pop, ulb.label);
        await wait(LIMITS.delayMs);

        // ---- Wards ----
        pop = await openPopup(page, CTRL.ward.inputId, CTRL.ward.listId);
        const wards = await readOptions(pop, LIMITS.maxWards);
        log(`      · Wards(${ulb.label}): ${wards.map((w) => w.label).join(', ') || '—'}`);
      }
    }
  }

  await browser.close();
  log('\n[CG Filters] ✅ Done: Urban (District → Type → ULB → Ward).');
})().catch((err) => {
  console.error('[CG Filters][Fatal]', err);
  process.exit(1);
});
