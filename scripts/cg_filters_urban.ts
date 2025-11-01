/**
 * Chhattisgarh SuShasan — Urban Filter Enumerator (District → ULB → Ward)
 * URL: https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports
 *
 * What this does:
 *  - Stays strictly in the filter section (no Search).
 *  - Forces "Urban/शहरी" mode.
 *  - Opens each control and binds to the popup it actually spawned (no global menu bleed).
 *  - Reads options only from that popup, with soft validation (no hard whitelist).
 *  - Selects a district, waits for ULB to enable and populate, selects ULB, then waits for wards.
 *  - Respects limits (maxDistricts/maxULBs/maxWards) and polite delays between steps.
 *
 * How to run:
 *  - npm i -D playwright ts-node
 *  - npx playwright install chromium
 *  - TS_NODE_TRANSPILE_ONLY=1 ts-node Project_Dhruv/scripts/cg_filters_urban.ts
 */

import { chromium } from 'playwright';
import type { Locator, Page, Frame } from 'playwright';

// ----------------------------- Types -----------------------------

type Limits = {
  maxDistricts: number;
  maxBlocks: number; // unused in urban
  maxPanchayats: number; // unused in urban
  maxVillages: number; // unused in urban
  maxULBs: number;
  maxWards: number;
  delay: number; // ms
};

type Option = { value: string; label: string };
type Ctx = Page | Frame;

// ----------------------------- Config -----------------------------

const TARGET_URL =
  'https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports';

const params = {
  mode: 'urban' as const,
  limits: {
    maxDistricts: 3,
    maxBlocks: 0,
    maxPanchayats: 0,
    maxVillages: 0,
    maxULBs: 2,
    maxWards: 2,
    delay: 900,
  } as Limits,
};

// Soft validator: accept common Hindi/Roman labels; avoid nav/utility text
const isLikelyRealOption = (txt: string) => {
  const s = (txt || '').trim();
  if (!s) return false;
  const badHints = [
    'http',
    'https',
    'होम',
    'home',
    'policy',
    'login',
    'लॉगिन',
    '|',
    '||',
    ':', // menu-like
    'छत्तीसगढ़ जनदर्शन',
    'छत्तीसगढ़ सीएमओ',
  ];
  if (badHints.some((h) => s.toLowerCase().includes(h))) return false;
  // Hindi block + basic ASCII letters/numbers/spaces/.-() within length bounds
  const ok =
    /^[\u0900-\u097F A-Za-z0-9().\- ]{2,60}$/.test(s) || /^[A-Za-z0-9().\- ]{2,60}$/.test(s);
  return ok;
};

const log = (...a: any[]) => console.log(...a);

// ----------------------------- Helpers -----------------------------

async function enforceUrban(page: Ctx) {
  // Robustly select Urban (शहरी) radio across implementations (native/AntD/ARIA)
  const tryClick = async (loc: Locator) => {
    try {
      if ((await loc.count().catch(() => 0)) > 0) {
        const n = loc.first();
        await n.scrollIntoViewIfNeeded().catch(() => {});
        await n.click({ force: true }).catch(() => {});
        await page.waitForTimeout(150).catch(() => {});
        return true;
      }
    } catch {}
    return false;
  };

  // 1) Prefer explicit label binding (works when label is associated to input)
  const urbanByLabel = page.getByLabel('शहरी', { exact: true });
  if ((await urbanByLabel.count().catch(() => 0)) > 0) {
    await urbanByLabel.check({ force: true }).catch(async () => {
      await urbanByLabel.click({ force: true }).catch(() => {});
    });
  } else {
    // 2) Role-based and text-based fallbacks
    const tried =
      (await tryClick(page.getByRole('radio', { name: 'शहरी' }))) ||
      (await tryClick(page.locator('.ant-radio-wrapper:has-text("शहरी")'))) ||
      (await tryClick(page.locator('xpath=//label[normalize-space()="शहरी"]'))) ||
      (await tryClick(
        page.locator(
          'xpath=//*[normalize-space(text())="शहरी"]/preceding::*[self::input[@type="radio"]][1]',
        ),
      )) ||
      (await tryClick(
        page.locator(
          'input[type="radio"][value*="Urban" i], input[type="radio"][aria-label="शहरी"]',
        ),
      ));
    if (!tried) {
      // 3) As a last resort, click the last radio in the group (often Urban)
      await tryClick(page.locator('input[type="radio"]').last());
    }
  }

  // If rural still appears checked, re-assert urban via role path
  const ruralByLabel = page.getByLabel('ग्रामीण', { exact: true }).first();
  if ((await ruralByLabel.count().catch(() => 0)) > 0) {
    const ruralChecked = await ruralByLabel.isChecked().catch(() => false);
    if (ruralChecked) {
      await page
        .getByRole('radio', { name: 'शहरी' })
        .first()
        .click({ force: true })
        .catch(() => {});
    }
  }

  // Verify by waiting for an urban-only control (urbantype/urbanbody) to be visible/enabled
  const urbanControl = page.locator('#urbantype, #urbanbody').first();
  await urbanControl.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400).catch(() => {});
}

// Prefer accessible labels; then placeholders; then role+name; then text-adjacent combobox/select
async function findControlByHints(page: Ctx, hints: string[]): Promise<Locator> {
  // Prefer placeholder-based controls first (often targets the actual input/select)
  for (const hint of hints) {
    const ph = page.getByPlaceholder(hint, { exact: false });
    if ((await ph.count().catch(() => 0)) > 0) {
      const cand = ph.first();
      try {
        await cand.scrollIntoViewIfNeeded().catch(() => {});
        const bb = await cand.boundingBox().catch(() => null);
        if (bb) return cand;
      } catch {}
    }
  }
  // Then accessible labels
  for (const hint of hints) {
    const lbl = page.getByLabel(hint, { exact: false });
    if ((await lbl.count().catch(() => 0)) > 0) {
      let cand = lbl.first();
      // getByLabel can return <label>; prefer following control
      const following = cand.locator(
        'xpath=following::*[self::select or @role="combobox" or self::input][1]',
      );
      if ((await following.count().catch(() => 0)) > 0) cand = following.first();
      try {
        await cand.scrollIntoViewIfNeeded().catch(() => {});
        const bb = await cand.boundingBox().catch(() => null);
        if (bb) return cand;
      } catch {}
    }
  }
  // Then role+name
  for (const hint of hints) {
    const roleCombo = page.getByRole('combobox', { name: new RegExp(hint) });
    if ((await roleCombo.count().catch(() => 0)) > 0) {
      const cand = roleCombo.first();
      try {
        await cand.scrollIntoViewIfNeeded().catch(() => {});
        const bb = await cand.boundingBox().catch(() => null);
        if (bb) return cand;
      } catch {}
    }
  }
  // Text label → following control
  for (const hint of hints) {
    const labelText = page.locator(`text=${hint}`).first();
    if ((await labelText.count().catch(() => 0)) > 0) {
      const following = labelText.locator(
        'xpath=following::*[self::select or @role="combobox" or self::input][1]',
      );
      if ((await following.count().catch(() => 0)) > 0) {
        const cand = following.first();
        try {
          await cand.scrollIntoViewIfNeeded().catch(() => {});
          const bb = await cand.boundingBox().catch(() => null);
          if (bb) return cand;
        } catch {}
      }
    }
  }
  // Generic last resort: pick the first visible control with a bounding box
  const generic = page.locator('select, [role="combobox"], input[role="combobox"]');
  const count = await generic.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const cand = generic.nth(i);
    try {
      await cand.scrollIntoViewIfNeeded().catch(() => {});
      const bb = await cand.boundingBox().catch(() => null);
      if (bb) return cand;
    } catch {}
  }
  // Fallback to the first one
  return page.locator('select, [role="combobox"], input[role="combobox"]').first();
}

function uniqOptions(options: Option[]): Option[] {
  const seen = new Set<string>();
  return options.filter((o) => {
    const key = o.label.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function bindPopup(page: Ctx, control: Locator): Promise<Locator> {
  const beforeCount = await page
    .locator('[role="listbox"]:visible')
    .count()
    .catch(() => 0);
  // Ensure we have a real interactive element with a box; recover from labels/wrappers
  let target = control;
  await target.scrollIntoViewIfNeeded().catch(() => {});
  let bbox = await target.boundingBox().catch(() => null);
  if (!bbox) {
    const following = target.locator(
      'xpath=following::*[self::select or @role="combobox" or self::input][1]',
    );
    if ((await following.count().catch(() => 0)) > 0) {
      target = following.first();
      await target.scrollIntoViewIfNeeded().catch(() => {});
      bbox = await target.boundingBox().catch(() => null);
    }
  }
  // If the input itself has no bbox (e.g., invisible AntD search input), try clicking the visible AntD selector
  const antWrapSelector = target.locator(
    'xpath=ancestor::*[contains(@class,"ant-select")][1]//div[contains(@class,"ant-select-selector")]',
  );
  if ((await antWrapSelector.count().catch(() => 0)) > 0) {
    await antWrapSelector
      .first()
      .click({ force: true })
      .catch(() => {});
    await page.waitForTimeout(120).catch(() => {});
    // Fallback bind: even without bbox, use the first visible listbox
    const popsFallback = page.locator(
      '[role="listbox"]:visible, .ant-select-dropdown:visible, .ng-dropdown-panel:visible, .select2-results:visible, .MuiAutocomplete-popper:visible, .dropdown-menu.show:visible',
    );
    if ((await popsFallback.count().catch(() => 0)) > 0) {
      return popsFallback.first();
    }
  } else {
    // Last resort: click the target itself and try to bind any visible listbox
    await target.click({ force: true }).catch(() => {});
    await page.waitForTimeout(120).catch(() => {});
    const popsFallback = page.locator(
      '[role="listbox"]:visible, .ant-select-dropdown:visible, .ng-dropdown-panel:visible, .select2-results:visible, .MuiAutocomplete-popper:visible, .dropdown-menu.show:visible',
    );
    if ((await popsFallback.count().catch(() => 0)) > 0) {
      return popsFallback.first();
    }
  }
  // No immediate popup bound yet; continue to aria-controls mapping and proximity fallback

  // Open the control (prefer AntD selector; inputs are invisible/readonly)
  const antSelector = target.locator(
    'xpath=ancestor::*[contains(@class,"ant-select")][1]//div[contains(@class,"ant-select-selector")]',
  );
  if ((await antSelector.count().catch(() => 0)) > 0) {
    await antSelector
      .first()
      .click({ force: true })
      .catch(() => {});
  } else {
    await target.click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(120).catch(() => {});

  // 1) aria-controls mapping (fast path)
  const ariaId =
    (await target.getAttribute('aria-controls').catch(() => null)) ||
    (await target.getAttribute('aria-owns').catch(() => null));
  if (ariaId) {
    const popup = page.locator(`#${ariaId}:visible`);
    if (
      (await popup
        .first()
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false)) &&
      (await popup.count().catch(() => 0)) > 0
    ) {
      return popup.first();
    }
  }

  // 2) Nearest visible listbox/dropdown to the control
  const listboxes = page.locator(
    [
      '[role="listbox"]:visible',
      '.select2-results:visible',
      '.dropdown-menu.show:visible',
      '.MuiAutocomplete-popper:visible',
      '.ng-dropdown-panel:visible',
      '.ant-select-dropdown:visible',
    ].join(', '),
  );
  const afterCount = await listboxes.count().catch(() => 0);

  if (afterCount <= beforeCount) {
    // Retry click once if no popup showed up yet
    await target.click({ force: true }).catch(() => {});
    await page.waitForTimeout(150).catch(() => {});
  }

  const cnt = await listboxes.count().catch(() => 0);
  if (cnt === 0) throw new Error('No popup appeared for this control');

  // If control bbox is unavailable, pick the first visible popup as a safe fallback
  if (!bbox) return listboxes.first();

  let bestIdx = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < cnt; i++) {
    const el = listboxes.nth(i);
    const bb = await el.boundingBox().catch(() => null);
    if (!bb) continue;
    const dx = bb.x + bb.width / 2 - (bbox.x + bbox.width / 2);
    const dy = bb.y + bb.height / 2 - (bbox.y + bbox.height / 2);
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) throw new Error('Popup association failed');
  return listboxes.nth(bestIdx);
}

async function readOptionsFromPopup(popup: Locator): Promise<Option[]> {
  // Try common option roles/selectors (role first)
  const candidates = popup.locator(
    [
      '[role="option"]',
      '.ant-select-item-option-content',
      '.ant-select-item',
      '.select2-results__option',
      '.MuiAutocomplete-option',
      '.ng-option',
      'li',
    ].join(', '),
  );
  const n = await candidates.count().catch(() => 0);
  const out: Option[] = [];
  for (let i = 0; i < n; i++) {
    const el = candidates.nth(i);
    const label = ((await el.innerText().catch(() => '')) || '').trim();
    if (!isLikelyRealOption(label)) continue;
    const value =
      ((await el.getAttribute('data-value').catch(() => null)) ||
        (await el.getAttribute('value').catch(() => null)) ||
        label) + '';
    out.push({ value: value.trim(), label });
  }
  return uniqOptions(out);
}

// Native select support
async function isSelectControl(control: Locator): Promise<boolean> {
  try {
    const tag = await control.evaluate((el) => (el as HTMLElement).tagName).catch(() => null);
    return String(tag || '').toLowerCase() === 'select';
  } catch {
    return false;
  }
}

async function readOptionsFromSelect(control: Locator): Promise<Option[]> {
  const options = control.locator('option');
  const count = await options.count().catch(() => 0);
  const out: Option[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const opt = options.nth(i);
    const label = ((await opt.innerText().catch(() => '')) || '').trim();
    if (!label || !isLikelyRealOption(label)) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    const value = ((await opt.getAttribute('value').catch(() => null)) || label).trim();
    out.push({ value, label });
  }
  return out;
}

async function selectOptionInSelect(control: Locator, label: string): Promise<void> {
  // Try by label first, then by value
  await control.selectOption({ label }).catch(async () => {
    const options = control.locator('option');
    const count = await options.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const opt = options.nth(i);
      const text = ((await opt.innerText().catch(() => '')) || '').trim();
      if (text === label) {
        const val = (await opt.getAttribute('value').catch(() => null)) || text;
        await control.selectOption(val).catch(() => {});
        break;
      }
    }
  });
  // Dispatch change/input for frameworks
  try {
    await control.evaluate((el) => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  } catch {}
}

async function selectInControl(page: Ctx, control: Locator, label: string): Promise<void> {
  if (await isSelectControl(control)) {
    await selectOptionInSelect(control, label);
    return;
  }
  // AntD: click the visible selector instead of the invisible input
  const antSelector = control.locator(
    'xpath=ancestor::*[contains(@class,"ant-select")][1]//div[contains(@class,"ant-select-selector")]',
  );
  if ((await antSelector.count().catch(() => 0)) > 0) {
    await antSelector
      .first()
      .click({ force: true })
      .catch(() => {});
  }
  const popup = await bindPopup(page, control);
  await selectByLabelInPopup(popup, label);
  await popup
    .page()
    .keyboard.press('Escape')
    .catch(() => {});
}

async function selectByLabelInPopup(popup: Locator, label: string) {
  // Prefer role=option exact
  const exact = popup.getByRole('option', { name: label }).first();
  if ((await exact.count().catch(() => 0)) > 0) {
    await exact.click({ force: true }).catch(() => {});
    return;
  }
  // Then any role=option with text
  const fuzzy = popup.locator(`*[role="option"]:has-text("${label}")`).first();
  if ((await fuzzy.count().catch(() => 0)) > 0) {
    await fuzzy.click({ force: true }).catch(() => {});
    return;
  }
  // Lastly, plain LI with text
  const anyLi = popup.locator(`li:has-text("${label}")`).first();
  if ((await anyLi.count().catch(() => 0)) > 0) {
    await anyLi.click({ force: true }).catch(() => {});
    return;
  }
  throw new Error(`Option not found in popup: ${label}`);
}

async function waitAndProbeOptions(
  page: Ctx,
  control: Locator,
  min = 2,
  retries = 5,
  gapMs = 500,
): Promise<Option[]> {
  // Native select path (no popup)
  if (await isSelectControl(control)) {
    for (let r = 0; r < retries; r++) {
      const opts = await readOptionsFromSelect(control);
      if (opts.length >= min) return opts;
      await page.waitForTimeout(gapMs).catch(() => {});
    }
    return await readOptionsFromSelect(control);
  }

  // Popup-bound path
  for (let r = 0; r < retries; r++) {
    const popup = await bindPopup(page, control);
    const opts = await readOptionsFromPopup(popup);
    await popup
      .page()
      .keyboard.press('Escape')
      .catch(() => {});
    if (opts.length >= min) return opts;
    await page.waitForTimeout(gapMs).catch(() => {});
  }
  // Last attempt (diagnostic)
  const lastPopup = await bindPopup(page, control);
  const finalOpts = await readOptionsFromPopup(lastPopup);
  await lastPopup
    .page()
    .keyboard.press('Escape')
    .catch(() => {});
  return finalOpts;
}

// Domain-specific control finders for this portal (urban flow)
async function getDistrictControl(page: Ctx): Promise<Locator> {
  // Bind directly to AntD input id="district" if present; fallback to hints
  const byId = page.locator('#district');
  if ((await byId.count().catch(() => 0)) > 0) return byId.first();
  return findControlByHints(page, ['जिला', 'जिला चुनें', 'District']);
}
async function getUrbanTypeControl(page: Ctx): Promise<Locator> {
  // Prefer AntD input id="urbantype"; fallback to common hints
  const byId = page.locator('#urbantype');
  if ((await byId.count().catch(() => 0)) > 0) return byId.first();
  return findControlByHints(page, [
    'निकाय प्रकार',
    'Urban Type',
    'ULB Type',
    'urban type',
    'urbantype',
  ]);
}
async function getULBControl(page: Ctx): Promise<Locator> {
  // Prefer the AntD input id="urbanbody" (ULB) if available; fallback to hints
  const byId = page.locator('#urbanbody');
  if ((await byId.count().catch(() => 0)) > 0) return byId.first();
  return findControlByHints(page, [
    'ULB',
    'Urban Local Body',
    'नगर निगम',
    'नगर पालिका',
    'नगर पंचायत',
    'शहरी निकाय',
    'निकाय',
    'निकाय चुनें',
  ]);
}
async function getWardControl(page: Ctx): Promise<Locator> {
  // Prefer the AntD input id="ward" if available; fallback to hints
  const byId = page.locator('#ward');
  if ((await byId.count().catch(() => 0)) > 0) return byId.first();
  return findControlByHints(page, ['वार्ड', 'वार्ड चुनें', 'Ward']);
}

async function waitForControlReady(page: Ctx, control: Locator, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // If it's an AntD select, ensure it's not disabled and has a visible selector
      const antRoot = control.locator('xpath=ancestor::*[contains(@class,"ant-select")][1]');
      const hasAnt = (await antRoot.count().catch(() => 0)) > 0;
      let disabled = false;
      if (hasAnt) {
        const cls = (await antRoot.getAttribute('class').catch(() => '')) || '';
        disabled = /ant-select-disabled/.test(cls);
        const sel = antRoot.locator('.ant-select-selector');
        if (!disabled && (await sel.count().catch(() => 0)) > 0) {
          if (
            await sel
              .first()
              .isVisible()
              .catch(() => false)
          )
            return;
        }
      }

      // Generic readiness: must have a bounding box and be visible
      const bb = await control.boundingBox().catch(() => null);
      if (bb && bb.width > 4 && bb.height > 4 && !disabled) return;
    } catch {}
    await page.waitForTimeout(200).catch(() => {});
  }
}

// Discover the context (page or frame) that actually hosts the filters
async function getFiltersContext(page: Page): Promise<Ctx> {
  try {
    if (
      (await page
        .locator('#district')
        .count()
        .catch(() => 0)) > 0
    )
      return page as Ctx;
    for (const f of page.frames()) {
      try {
        if (
          (await f
            .locator('#district')
            .count()
            .catch(() => 0)) > 0
        )
          return f as Ctx;
      } catch {}
    }
    await page.waitForTimeout(600).catch(() => {});
    if (
      (await page
        .locator('#district')
        .count()
        .catch(() => 0)) > 0
    )
      return page as Ctx;
    for (const f of page.frames()) {
      try {
        if (
          (await f
            .locator('#district')
            .count()
            .catch(() => 0)) > 0
        )
          return f as Ctx;
      } catch {}
    }
  } catch {}
  return page as Ctx;
}
// ----------------------------- Main -----------------------------

(async () => {
  log('[CG Filters] Opening portal...');
  log('[CG Filters][Debug] Params:', JSON.stringify(params, null, 2));

  const headfulEnv = String(process.env.HEADFUL || '').toLowerCase();
  const headful = headfulEnv === '1' || headfulEnv === 'true' || headfulEnv === 'yes';
  const browser = await chromium.launch({
    headless: !headful,
    args: headful ? ['--window-size=1366,900'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultTimeout(15000);

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  const ctx = await getFiltersContext(page);

  // Enforce urban mode, stay on filter section
  await enforceUrban(ctx);

  // Resolve controls in urban path
  const districtCtrl = await getDistrictControl(ctx);
  const urbanTypeCtrl = await getUrbanTypeControl(ctx);
  const ulbCtrl = await getULBControl(ctx);
  const wardCtrl = await getWardControl(ctx);

  // Ensure district control is interactable before reading options
  await waitForControlReady(ctx, districtCtrl, 15000);

  // Districts (sample-limited)
  const districtOpts = (await waitAndProbeOptions(ctx, districtCtrl, 3, 7, 600)).slice(
    0,
    params.limits.maxDistricts || undefined,
  );

  if (!districtOpts.length) {
    log('[CG Filters][Error] No valid districts discovered (scoped popup).');
    await browser.close();
    process.exit(2);
  }

  log(
    `[CG Filters] Districts (sample ${districtOpts.length}):`,
    districtOpts.map((o) => o.label),
  );

  for (const dist of districtOpts) {
    log(`\n[CG Filters] ▶ Selecting जिला: ${dist.label}`);
    {
      await selectInControl(ctx, districtCtrl, dist.label);
    }
    await ctx.waitForTimeout(params.limits.delay).catch(() => {});
    await waitForControlReady(ctx, urbanTypeCtrl, 15000);
    const urbanTypeOpts = await waitAndProbeOptions(ctx, urbanTypeCtrl, 1, 5, 500);
    if (urbanTypeOpts.length) {
      await selectInControl(ctx, urbanTypeCtrl, urbanTypeOpts[0].label);
    }
    await waitForControlReady(ctx, ulbCtrl, 15000);

    // ULBs for this district
    const ulbOpts = (await waitAndProbeOptions(ctx, ulbCtrl, 2, 7, 600)).slice(
      0,
      params.limits.maxULBs || undefined,
    );
    log(
      `[CG Filters]   ↳ ULBs found: ${ulbOpts.length}${
        ulbOpts.length ? ' — ' + ulbOpts.map((u) => u.label).join(', ') : ''
      }`,
    );

    for (const ulb of ulbOpts) {
      log(`[CG Filters]     • Selecting ULB: ${ulb.label}`);
      {
        await selectInControl(ctx, ulbCtrl, ulb.label);
      }
      await ctx.waitForTimeout(params.limits.delay).catch(() => {});
      await waitForControlReady(ctx, wardCtrl, 15000);

      // Wards
      const wardOpts = (await waitAndProbeOptions(ctx, wardCtrl, 2, 7, 600)).slice(
        0,
        params.limits.maxWards || undefined,
      );
      log(
        `[CG Filters]       ↳ Wards (${wardOpts.length}): ${wardOpts
          .map((w) => w.label)
          .join(', ')}`,
      );
    }
  }

  await browser.close();
  log('\n[CG Filters] ✅ Urban scrape complete (district → ULB → ward).');
})().catch((err) => {
  console.error('[CG Filters][Fatal]', err?.message || err);
  process.exit(1);
});
