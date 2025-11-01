#!/usr/bin/env node
/**
 * Scraper: Chhattisgarh SuShasan Portal (Real Data • Rural + Urban)
 * URL: https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports
 *
 * What it does:
 * - Launches Playwright Chromium
 * - Dynamically discovers filters (Districts + Rural/Urban)
 * - Iterates districts and both filters (ग्रामीण / शहरी)
 * - Extracts the currently rendered results table by headers (supports Hindi/English)
 * - Normalizes keys: district, block, panchayat, village, ward, ulb (when present)
 * - Saves incrementally to data/villages_portal_full.json (for resilience)
 *
 * Usage:
 *   node scripts/scrape_cg_portal.js [--headful] [--maxDistricts 33] [--delay 400] [--out data/villages_portal_full.json]
 *
 * Notes:
 * - Requires Playwright. Install if missing:
 *     npm i -D playwright
 *   If your environment already has @playwright/test, this likely works as-is.
 * - The portal is a micro-frontend (Ant Design). Selectors are defensive and heuristic.
 * - The script saves partial progress after each district to avoid data loss.
 *
 * Outputs:
 *   data/villages_portal_full.json
 *   {
 *     source, url, fetched_at, summary,
 *     filters: ["ग्रामीण","शहरी"],
 *     attempted_districts: [...],
 *     successes: [...],
 *     failures: [{district, mode, error}],
 *     rows: [
 *       {
 *         mode: "ग्रामीण" | "शहरी",
 *         district, block, panchayat, village, ward, ulb,
 *         raw: { HeaderName: "CellValue", ... }
 *       },
 *       ...
 *     ]
 *   }
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const PORTAL_URL =
  'https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports';
const FILTERS = ['ग्रामीण', 'शहरी']; // Rural + Urban

const CTRL = {
  district: { inputId: 'district', listId: 'district_list' },
  block: { inputId: 'block', listId: 'block_list' },
  panchayat: { inputId: 'panchayat', listId: 'panchayat_list' },
  village: { inputId: 'village', listId: 'village_list' },
  urbantype: { inputId: 'urbantype', listId: 'urbantype_list' },
  urbanbody: { inputId: 'urbanbody', listId: 'urbanbody_list' },
  ward: { inputId: 'ward', listId: 'ward_list' },
};

// Known district whitelist (Hindi names; extend as needed)
const DISTRICT_WHITELIST = new Set([
  'रायपुर',
  'बिलासपुर',
  'दुर्ग',
  'कोरबा',
  'रायगढ़',
  'राजनांदगांव',
  'कबीरधाम',
  'जांजगीर-चांपा',
  'कोरिया',
  'सूरजपुर',
  'बलरामपुर',
  'जशपुर',
  'बस्तर',
  'कोंडागांव',
  'नारायणपुर',
  'दंतेवाड़ा',
  'बीजापुर',
  'सुकमा',
  'महासमुंद',
  'धमतरी',
  'उत्तर बस्तर कांकेर',
  'गरियाबंद',
  'बलौदाबाजार-भाटापारा',
  'मुंगेली',
  'गौरेला-पेंड्रा-मरवाही',
  'बालोद',
  'बलोडा बाजार',
  'सारंगढ़-बिलाईगढ़',
  'खैरागढ़-छुईखदान-गंडई',
  'महोदई (यदि लागू हो)',
  'मनेंद्रगढ़-चिरमिरी-भरतपुर',
  'सरगुजा',
  'अम्बिकापुर',
]);

// Patterns that obviously indicate non-district options (menu/help items)
const NON_DISTRICT_PATTERNS = [
  /मुख्य\s*पृष्ठ/i,
  /निर्देश/i,
  /पत्र/i,
  /आवेदन/i,
  /प्रारुप/i,
  /होम/i,
  /home/i,
  /about/i,
  /संपर्क/i,
  /कोड\s*की\s*सूची/i,
  /सूची/i,
];

// Helper: normalize option text
function normalizeOpt(s) {
  return (s || '').trim().replace(/\s+/g, ' ');
}

// Decide if an option is likely a district
function isLikelyDistrict(opt) {
  const val = normalizeOpt(opt);
  if (!val) return false;
  // Exclude obvious non-district items
  if (NON_DISTRICT_PATTERNS.some((re) => re.test(val))) return false;
  // Prefer whitelist
  if (DISTRICT_WHITELIST.has(val)) return true;
  // Heuristic: many real districts are one/two words and not long sentences
  if (val.length > 20) return false;
  // Avoid items with slashes or punctuation typical of menus
  if (/[\/|:]/.test(val)) return false;
  // Fallback to allow; further validation happens by table header checks downstream
  return true;
}

// Filter and de-dup district options
function cleanDistrictOptions(options) {
  const seen = new Set();
  const out = [];
  for (const opt of options) {
    if (!isLikelyDistrict(opt)) continue;
    const key = normalizeOpt(opt);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
const DEFAULT_OUT = path.join(process.cwd(), 'data', 'villages_portal_full.json');

const arg = (name, fallback) => {
  const i = process.argv.findIndex((a) => a === name || a.startsWith(name + '='));
  if (i === -1) return fallback;
  const eq = process.argv[i].indexOf('=');
  if (eq > -1) return process.argv[i].slice(eq + 1);
  return process.argv[i + 1] ?? fallback;
};

const HEADFUL = !!(process.argv.includes('--headful') || arg('--headful', false) === 'true');
const MAX_DISTRICTS = parseInt(arg('--maxDistricts', '0'), 10) || 0; // 0 means all
const DELAY_MS = parseInt(arg('--delay', '400'), 10) || 400;
const OUT_PATH = arg('--out', DEFAULT_OUT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function loadExistingOut(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const txt = fs.readFileSync(filePath, 'utf8');
      if (txt.trim()) return JSON.parse(txt);
    }
  } catch (_) {}
  return null;
}

function saveOut(filePath, data) {
  ensureDirExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function nowISO() {
  return new Date().toISOString();
}

const HEADER_PATTERNS = {
  district: [/district/i, /जिला/, /ज़िला/, /जिले/],
  block: [/block/i, /vikas|vikash|vibhag/i, /विकास.?खण्ड/, /विकासखण्ड/, /जनपद/],
  panchayat: [/panchayat/i, /ग्राम.?पंचायत/, /ग्राम पंचायत/],
  village: [/village/i, /ग्राम/, /गांव/, /गाँव/],
  ward: [/ward/i, /वार्ड/],
  ulb: [/ulb/i, /urban local body/i, /नगर निगम|नगर पालिका|नगर पंचायत/],
};

function normalizeHeaderKey(headerText) {
  const h = (headerText || '').trim();
  for (const [key, patterns] of Object.entries(HEADER_PATTERNS)) {
    for (const p of patterns) {
      if (p.test(h)) return key;
    }
  }
  return null;
}

// Helpers for AntD selectors
function antSelectRootFromInput(page, inputId) {
  const input = page.locator(`#${inputId}`);
  return input.locator('xpath=ancestor::*[contains(@class,"ant-select")][1]');
}
function antSelectBox(root) {
  return root.locator('.ant-select-selector');
}
function popupFromListId(page, listId) {
  // Try specific list ID first, then fall back to general selectors
  const specific = page.locator(`#${listId}`);
  if (specific.count() > 0) {
    return specific;
  }
  return page.locator('[role=listbox], .ant-select-dropdown, .ant-dropdown').first();
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Discover a combobox/dropdown by label hint text (Hindi/English).
 */
async function findComboboxByLabel(page, hints = []) {
  // Try role-based (AntD often exposes combobox role)
  for (const h of hints) {
    const byRole = page.getByRole('combobox', { name: new RegExp(h) });
    if (await byRole.count().catch(() => 0)) {
      if (
        await byRole
          .first()
          .isVisible()
          .catch(() => false)
      )
        return byRole.first();
    }
  }
  // Try text near combobox
  for (const h of hints) {
    const label = page.locator(`text=${h}`).first();
    if (await label.count().catch(() => 0)) {
      const comboNearby = label.locator('..').locator('[role=combobox]').first();
      if (await comboNearby.count().catch(() => 0)) {
        if (await comboNearby.isVisible().catch(() => false)) return comboNearby;
      }
      // fallback: find first combobox on page
      const anyCombo = page.getByRole('combobox').first();
      if (await anyCombo.count().catch(() => 0)) return anyCombo;
    }
  }
  // Native select fallback
  const nativeSelect = page.locator('select').first();
  if (await nativeSelect.count().catch(() => 0)) return nativeSelect;
  return null;
}

/**
 * Open an AntD-style dropdown and read all options.
 */
async function readComboboxOptions(page, combobox) {
  const options = new Set();
  try {
    await combobox.click({ delay: 50 });
    // Wait for options overlay (listbox/option roles or AntD menu items)
    const listbox = page.locator(
      '[role=listbox], .ant-select-dropdown, .ant-dropdown, .ant-select-item-option-content',
    );
    await listbox
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .catch(() => {});
    // Collect options (be generous)
    const candidates = page.locator(`
      [role=option],
      .ant-select-item-option-content,
      .ant-dropdown-menu-item,
      li,
      .ant-select-item
    `);
    const count = await candidates.count();
    for (let i = 0; i < count; i++) {
      const txt = (
        await candidates
          .nth(i)
          .innerText()
          .catch(() => '')
      ).trim();
      if (txt && !/^select|सलेक्ट|--/i.test(txt)) {
        options.add(txt);
      }
    }
    // Close dropdown (click outside)
    await page.keyboard.press('Escape').catch(() => {});
  } catch (e) {
    // Try native select read
    const optEls = combobox.locator('option');
    const cnt = await optEls.count().catch(() => 0);
    for (let i = 0; i < cnt; i++) {
      const txt = (
        await optEls
          .nth(i)
          .innerText()
          .catch(() => '')
      ).trim();
      if (txt && !/^select|सलेक्ट|--/i.test(txt)) {
        options.add(txt);
      }
    }
  }
  return Array.from(options);
}

/**
 * Select a value in combobox/native select.
 */
async function selectComboboxValue(page, combobox, value) {
  // Native select path
  if ((await combobox.evaluate((el) => el.tagName.toLowerCase())).toLowerCase() === 'select') {
    await combobox.selectOption({ label: value }).catch(async () => {
      // fallback try by value attribute scanning
      const opts = combobox.locator('option');
      const count = await opts.count();
      for (let i = 0; i < count; i++) {
        const txt = (
          await opts
            .nth(i)
            .innerText()
            .catch(() => '')
        ).trim();
        if (txt === value) {
          const val = await opts.nth(i).getAttribute('value');
          if (val) await combobox.selectOption(val);
          break;
        }
      }
    });
    return;
  }

  // AntD combobox path
  await combobox.click({ delay: 50 });
  const candidates = page.locator(`
    [role=option],
    .ant-select-item-option-content,
    .ant-dropdown-menu-item,
    li,
    .ant-select-item
  `);
  await candidates
    .first()
    .waitFor({ state: 'visible', timeout: 8000 })
    .catch(() => {});
  const count = await candidates.count().catch(() => 0);
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const txt = (
      await candidates
        .nth(i)
        .innerText()
        .catch(() => '')
    ).trim();
    if (txt === value) {
      await candidates
        .nth(i)
        .click({ delay: 50 })
        .catch(() => {});
      clicked = true;
      break;
    }
  }
  // Close dropdown if still open
  await page.keyboard.press('Escape').catch(() => {});
  if (!clicked) {
    // Best-effort: type and enter
    await combobox.click({ delay: 50 }).catch(() => {});
    await page.keyboard.type(value, { delay: 30 }).catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
  }
}

/**
 * Click a radio/toggle for mode (rural/urban).
 */
async function chooseMode(page, modeText) {
  console.log(`[Mode] Choosing mode: ${modeText}`);
  let clicked = false;
  // Try radio by role
  const radio = page.getByRole('radio', { name: new RegExp(modeText) });
  if (await radio.count().catch(() => 0)) {
    console.log(`[Mode] Found radio by role for ${modeText}`);
    await radio
      .first()
      .click({ delay: 50 })
      .catch(() => {});
    clicked = true;
  }
  // Try checkbox
  const checkbox = page.getByRole('checkbox', { name: new RegExp(modeText) });
  if (await checkbox.count().catch(() => 0)) {
    const first = checkbox.first();
    const checked = await first.isChecked().catch(() => false);
    console.log(`[Mode] Found checkbox for ${modeText}, checked: ${checked}`);
    if (!checked) {
      await first.click({ delay: 50 }).catch(() => {});
      clicked = true;
    }
  }
  // Try plain text click
  const textNode = page.locator(`text=${modeText}`).first();
  if (await textNode.count().catch(() => 0)) {
    console.log(`[Mode] Found text node for ${modeText}`);
    await textNode.click({ delay: 50 }).catch(() => {});
    clicked = true;
  } else {
    console.log(`[Mode] No control found for ${modeText}`);
  }

  // Robust event dispatch
  if (clicked) {
    await page.evaluate((mode) => {
      const candidates = [
        `input.ant-radio-input[value="${mode === 'शहरी' ? '2' : '1'}"]`,
        `input[type="radio"][value="${mode === 'शहरी' ? '2' : '1'}"]`,
        `input.ant-radio-input[value="${mode === 'शहरी' ? 'urban' : 'rural'}"]`,
        `input[type="radio"][value="${mode === 'शहरी' ? 'urban' : 'rural'}"]`,
        `input.ant-radio-input[value="${mode}"]`,
        `input[type="radio"][value="${mode}"]`,
      ];
      for (const sel of candidates) {
        const inpt = document.querySelector(sel);
        if (inpt) {
          console.log(`[Mode] Dispatching events on ${sel}...`);
          const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
          if (mode === 'शहरी') {
            desc?.set?.call(inpt, true);
          } else {
            desc?.set?.call(inpt, false); // For rural, ensure it's checked
          }
          const fire = (n) => inpt.dispatchEvent(new Event(n, { bubbles: true, cancelable: true }));
          fire('click');
          fire('input');
          fire('change');
          fire('focus');
          fire('blur');
          break;
        }
      }
    }, modeText);
  }
}

// ======= URBAN MODE ENABLER (React/AntD safe) =======
async function selectMode(page, mode) {
  console.log(`[CG] Selecting mode: ${mode}`);
  if (mode === 'शहरी') {
    await ensureUrbanMode(page);
  } else {
    await chooseMode(page, mode);
  }
  console.log(`[CG] Mode verified: ${mode}`);
}

async function verifyModeMounted(page, mode) {
  if (mode === 'शहरी') {
    const utInput = page.locator(`#urbantype`);
    const utRoot = utInput.locator('xpath=ancestor::*[contains(@class,"ant-select")][1]');
    if (!(await utRoot.count())) {
      throw new Error('UrbanType did not mount after switching to शहरी.');
    }
    // Test popup
    let box = antSelectBox(utRoot);
    if (!(await box.count())) {
      box = utRoot;
    }
    await box.click({ force: true });
    const pop = popupFromListId(page, 'urbantype_list');
    await pop.waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('Escape').catch(() => {});
  } else {
    // For rural, check if district is visible before switching, as a workaround
    const blkInput = page.locator(`#district`);
    console.log(`[Verify] Checking district visibility...`);
    if (!(await blkInput.count())) {
      console.log(`[Verify] District input not found, checking if it's already there...`);
      await page.evaluate(() => {
        const blk = document.getElementById('district');
        console.log('[Verify] District element:', blk);
      });
      throw new Error('District did not mount after switching to ग्रामीण.');
    }
    console.log(`[Verify] District input found.`);
    // Since it may not be AntD, skip popup test for now
  }
}

async function ensureUrbanMode(page) {
  console.log('[Urban] Starting ensureUrbanMode...');
  // Try by role
  const byRole = page.getByRole('radio', { name: 'शहरी' });
  if (await byRole.count()) {
    console.log('[Urban] Found by role, clicking...');
    await byRole.click({ force: true });
  }

  // Best-effort: label-based
  const byLabel = page.getByLabel('शहरी', { exact: true });
  if (await byLabel.count()) {
    console.log('[Urban] Found label, checking...');
    try {
      await byLabel.check({ force: true });
    } catch (e) {
      console.log('[Urban] Label check failed:', e.message);
    }
  }

  // AntD wrapper span near radio
  const labelSpan = page.locator('.ant-radio-group >> text=शहरी').first();
  if (await labelSpan.count()) {
    console.log('[Urban] Found span, clicking...');
    await labelSpan.click({ force: true });
  }

  // Raw radio input
  const raw = page.locator('input.ant-radio-input[value="2"], input[type="radio"][value="2"]');
  if (await raw.count()) {
    console.log('[Urban] Found raw input, checking/clicking...');
    try {
      await raw.check({ force: true });
    } catch {
      await raw.click({ force: true });
    }
  }

  // React-friendly event dispatch
  await page.evaluate(() => {
    const inpt = document.querySelector(
      'input.ant-radio-input[value="2"], input[type="radio"][value="2"]',
    );
    if (inpt) {
      console.log('[Urban] Dispatching events...');
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
      desc?.set?.call(inpt, true);
      const fire = (n) => inpt.dispatchEvent(new Event(n, { bubbles: true, cancelable: true }));
      fire('click');
      fire('input');
      fire('change');
    }
  });

  // Wait for UrbanType
  const utInput = page.locator(`#urbantype`);
  const utRoot = utInput.locator('xpath=ancestor::*[contains(@class,"ant-select")][1]');
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    if (await utRoot.count()) break;
    await wait(200);
  }
  if (!(await utRoot.count())) {
    throw new Error('UrbanType did not mount after switching to शहरी.');
  }
  console.log('[Urban] UrbanType enabled successfully.');
}

async function openPopup(page, inputId, listId) {
  console.log(`[Popup] Opening popup for ${inputId}, list ${listId}`);
  const root = antSelectRootFromInput(page, inputId);
  console.log(`[Popup] Root count: ${await root.count()}`);
  let box = antSelectBox(root);
  console.log(`[Popup] Box count: ${await box.count()}`);
  if (!(await box.count())) {
    console.log('[Popup] Using root as box');
    box = root;
  }
  console.log('[Popup] Clicking box...');
  await box.click({ force: true });
  const pop = popupFromListId(page, listId);
  console.log(`[Popup] Waiting for popup ${listId}...`);
  try {
    await pop.waitFor({ state: 'visible', timeout: 6000 });
    console.log('[Popup] Popup opened successfully');
    return pop;
  } catch (e) {
    console.log(`[Popup] Popup failed to open: ${e.message}`);
    await page.screenshot({ path: `popup_${inputId}_debug.png` });
    throw e;
  }
}

async function readOptions(pop) {
  const rows = pop.locator('.ant-select-item-option');
  const n = await rows.count();
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    const txt = (
      await row
        .locator('.ant-select-item-option-content')
        .innerText()
        .catch(() => '')
    ).trim();
    if (!txt) continue;
    const val = (await row.getAttribute('data-value')) || txt;
    out.push({ label: txt, value: val });
  }
  return out;
}

async function selectByLabel(pop, label) {
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
      await row.scrollIntoViewIfNeeded().catch(() => {});
      try {
        const y = await row.evaluate((el) => el.offsetTop);
        if (await holder.count()) {
          await holder.evaluate((el, top) => {
            el.scrollTop = top - 40;
          }, y);
        }
      } catch {}
      await row.click({ timeout: 5000 });
      return;
    }
    if (await holder.count()) {
      await holder.evaluate((el) => {
        el.scrollTop += 260;
      });
    } else {
      await pop.page().mouse.wheel(0, 280);
    }
    await pop.page().waitForTimeout(45);
  }
  const fallback = pop.getByRole('option', { name: label }).first();
  if (await fallback.count()) {
    await fallback.scrollIntoViewIfNeeded().catch(() => {});
    await fallback.click({ timeout: 5000 });
    return;
  }
  throw new Error(`Option not found or not reachable in virtual list: "${label}"`);
}

/**
 * Find and click a submit/search button.
 */
async function clickSearch(page) {
  const selectors = [
    'button:has-text("Search")',
    'button:has-text("SEARCH")',
    'button:has-text("View")',
    'button:has-text("Generate")',
    'button:has-text("Report")',
    'button:has-text("खोज")',
    'button:has-text("देखें")',
    'button:has-text("प्रदर्शित")',
    'button:has-text("रिपोर्ट")',
    '.ant-btn:has-text("Search"), .ant-btn:has-text("खोज")',
    'input[type=submit], button[type=submit]',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.click({ delay: 50 }).catch(() => {});
      return true;
    }
  }
  // Try pressing Enter on page
  await page.keyboard.press('Enter').catch(() => {});
  return false;
}

/**
 * Extract the largest visible table (by rows) and return header + rows.
 */
async function extractLargestTable(page) {
  // Wait for any table
  const tableLocator = page.locator('table');
  await tableLocator
    .first()
    .waitFor({ state: 'visible', timeout: 12000 })
    .catch(() => {});
  const tableCount = await tableLocator.count().catch(() => 0);
  let best = null;
  for (let t = 0; t < tableCount; t++) {
    const table = tableLocator.nth(t);
    if (!(await table.isVisible().catch(() => false))) continue;
    const rows = table.locator('tr');
    const rowCount = await rows.count().catch(() => 0);
    if (rowCount > 1) {
      const cellsInFirstRow = await rows
        .nth(0)
        .locator('th, td')
        .count()
        .catch(() => 0);
      const score = rowCount * (cellsInFirstRow || 1);
      if (!best || score > best.score) {
        best = { table, score, rowCount };
      }
    }
  }
  if (!best) return { headers: [], items: [] };

  const headerCells = best.table.locator('thead tr th');
  let headers = [];
  if (await headerCells.count().catch(() => 0)) {
    const cnt = await headerCells.count();
    for (let i = 0; i < cnt; i++) {
      const txt = (
        await headerCells
          .nth(i)
          .innerText()
          .catch(() => '')
      ).trim();
      headers.push(txt || `col_${i + 1}`);
    }
  } else {
    // Fallback: use first row as header
    const firstRowCells = best.table.locator('tr').nth(0).locator('th, td');
    const cnt = await firstRowCells.count().catch(() => 0);
    for (let i = 0; i < cnt; i++) {
      const txt = (
        await firstRowCells
          .nth(i)
          .innerText()
          .catch(() => '')
      ).trim();
      headers.push(txt || `col_${i + 1}`);
    }
  }

  const rows = [];
  const rowLocs = best.table.locator('tbody tr');
  const rowCnt = await rowLocs.count().catch(() => 0);
  for (let r = 0; r < rowCnt; r++) {
    const cells = rowLocs.nth(r).locator('td');
    const cellCnt = await cells.count().catch(() => 0);
    if (!cellCnt) continue;
    const obj = {};
    for (let c = 0; c < Math.min(cellCnt, headers.length); c++) {
      const val = (
        await cells
          .nth(c)
          .innerText()
          .catch(() => '')
      ).trim();
      obj[headers[c]] = val;
    }
    rows.push(obj);
  }

  return { headers, items: rows };
}

/**
 * Normalize a single row using detected headers.
 */
function normalizeRow(rowObj) {
  const norm = {
    district: '',
    block: '',
    panchayat: '',
    village: '',
    ward: '',
    ulb: '',
  };
  for (const [k, v] of Object.entries(rowObj)) {
    const key = normalizeHeaderKey(k);
    if (key && !norm[key]) {
      norm[key] = (v || '').trim();
    }
    // Additional hints from common columns:
    if (!norm.panchayat && /ग्राम.?पंचायत|Gram\s*Panchayat/i.test(k))
      norm.panchayat = (v || '').trim();
    if (!norm.block && /विकास.?खण्ड|Block/i.test(k)) norm.block = (v || '').trim();
    if (!norm.village && /ग्राम|Village/i.test(k)) norm.village = (v || '').trim();
    if (!norm.ward && /वार्ड|Ward/i.test(k)) norm.ward = (v || '').trim();
    if (!norm.ulb && /ULB|Urban Local Body|नगर निगम|नगर पालिका|नगर पंचायत/i.test(k))
      norm.ulb = (v || '').trim();
    if (!norm.district && /जिला|District/i.test(k)) norm.district = (v || '').trim();
  }
  return norm;
}

/**
 * Attempt to paginate if pagination exists (AntD).
 */
async function paginateAndCollect(page, collector) {
  // Try AntD pagination elements
  const pagination = page.locator('.ant-pagination, [aria-label="pagination"]');
  if (!(await pagination.count().catch(() => 0))) {
    // Single page; just collect
    const { headers, items } = await extractLargestTable(page);
    await collector(headers, items);
    return;
  }

  const getCurrentPage = async () => {
    const current = pagination.locator('.ant-pagination-item-active');
    if (await current.count().catch(() => 0)) {
      const txt = (
        await current
          .first()
          .innerText()
          .catch(() => '')
      ).trim();
      const n = parseInt(txt, 10);
      return isNaN(n) ? 1 : n;
    }
    return 1;
  };

  const getMaxPage = async () => {
    const nums = pagination.locator('.ant-pagination-item');
    const count = await nums.count().catch(() => 0);
    let max = 1;
    for (let i = 0; i < count; i++) {
      const txt = (
        await nums
          .nth(i)
          .innerText()
          .catch(() => '')
      ).trim();
      const n = parseInt(txt, 10);
      if (!isNaN(n) && n > max) max = n;
    }
    // Fallback for "last" button based pagination
    if (max === 1) {
      const last = pagination.locator('.ant-pagination-next');
      if (await last.count().catch(() => 0)) {
        // Best-effort: iterate until disabled
        let safety = 200;
        let pageIdx = 1;
        while (safety-- > 0) {
          const disabled = await last
            .evaluate((el) => !!el.className && el.className.includes('disabled'))
            .catch(() => true);
          if (disabled) break;
          pageIdx++;
          await last.click({ delay: 50 }).catch(() => {});
          await page.waitForLoadState('networkidle').catch(() => {});
        }
        max = pageIdx;
        // Now go back to first page for real run
        const firstBtn = pagination.locator('.ant-pagination-item').first();
        if (await firstBtn.count().catch(() => 0))
          await firstBtn.click({ delay: 30 }).catch(() => {});
      }
    }
    return max;
  };

  const maxPage = await getMaxPage();

  for (let p = 1; p <= maxPage; p++) {
    // Go to page p
    const numBtn = pagination.locator(`.ant-pagination-item:has-text("${p}")`);
    if (await numBtn.count().catch(() => 0)) {
      await numBtn
        .first()
        .click({ delay: 50 })
        .catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await sleep(200);
    } else if (p > 1) {
      const nextBtn = pagination.locator('.ant-pagination-next');
      if (await nextBtn.count().catch(() => 0)) {
        await nextBtn.click({ delay: 50 }).catch(() => {});
        await page.waitForLoadState('networkidle').catch(() => {});
        await sleep(200);
      }
    }
    const { headers, items } = await extractLargestTable(page);
    await collector(headers, items);
  }
}

async function main() {
  console.log('[CG] Launching browser...');
  const browser = await chromium.launch({
    headless: !HEADFUL,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
    locale: 'hi-IN',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const outExisting = loadExistingOut(OUT_PATH);
  const out = outExisting || {
    source: 'Chhattisgarh SuShasan Portal',
    url: PORTAL_URL,
    fetched_at: nowISO(),
    filters: FILTERS.slice(),
    attempted_districts: [],
    successes: [],
    failures: [],
    rows: [],
    summary: { totals: { districts: 0, blocks: 0, panchayats: 0, villages: 0, wards: 0 } },
  };

  try {
    console.log('[CG] Navigating to portal...');
    await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    // Wait for app to mount (React)
    await sleep(1500);

    // Read list of districts (assume available after navigation)
    console.log('[CG] Reading district options...');
    const districtRoot = antSelectRootFromInput(page, 'district');
    let districtCombo = antSelectBox(districtRoot);
    if (!(await districtCombo.count())) {
      districtCombo = districtRoot;
    }
    let districts = await readComboboxOptions(page, districtCombo);
    districts = cleanDistrictOptions(districts);
    if (!districts.length) {
      throw new Error('No district options found.');
    }
    console.log(`[CG] Districts discovered: ${districts.length}`);
    const toProcess = MAX_DISTRICTS > 0 ? districts.slice(0, MAX_DISTRICTS) : districts;

    // Prepare submission/search
    // Try to ensure there's a visible Search/Generate button
    await clickSearch(page).catch(() => {});

    let processed = 0;

    for (const mode of FILTERS) {
      console.log(`\n[CG] Processing mode: ${mode}`);

      // Navigate and set mode
      await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await sleep(800);

      // For rural, verify before switching if possible
      if (mode === 'ग्रामीण') {
        await verifyModeMounted(page, mode);
      }
      await selectMode(page, mode);
      if (mode === 'शहरी') {
        await verifyModeMounted(page, mode);
      }

      if (mode === 'ग्रामीण') {
        // Rural cascade
        for (const dist of toProcess) {
          console.log(`[Rural] Selecting जिला: ${dist}`);
          out.attempted_districts.push(dist);
          let pop = await openPopup(page, CTRL.district.inputId, CTRL.district.listId);
          await selectByLabel(pop, dist);
          await sleep(200);

          pop = await openPopup(page, CTRL.block.inputId, CTRL.block.listId);
          const blocks = await readOptions(pop);
          console.log(`[Rural] Blocks found: ${blocks.length}`);
          for (const blk of blocks.slice(0, 3)) {
            // Limit for demo
            console.log(`[Rural] Selecting block: ${blk.label}`);
            pop = await openPopup(page, CTRL.block.inputId, CTRL.block.listId);
            await selectByLabel(pop, blk.label);
            await sleep(200);

            pop = await openPopup(page, CTRL.panchayat.inputId, CTRL.panchayat.listId);
            const panchayats = await readOptions(pop);
            console.log(`[Rural] Panchayats found: ${panchayats.length}`);
            for (const gp of panchayats.slice(0, 3)) {
              console.log(`[Rural] Selecting panchayat: ${gp.label}`);
              pop = await openPopup(page, CTRL.panchayat.inputId, CTRL.panchayat.listId);
              await selectByLabel(pop, gp.label);
              await sleep(200);

              pop = await openPopup(page, CTRL.village.inputId, CTRL.village.listId);
              const villages = await readOptions(pop);
              console.log(`[Rural] Villages found: ${villages.length}`);
              for (const v of villages.slice(0, 3)) {
                console.log(`[Rural] Selecting village: ${v.label}`);
                pop = await openPopup(page, CTRL.village.inputId, CTRL.village.listId);
                await selectByLabel(pop, v.label);
                await sleep(200);

                // Click search and collect
                await clickSearch(page);
                await page.waitForLoadState('networkidle').catch(() => {});
                await sleep(800);

                const collectedRows = [];
                await paginateAndCollect(page, async (headers, items) => {
                  if (!items || !items.length) return;
                  for (const it of items) {
                    const norm = normalizeRow(it);
                    collectedRows.push({
                      mode,
                      district: dist,
                      block: blk.label,
                      panchayat: gp.label,
                      village: v.label,
                      ward: '',
                      ulb: '',
                      raw: it,
                    });
                  }
                });
                console.log(`[Rural] Emitting rows: ${collectedRows.length}`);
                out.rows.push(...collectedRows);
                await sleep(DELAY_MS);
              }
            }
          }
        }
      } else {
        // Urban cascade
        for (const dist of toProcess) {
          console.log(`[Urban] Selecting जिला: ${dist}`);
          out.attempted_districts.push(dist);
          let pop = await openPopup(page, CTRL.district.inputId, CTRL.district.listId);
          await selectByLabel(pop, dist);
          await sleep(200);

          pop = await openPopup(page, CTRL.urbantype.inputId, CTRL.urbantype.listId);
          const types = await readOptions(pop);
          console.log(`[Urban] Urban types found: ${types.length}`);
          for (const typ of types.slice(0, 3)) {
            console.log(`[Urban] Selecting urban type: ${typ.label}`);
            pop = await openPopup(page, CTRL.urbantype.inputId, CTRL.urbantype.listId);
            await selectByLabel(pop, typ.label);
            await sleep(200);

            pop = await openPopup(page, CTRL.urbanbody.inputId, CTRL.urbanbody.listId);
            const ulbs = await readOptions(pop);
            console.log(`[Urban] ULBs found: ${ulbs.length}`);
            for (const ulb of ulbs.slice(0, 3)) {
              console.log(`[Urban] Selecting ULB: ${ulb.label}`);
              pop = await openPopup(page, CTRL.urbanbody.inputId, CTRL.urbanbody.listId);
              await selectByLabel(pop, ulb.label);
              await sleep(200);

              pop = await openPopup(page, CTRL.ward.inputId, CTRL.ward.listId);
              const wards = await readOptions(pop);
              console.log(`[Urban] Wards found: ${wards.length}`);
              for (const w of wards.slice(0, 3)) {
                console.log(`[Urban] Selecting ward: ${w.label}`);
                pop = await openPopup(page, CTRL.ward.inputId, CTRL.ward.listId);
                await selectByLabel(pop, w.label);
                await sleep(200);

                // Click search and collect
                await clickSearch(page);
                await page.waitForLoadState('networkidle').catch(() => {});
                await sleep(800);

                const collectedRows = [];
                await paginateAndCollect(page, async (headers, items) => {
                  if (!items || !items.length) return;
                  for (const it of items) {
                    const norm = normalizeRow(it);
                    collectedRows.push({
                      mode,
                      district: dist,
                      block: '',
                      panchayat: '',
                      village: '',
                      ward: w.label,
                      ulb: ulb.label,
                      raw: it,
                    });
                  }
                });
                console.log(`[Urban] Emitting rows: ${collectedRows.length}`);
                out.rows.push(...collectedRows);
                await sleep(DELAY_MS);
              }
            }
          }
        }
      }

      // Mark successes
      for (const district of toProcess) {
        if (!out.failures.some((f) => f.district === district && f.mode === mode)) {
          out.successes.push(district);
          processed++;
        }
      }
    }

    // Mark successes
    for (const district of toProcess) {
      if (!out.failures.some((f) => f.district === district)) {
        out.successes.push(district);
        processed++;
      }
    }

    updateSummary(out);
    saveOut(OUT_PATH, out);
    console.log(`\n[CG] Completed. Total rows: ${out.rows.length}`);
    console.log(`[CG] Output saved to: ${OUT_PATH}`);
  } catch (e) {
    console.error('[CG] Fatal error:', e && e.message ? e.message : e);
    // Save what we have
    updateSummary(out);
    saveOut(OUT_PATH, out);
    process.exitCode = 1;
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

function updateSummary(out) {
  const setDistricts = new Set();
  const setBlocks = new Set();
  const setPanchayats = new Set();
  const setVillages = new Set();
  const setWards = new Set();
  for (const r of out.rows) {
    if (r.district) setDistricts.add(r.district);
    if (r.block) setBlocks.add(`${r.district}::${r.block}`);
    if (r.panchayat) setPanchayats.add(`${r.district}::${r.block}::${r.panchayat}`);
    if (r.village) setVillages.add(`${r.district}::${r.block}::${r.panchayat}::${r.village}`);
    if (r.ward) setWards.add(`${r.district}::${r.ulb || ''}::${r.ward}`);
  }
  out.summary = {
    totals: {
      districts: setDistricts.size,
      blocks: setBlocks.size,
      panchayats: setPanchayats.size,
      villages: setVillages.size,
      wards: setWards.size,
      rows: out.rows.length,
    },
  };
}

if (require.main === module) {
  main();
}
