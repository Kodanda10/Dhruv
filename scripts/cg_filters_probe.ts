/* eslint-disable no-console */
/**
 * Headful probe to discover the actual clickable controls and bound popups
 * for District / ULB / Ward on the Chhattisgarh SuShasan filter page.
 *
 * What it does:
 * - Opens the portal headfully and enforces Urban (शहरी) mode.
 * - For each control (district, ulb, ward), it tries several strategies:
 *     • locate the interactive node near label/placeholder
 *     • verify it's visible and has a bounding box
 *     • click and bind to the popup the control actually opens
 *     • print the popup's first few option texts
 * - Finally prints a summary with trimmed outerHTML for each discovered control.
 * - Auto-closes after a short delay.
 *
 * How to run:
 *   npm i -D playwright ts-node
 *   npx playwright install chromium
 *   TS_NODE_TRANSPILE_ONLY=1 ts-node Project_Dhruv/scripts/cg_filters_probe.ts
 */

import { chromium } from 'playwright';
import type { Locator, Page, Frame } from 'playwright';

const TARGET_URL =
  'https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports';
const MODE: 'urban' | 'rural' = 'urban';

// ---------- Probe spec ----------

type ProbeSpec = {
  labelHints: string[]; // visible text near the control
  placeholderHints: string[]; // placeholder-like text
  roleHints: string[]; // ARIA roles to try
  idHints: string[]; // id/class hints if any
  name: 'district' | 'ulb' | 'ward';
};

const PROBES: ProbeSpec[] = [
  {
    name: 'district',
    labelHints: ['जिला', 'जिला चुनें', 'District'],
    placeholderHints: ['जिला चुनें'],
    roleHints: ['combobox', 'listbox'],
    idHints: ['district', 'zilla', 'jila'],
  },
  {
    name: 'ulb',
    labelHints: ['नगर', 'निकाय', 'ULB', 'Urban Local Body', 'नगर निगम', 'नगर पालिका', 'नगर पंचायत'],
    placeholderHints: [
      'निकाय चुनें',
      'नगर',
      'ULB',
      'नगर पालिका',
      'नगर निगम',
      'नगर पंचायत',
      'शहरी निकाय',
    ],
    roleHints: ['combobox', 'listbox'],
    idHints: ['ulb', 'nikay', 'nagar'],
  },
  {
    name: 'ward',
    labelHints: ['वार्ड', 'वार्ड चुनें', 'Ward'],
    placeholderHints: ['वार्ड', 'वार्ड चुनें'],
    roleHints: ['combobox', 'listbox'],
    idHints: ['ward'],
  },
];

// ---------- Utilities ----------

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isVisibleClickable = async (loc: Locator) => {
  try {
    if (!(await loc.isVisible())) return false;
    const bb = await loc.boundingBox();
    if (!bb) return false;
    return bb.width > 4 && bb.height > 4;
  } catch {
    return false;
  }
};

const candidateSelectors = (p: ProbeSpec) => [
  // role-based
  ...p.roleHints.map((r) => `[role="${r}"]`),

  // inputs/selects
  'input[role="combobox"]',
  'input[aria-haspopup="listbox"]',
  'div[role="button"][aria-haspopup="listbox"]',
  'div[aria-expanded]',
  'button[aria-haspopup="listbox"]',
  'select',

  // common UI libs
  '.ant-select-selector',
  '.ant-select-selection-search-input',
  '.ant-select-selection-overflow',
  '.select2-selection',
  '.select2-selection__rendered',
  '.MuiAutocomplete-root input',
  '.MuiAutocomplete-input',
  '.dropdown-toggle',
  '.react-select__control',
  '.chakra-select__wrapper select',
  '.ng-select .ng-select-container',
  // shadow-piercing versions
  '>>> input[role="combobox"]',
  '>>> input[aria-haspopup="listbox"]',
  '>>> div[role="button"][aria-haspopup="listbox"]',
  '>>> div[aria-expanded]',
  '>>> button[aria-haspopup="listbox"]',
  '>>> select',
  '>>> .ant-select-selector',
  '>>> .ant-select-selection-search-input',
  '>>> .ant-select-selection-overflow',
  '>>> .select2-selection',
  '>>> .select2-selection__rendered',
  '>>> .MuiAutocomplete-root input',
  '>>> .MuiAutocomplete-input',
  '>>> .dropdown-toggle',
  '>>> .react-select__control',
  '>>> .chakra-select__wrapper select',
  '>>> .ng-select .ng-select-container',
  '>>> [role="combobox"]',
  '>>> [role="listbox"]',
];

const textNear = async (page: Page | Frame, text: string) =>
  page.locator(
    `xpath=//*[normalize-space(.)="${text}"]/following::*[self::input or self::div or self::button or self::span or self::select][1]`,
  );

// Enforce mode via the radios (ग्रामीण / शहरी)
async function enforceMode(page: Page) {
  const rural = page.getByLabel('ग्रामीण', { exact: true });
  const urban = page.getByLabel('शहरी', { exact: true });

  if (MODE === 'urban') {
    if ((await urban.count().catch(() => 0)) > 0) {
      await urban.check({ force: true }).catch(() => {});
    }
  } else {
    if ((await rural.count().catch(() => 0)) > 0) {
      await rural.check({ force: true }).catch(() => {});
    }
  }
  await pause(400);
}

// Find popup that this specific control opened.
async function bindPopup(page: Page, control: Locator): Promise<Locator | null> {
  const before = await page
    .locator('[role="listbox"]:visible')
    .count()
    .catch(() => 0);

  // ensure we click an actual interactive node
  let target = control;
  try {
    await target.scrollIntoViewIfNeeded().catch(() => {});
  } catch {}
  let bb = await target.boundingBox().catch(() => null);
  if (!bb) {
    // If the locator points to a label/wrapper, prefer the immediate following control
    const following = target.locator(
      'xpath=following::*[self::select or @role="combobox" or self::input][1]',
    );
    if ((await following.count().catch(() => 0)) > 0) {
      target = following.first();
      await target.scrollIntoViewIfNeeded().catch(() => {});
      bb = await target.boundingBox().catch(() => null);
    }
  }
  if (!bb) return null;

  await target.click({ force: true }).catch(() => {});
  await pause(150);

  // aria-controls fast-path
  const ariaId = await target.getAttribute('aria-controls').catch(() => null);
  if (ariaId) {
    const pop = page.locator(`#${ariaId}:visible`);
    if ((await pop.count().catch(() => 0)) > 0) return pop;
  }

  // Nearby listbox/popover candidates
  const pops = page.locator(
    [
      '[role="listbox"]:visible',
      '.select2-results:visible',
      '.MuiAutocomplete-popper:visible',
      '.dropdown-menu.show:visible',
      '.ng-dropdown-panel:visible',
      '.ant-select-dropdown:visible',
    ].join(', '),
  );
  const count = await pops.count().catch(() => 0);
  if (count <= before) return null;

  let bestIdx = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const n = pops.nth(i);
    const nb = await n.boundingBox().catch(() => null);
    if (!nb) continue;
    const d = Math.hypot(
      nb.x + nb.width / 2 - (bb.x + bb.width / 2),
      nb.y + nb.height / 2 - (bb.y + bb.height / 2),
    );
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx >= 0 ? pops.nth(bestIdx) : null;
}

async function firstOptions(popup: Locator, k = 10): Promise<string[]> {
  const items = popup.locator(
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
  const n = Math.min((await items.count().catch(() => 0)) || 0, k);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const txt = (
      (await items
        .nth(i)
        .innerText()
        .catch(() => '')) || ''
    ).trim();
    if (txt) out.push(txt);
  }
  return out;
}

async function probeOne(page: Page | Frame, spec: ProbeSpec) {
  console.log(`\n[Probe] ${spec.name.toUpperCase()} — discovering interactive node…`);

  // 1) via label "near following control"
  for (const t of spec.labelHints) {
    const near = await textNear(page, t);
    if (await isVisibleClickable(near)) {
      const bb = await near.boundingBox();
      const tag = await near.evaluate((el) => (el as HTMLElement).tagName).catch(() => 'UNKNOWN');
      const html = await near
        .evaluate((el) => (el as HTMLElement).outerHTML.slice(0, 300))
        .catch(() => '');
      console.log(`[Probe] via label "${t}" → <${tag}> bbox=${JSON.stringify(bb)} html≈ ${html}…`);
      const popup = await bindPopup(page, near);
      if (popup && (await popup.count().catch(() => 0)) > 0) {
        const opts = await firstOptions(popup, 10);
        console.log(`[Probe] popup options (sample):`, opts);
        await page.keyboard.press('Escape').catch(() => {});
        return near;
      }
    }
  }

  // 2) via placeholder
  for (const ph of spec.placeholderHints) {
    const loc = page.locator(`xpath=//*[@placeholder="${ph}"]`).first();
    if (await isVisibleClickable(loc)) {
      const bb = await loc.boundingBox();
      const tag = await loc.evaluate((el) => (el as HTMLElement).tagName).catch(() => 'UNKNOWN');
      const html = await loc
        .evaluate((el) => (el as HTMLElement).outerHTML.slice(0, 300))
        .catch(() => '');
      console.log(
        `[Probe] via placeholder "${ph}" → <${tag}> bbox=${JSON.stringify(bb)} html≈ ${html}…`,
      );
      const popup = await bindPopup(page, loc);
      if (popup && (await popup.count().catch(() => 0)) > 0) {
        const opts = await firstOptions(popup, 10);
        console.log(`[Probe] popup options (sample):`, opts);
        await page.keyboard.press('Escape').catch(() => {});
        return loc;
      }
    }
  }

  // 3) via id/class hints
  for (const h of spec.idHints) {
    const loc = page.locator(`[id*="${h}"], [class*="${h}"]`).first();
    if (await isVisibleClickable(loc)) {
      const bb = await loc.boundingBox();
      const tag = await loc.evaluate((el) => (el as HTMLElement).tagName).catch(() => 'UNKNOWN');
      const html = await loc
        .evaluate((el) => (el as HTMLElement).outerHTML.slice(0, 300))
        .catch(() => '');
      console.log(
        `[Probe] via id/class "${h}" → <${tag}> bbox=${JSON.stringify(bb)} html≈ ${html}…`,
      );
      const popup = await bindPopup(page, loc);
      if (popup && (await popup.count().catch(() => 0)) > 0) {
        const opts = await firstOptions(popup, 10);
        console.log(`[Probe] popup options (sample):`, opts);
        await page.keyboard.press('Escape').catch(() => {});
        return loc;
      }
    }
  }

  // 4) broad selector sweep
  for (const sel of candidateSelectors(spec)) {
    const loc = page.locator(sel).first();
    if (await isVisibleClickable(loc)) {
      const bb = await loc.boundingBox();
      const tag = await loc.evaluate((el) => (el as HTMLElement).tagName).catch(() => 'UNKNOWN');
      console.log(`[Probe] generic match "${sel}" → <${tag}> bbox=${JSON.stringify(bb)}`);
      const popup = await bindPopup(page, loc);
      if (popup && (await popup.count().catch(() => 0)) > 0) {
        const opts = await firstOptions(popup, 10);
        console.log(`[Probe] popup options (sample):`, opts);
        await page.keyboard.press('Escape').catch(() => {});
        return loc;
      }
    }
  }

  console.log(`[Probe] ${spec.name}: no clickable candidate with bbox discovered.`);
  return null;
}

// ---------- Main ----------

(async () => {
  console.log('[CG Filters] Headful probe starting…');
  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1366,900'],
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultTimeout(15000);

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await enforceMode(page);

  const frames = page.frames();
  for (const frame of frames) {
    console.log(`\n[Frame] Probing in frame: ${frame.name() || 'unnamed'} url: ${frame.url()}`);
    const found: Record<string, string | null> = {};
    for (const p of PROBES) {
      const node = await probeOne(frame, p);
      if (node) {
        const html = await node.evaluate((el) => (el as HTMLElement).outerHTML).catch(() => null);
        found[p.name] = html;
      } else {
        found[p.name] = null;
      }
    }

    console.log(`\n[Frame ${frame.name() || 'unnamed'}] === PROBE SUMMARY ===`);
    for (const k of Object.keys(found)) {
      const v = found[k];
      if (v) {
        const trimmed = v.replace(/\s+/g, ' ').slice(0, 500);
        console.log(`• ${k}: ${trimmed}…`);
      } else {
        console.log(`• ${k}: NOT FOUND`);
      }
    }
  }

  console.log('\n[CG Filters] Probe complete. Auto-closing in 5 seconds…');
  await pause(5000);
  await browser.close().catch(() => {});
  console.log('[CG Filters] Closed.');
})().catch((err) => {
  console.error('[CG Filters][Fatal]', err?.message || err);
  process.exit(1);
});
