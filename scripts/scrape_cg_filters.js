#!/usr/bin/env node
/**
 * Chhattisgarh SuShasan — Filter Enumerator (Rural/Urban) with Four Variants
 * URL: https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports
 *
 * Purpose:
 *  - Stay strictly on the filter page.
 *  - Enumerate ONLY the filter dropdowns (no navigation to table/content).
 *  - Build hierarchical data for:
 *      Rural (ग्रामीण): District → Block (विकासखण्ड/जनपद) → Gram Panchayat (ग्राम पंचायत) → Village (ग्राम)
 *      Urban (शहरी):   District → ULB (नगर निगम/नगर पालिका/नगर पंचायत) → Ward (वार्ड)
 *  - For every name-like field, persist four variants: hindi, nukta_hindi, english, transliteration.
 *  - Save output to JSON.
 *
 * Requirements:
 *  - Node.js >= 18
 *  - Playwright Chromium installed (dev dependency present via @playwright/test).
 *  - Install browsers once: `npx playwright install chromium`
 *
 * Usage:
 *  - node scripts/scrape_cg_filters.js
 *  - node scripts/scrape_cg_filters.js --mode both --maxDistricts 3 --out data/cg_filters_hierarchy.json --headful true
 *
 * Flags:
 *  --mode           rural | urban | both           (default both)
 *  --maxDistricts   number                           limit districts for quick test
 *  --maxBlocks      number                           limit blocks per district (rural)
 *  --maxPanchayats  number                           limit panchayats per block (rural)
 *  --maxVillages    number                           limit villages per panchayat (rural)
 *  --maxULBs        number                           limit ULBs per district (urban)
 *  --maxWards       number                           limit wards per ULB (urban)
 *  --delay          ms                               polite delay between interactions (default 250)
 *  --headful        true/false                       run browser headful (default false)
 *  --out            path                             output JSON (default data/cg_filters_hierarchy.json)
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const PORTAL_URL =
  'https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports';

const arg = (name, fallback) => {
  const i = process.argv.findIndex((a) => a === name || a.startsWith(name + '='));
  if (i === -1) return fallback;
  const eq = process.argv[i].indexOf('=');
  if (eq > -1) return process.argv[i].slice(eq + 1);
  return process.argv[i + 1] ?? fallback;
};

const MODE = (arg('--mode', 'both') || 'both').toLowerCase(); // rural | urban | both
const MAX_DISTRICTS = parseInt(arg('--maxDistricts', '0'), 10) || 0;
const MAX_BLOCKS = parseInt(arg('--maxBlocks', '0'), 10) || 0;
const MAX_PANCHAYATS = parseInt(arg('--maxPanchayats', '0'), 10) || 0;
const MAX_VILLAGES = parseInt(arg('--maxVillages', '0'), 10) || 0;
const MAX_ULBS = parseInt(arg('--maxULBs', '0'), 10) || 0;
const MAX_WARDS = parseInt(arg('--maxWards', '0'), 10) || 0;

const DELAY_MS = parseInt(arg('--delay', '250'), 10) || 250;
const HEADFUL = String(arg('--headful', 'false')).toLowerCase() === 'true';
const OUT_PATH = arg('--out', path.join(process.cwd(), 'data', 'cg_filters_hierarchy.json'));
const DEBUG = String(arg('--debug', 'false')).toLowerCase() === 'true';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowISO = () => new Date().toISOString();
const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });

/**
 * Deterministic Devanagari → Roman transliteration (ASCII-safe and simple).
 * - Not linguistically perfect; intended as consistent fallback.
 */
function transliterateHindiBasic(input = '') {
  // Basic mapping (subset) for Devanagari to ASCII-roman; extend as needed.
  const map = {
    अ: 'a',
    आ: 'aa',
    इ: 'i',
    ई: 'ii',
    उ: 'u',
    ऊ: 'uu',
    ऋ: 'ri',
    ए: 'e',
    ऐ: 'ai',
    ओ: 'o',
    औ: 'au',
    क: 'ka',
    ख: 'kha',
    ग: 'ga',
    घ: 'gha',
    ङ: 'nga',
    च: 'cha',
    छ: 'chha',
    ज: 'ja',
    झ: 'jha',
    ञ: 'nya',
    ट: 'ta',
    ठ: 'tha',
    ड: 'da',
    ढ: 'dha',
    ण: 'na',
    त: 'ta',
    थ: 'tha',
    द: 'da',
    ध: 'dha',
    न: 'na',
    प: 'pa',
    फ: 'pha',
    ब: 'ba',
    भ: 'bha',
    म: 'ma',
    य: 'ya',
    र: 'ra',
    ल: 'la',
    व: 'va',
    श: 'sha',
    ष: 'sha',
    स: 'sa',
    ह: 'ha',
    ञ्: 'ny',
    क्ष: 'ksha',
    त्र: 'tra',
    ज्ञ: 'gya',
    '्': '', // halant (virama)
    'ा': 'a',
    'ि': 'i',
    'ी': 'i',
    'ु': 'u',
    'ू': 'u',
    'े': 'e',
    'ै': 'ai',
    'ो': 'o',
    'ौ': 'au',
    'ं': 'm',
    'ँ': 'm',
    'ः': 'h',
    '़': '', // nukta (we keep base)
    '’': '',
    ʼ: '',
    '—': '-',
    '–': '-',
  };
  // Handle consonant+matra roughly by sequential replacement
  let out = '';
  for (const ch of String(input)) {
    out += map[ch] ?? ch;
  }
  // Collapse duplicates and tidy spaces
  return out.replace(/\s+/g, ' ').replace(/-+/g, '-').trim();
}

function titleCaseAscii(s = '') {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

/**
 * Four-variant generator
 */
function fourVariants(hindiText = '') {
  const hindi = String(hindiText || '').trim();
  const nukta_hindi = hindi; // preserve original; nukta-aware normalization can be added later
  const transliteration = transliterateHindiBasic(hindi);
  const english = titleCaseAscii(transliteration);
  return { hindi, nukta_hindi, english, transliteration };
}

/**
 * Selector helpers — find labeled combobox/select and read options.
 * We avoid navigating away; only interact with form controls.
 */

/**
 * Heuristic: score an options list for likelihood of being a District dropdown.
 * Prefers short, clean option texts and boosts known district names.
 */
function scoreOptionsAsDistrict(opts = []) {
  let score = 0;
  const known = new Set([
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
    'कांकेर',
    'गरियाबंद',
    'बलौदाबाजार-भाटापारा',
    'मुंगेली',
    'गौरेला-पेंड्रा-मरवाही',
    'बालोद',
    'खैरागढ़-छुईखदान-गंडई',
    'सारंगढ़-बिलाईगढ़',
    'मनेंद्रगढ़-चिरमिरी-भरतपुर',
    'सरगुजा',
    'अम्बिकापुर',
  ]);
  for (const raw of opts) {
    const s = String(raw || '').trim();
    if (!s) continue;
    if (/^select|--|सलेक्ट/i.test(s)) continue;
    if (/[|/:]/.test(s)) continue;
    if (s.length <= 18) score += 2;
    if (known.has(s)) score += 5;
  }
  return score;
}
async function getComboboxByLabelInScope(page, scope, labelHints) {
  // Try role-based labels within the given scope (Page or Frame)
  for (const hint of labelHints) {
    const byRole = scope.getByRole('combobox', { name: new RegExp(hint) });
    if ((await byRole.count().catch(() => 0)) > 0) {
      const el = byRole.first();
      if (await el.isVisible().catch(() => false)) return el;
    }
  }
  // Fallback: nearest combobox to a text label within the scope — constrain to filter section
  for (const hint of labelHints) {
    const label = scope.locator(`text=${hint}`).first();
    if ((await label.count().catch(() => 0)) > 0) {
      // Prefer nearest ancestor that looks like the filter container
      const container = label.locator(
        'xpath=ancestor::*[self::form or self::fieldset or contains(@class,"filter") or contains(@class,"filters") or contains(@class,"ant-form")][1]',
      );
      const hasContainer = (await container.count().catch(() => 0)) > 0;
      const searchRoot = hasContainer ? container.first() : label.locator('..').first();
      // Prefer a following sibling control after the label within the filter container
      const comboAfter = label.locator('xpath=following::*[self::select or @role="combobox"][1]');
      if ((await comboAfter.count().catch(() => 0)) > 0) return comboAfter;
      const comboNearby = searchRoot.locator('[role=combobox], select').first();
      if ((await comboNearby.count().catch(() => 0)) > 0) return comboNearby;
    }
  }
  // Placeholder-based: try controls with matching placeholder text within the scope
  for (const hint of labelHints) {
    const ph = scope.locator(`[placeholder*="${hint}"]`).first();
    if ((await ph.count().catch(() => 0)) > 0) {
      const phContainer = ph.locator(
        'xpath=ancestor::*[self::form or self::fieldset or contains(@class,"filter") or contains(@class,"filters") or contains(@class,"ant-form") or self::div][1]',
      );
      const hasPhContainer = (await phContainer.count().catch(() => 0)) > 0;
      const phRoot = hasPhContainer ? phContainer.first() : ph;
      const phCombo = phRoot.locator('[role=combobox], select').first();
      if ((await phCombo.count().catch(() => 0)) > 0) return phCombo;
      // As a last resort, return the placeholder element itself (caller will handle)
      return ph;
    }
  }
  // Generic fallback: scan all selects/comboboxes and pick the one whose options look like districts
  // Limit dropdown candidates to the filter section if present
  const filterContainer = scope
    .locator('form, fieldset, #filter, .filter, .filters, .ant-form')
    .first();
  const containerCount = await filterContainer.count().catch(() => 0);
  const candidates =
    containerCount > 0
      ? filterContainer.locator('[role=combobox], select')
      : scope.locator('[role=combobox], select');
  const count = await candidates.count().catch(() => 0);
  let bestEl = null;
  let bestScore = -1;

  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    let opts = [];
    try {
      const tag = await el.evaluate((e) => e.tagName);
      if (String(tag).toLowerCase() === 'select') {
        const optEls = el.locator('option');
        const c = await optEls.count().catch(() => 0);
        for (let k = 0; k < c; k++) {
          const t = (
            await optEls
              .nth(k)
              .innerText()
              .catch(() => '')
          ).trim();
          if (t && !/^select|--|सलेक्ट/i.test(t)) opts.push(t);
        }
      } else {
        await el.click({ delay: 20 }).catch(() => {});
        const optNodes = scope.locator(
          '[role=listbox] [role=option], .ant-select-item-option-content, .ant-select-item',
        );
        const c = await optNodes.count().catch(() => 0);
        for (let k = 0; k < Math.min(c, 200); k++) {
          const t = (
            await optNodes
              .nth(k)
              .innerText()
              .catch(() => '')
          ).trim();
          if (t && !/^select|--|सलेक्ट/i.test(t)) opts.push(t);
        }
        // Use page keyboard to dismiss dropdown if available
        if (page && page.keyboard) {
          await page.keyboard.press('Escape').catch(() => {});
        }
      }
    } catch (_) {}

    const unique = Array.from(new Set(opts));
    const menuBad = unique.filter((t) =>
      /मुख्य\s*पृष्ठ|निर्देश|पत्र|आवेदन|प्रारुप|home|about|contact|search|सर्च|खोज|संपर्क|कोड|सूची|मीडिया|कवरेज|गैलरी|डाउनलोड|प्रचार\s*सामग्री|रिपोर्ट/i.test(
        t,
      ),
    ).length;
    const withSlash = unique.filter((t) => /[\/|:]/.test(t)).length;
    const longOnes = unique.filter((t) => t.length > 20).length;
    const hintsStr = Array.isArray(labelHints)
      ? labelHints.join('|').toLowerCase()
      : String(labelHints || '').toLowerCase();
    const isDistrict = /जिला|district|जिले/.test(hintsStr);
    const districtBoost = scoreOptionsAsDistrict(unique);
    let score =
      unique.length - menuBad - withSlash - longOnes + (isDistrict ? districtBoost * 3 : 0);

    if (unique.length >= 10 && score > bestScore) {
      bestScore = score;
      bestEl = el;
    }
  }

  if (bestEl) return bestEl;
  return null;
}

async function getComboboxByLabel(page, labelHints) {
  // If we have a known filter root, prefer it first
  if (FILTER_ROOT) {
    const inRoot = await getComboboxByLabelInScope(page, FILTER_ROOT, labelHints);
    if (inRoot) return inRoot;
  }
  // Try in main page
  const inPage = await getComboboxByLabelInScope(page, page, labelHints);
  if (inPage) return inPage;

  // Try in all iframes
  const frames = page.frames();
  for (const frame of frames) {
    const found = await getComboboxByLabelInScope(page, frame, labelHints);
    if (found) return found;
  }

  return null;
}

function isSelectTag(elTag) {
  return String(elTag || '').toLowerCase() === 'select';
}

async function readOptionsFromCombobox(page, combo) {
  const options = new Set();
  const short = 2000;
  try {
    const handle = await combo.elementHandle({ timeout: short }).catch(() => null);
    if (!handle) return [];
    const tag = await handle.evaluate((el) => el.tagName).catch(() => '');

    if (isSelectTag(tag)) {
      // Click to ensure options load (many UIs populate options on focus/click)
      await combo.click({ delay: 20 }).catch(() => {});
      let opts = combo.locator('option');
      let prev = await opts.count().catch(() => 0);
      // Poll until options count increases or reaches a reasonable minimum
      const startTs = Date.now();
      const timeoutMs = 5000;
      while (Date.now() - startTs < timeoutMs) {
        opts = combo.locator('option');
        const cur = await opts.count().catch(() => 0);
        if (cur >= Math.max(prev, 2)) break;
        await sleep(200);
      }
      const cnt = await opts.count().catch(() => 0);
      for (let i = 0; i < cnt; i++) {
        const txt = (
          await opts
            .nth(i)
            .innerText()
            .catch(() => '')
        ).trim();
        if (
          !txt ||
          /^select|--|सलेक्ट/i.test(txt) ||
          /मुख्य\s*पृष्ठ|निर्देश|पत्र|आवेदन|प्रारुप|home|about|contact|search|सर्च|खोज|संपर्क|कोड|सूची|मीडिया|कवरेज|गैलरी|डाउनलोड|प्रचार\s*सामग्री|रिपोर्ट/i.test(
            txt,
          ) ||
          /[\/|:]/.test(txt)
        )
          continue;
        options.add(txt);
      }
      return Array.from(options);
    }

    // AntD-like combobox path (popup-bound)
    const popup = await openAndBindPopupForControl(page, combo);
    const candidates = popup.locator(
      '[role=option], .ant-select-item-option-content, .ant-select-item',
    );
    const cnt = await candidates.count().catch(() => 0);
    for (let i = 0; i < cnt; i++) {
      const txt = (
        await candidates
          .nth(i)
          .innerText()
          .catch(() => '')
      ).trim();
      if (!isLikelyRealOption(txt)) continue;
      options.add(txt);
    }
    await page.keyboard.press('Escape').catch(() => {});
  } catch (_) {
    // last fallback — try simple innerText scan
    const opts = combo.locator('option');
    const cnt = await opts.count().catch(() => 0);
    for (let i = 0; i < cnt; i++) {
      const txt = (
        await opts
          .nth(i)
          .innerText()
          .catch(() => '')
      ).trim();
      if (
        !txt ||
        /^select|--|सलेक्ट/i.test(txt) ||
        /मुख्य\s*पृष्ठ|निर्देश|पत्र|आवेदन|प्रारुप|home|about|contact|संपर्क|कोड|सूची|मीडिया|कवरेज|गैलरी|डाउनलोड/i.test(
          txt,
        ) ||
        /[\/|:]/.test(txt)
      )
        continue;
      options.add(txt);
    }
  }
  return Array.from(options);
}

async function waitForOptions(page, combo, opts = {}) {
  const min = Math.max(0, opts.min ?? 2);
  const timeout = opts.timeout ?? 10000;
  const poll = opts.poll ?? 300;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const list = await readOptionsFromCombobox(page, combo);
      if (Array.isArray(list) && list.length >= min) return true;
    } catch (_) {}
    await sleep(poll);
  }
  return false;
}

async function waitEnabled(scope, el, opts = {}) {
  const timeout = opts.timeout ?? 10000;
  const poll = opts.poll ?? 200;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const disabledAttr = await el.getAttribute('disabled').catch(() => null);
      const ariaDisabled = await el.getAttribute('aria-disabled').catch(() => null);
      const isDisabled = disabledAttr !== null || ariaDisabled === 'true';
      if (!isDisabled) return true;
    } catch (_) {}
    await sleep(poll);
  }
  return false;
}

function isLikelyRealOption(txt = '') {
  const s = String(txt).trim();
  if (!s) return false;
  const badHints = [
    'छत्तीसगढ़ जनदर्शन',
    'छत्तीसगढ़ सीएमओ',
    'होम',
    'नीति',
    'policy',
    'login',
    'http',
    'https',
    '/',
    '|',
  ];
  if (badHints.some((h) => s.includes(h))) return false;
  return /^[\u0900-\u097F A-Za-z0-9 .()\-]{2,60}$/.test(s) || /^[A-Za-z0-9 .()\-]{2,60}$/.test(s);
}

async function openAndBindPopupForControl(page, control) {
  // Click the control and bind its popup (listbox) specifically to this control
  const before = await page
    .locator('[role="listbox"]:visible')
    .count()
    .catch(() => 0);
  const box = await control.boundingBox().catch(() => null);
  await control.click({ force: true }).catch(() => {});

  // 1) aria-controls linkage
  const ariaId = await control.getAttribute('aria-controls').catch(() => null);
  if (ariaId) {
    const popup = page.locator(`#${ariaId}:visible`);
    await popup
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {});
    if ((await popup.count().catch(() => 0)) > 0) return popup.first();
  }

  // 2) Nearest new visible listbox that overlaps/is closest
  await page.waitForTimeout(150).catch(() => {});
  const listboxes = page.locator('[role="listbox"]:visible');
  const cnt = await listboxes.count().catch(() => 0);
  let bestIdx = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < cnt; i++) {
    const lb = listboxes.nth(i);
    const bb = await lb.boundingBox().catch(() => null);
    if (!bb || !box) continue;
    const overlaps =
      bb.x < box.x + box.width &&
      bb.x + bb.width > box.x &&
      bb.y < box.y + box.height &&
      bb.y + bb.height > box.y;
    const centerDist = Math.hypot(
      bb.x + bb.width / 2 - (box.x + box.width / 2),
      bb.y + bb.height / 2 - (box.y + box.height / 2),
    );
    if (overlaps || centerDist < bestDist) {
      bestDist = centerDist;
      bestIdx = i;
    }
  }
  if (bestIdx >= 0) return listboxes.nth(bestIdx);

  // 3) Common alt popups
  const alt = page.locator(
    '.select2-results:visible, .MuiAutocomplete-popper:visible, .dropdown-menu.show:visible',
  );
  if ((await alt.count().catch(() => 0)) > 0) return alt.first();

  throw new Error('No popup detected for this control');
}

async function selectComboValue(page, combo, value) {
  const short = 2000;
  const handle = await combo.elementHandle({ timeout: short }).catch(() => null);
  if (!handle) return;
  const tag = await handle.evaluate((el) => el.tagName).catch(() => '');

  if (isSelectTag(tag)) {
    let did = false;
    // try by label
    await combo
      .selectOption({ label: value })
      .then(() => {
        did = true;
      })
      .catch(async () => {
        // try by exact value attribute
        const opts = combo.locator('option');
        const cnt = await opts.count().catch(() => 0);
        for (let i = 0; i < cnt; i++) {
          const txt = (
            await opts
              .nth(i)
              .innerText()
              .catch(() => '')
          ).trim();
          if (txt === value) {
            const valAttr = await opts.nth(i).getAttribute('value');
            if (valAttr) {
              await combo
                .selectOption(valAttr)
                .then(() => {
                  did = true;
                })
                .catch(() => {});
            }
            break;
          }
        }
      });
    // Dispatch input/change to trigger dependent dropdown repopulation
    await combo
      .evaluate((el) => {
        try {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } catch {}
      })
      .catch(() => {});
    return;
  }

  // AntD-like
  await combo.click({ delay: 30 }).catch(() => {});
  // Find nearest visible listbox to this combo and read only its options
  const listboxes = page.locator('[role=listbox]');
  await listboxes
    .first()
    .waitFor({ state: 'visible', timeout: short })
    .catch(() => {});
  const comboBox = await combo.boundingBox().catch(() => null);
  let bestIdx = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  const lbCount = await listboxes.count().catch(() => 0);
  for (let i = 0; i < lbCount; i++) {
    const lb = listboxes.nth(i);
    const bb = await lb.boundingBox().catch(() => null);
    if (!bb || !comboBox) continue;
    const dx = Math.max(
      0,
      Math.max(bb.x - (comboBox.x + comboBox.width), comboBox.x - (bb.x + bb.width)),
    );
    const dy = Math.max(
      0,
      Math.max(bb.y - (comboBox.y + comboBox.height), comboBox.y - (bb.y + bb.height)),
    );
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      bestIdx = i;
    }
  }
  const popup = bestIdx >= 0 ? listboxes.nth(bestIdx) : listboxes.first();
  const candidates = popup.locator(
    '[role=option], .ant-select-item-option-content, .ant-select-item',
  );
  const cnt = await candidates.count().catch(() => 0);
  for (let i = 0; i < cnt; i++) {
    const txt = (
      await candidates
        .nth(i)
        .innerText()
        .catch(() => '')
    ).trim();
    if (txt === value) {
      await candidates
        .nth(i)
        .click({ delay: 30 })
        .catch(() => {});
      break;
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
}

/**
 * Mode selection (Rural/Urban) — stay on filter page
 */
async function chooseMode(page, desired) {
  const ruralText = 'ग्रामीण';
  const urbanText = 'शहरी';
  const name = desired === 'rural' ? ruralText : urbanText;

  const radio = page.getByRole('radio', { name: new RegExp(name) });
  if ((await radio.count().catch(() => 0)) > 0) {
    await radio
      .first()
      .click({ delay: 30 })
      .catch(() => {});
    return true;
  }
  // fallback: click text
  const textNode = page.locator(`text=${name}`).first();
  if ((await textNode.count().catch(() => 0)) > 0) {
    await textNode.click({ delay: 30 }).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Labels used to identify filter dropdowns
 */
let FILTER_ROOT = null;

// Heuristic: find the filter root form/container using radios and the Search button
async function getFilterRootUsingAnchors(page, mode) {
  // Prefer container near the mode radio
  const modeText = mode === 'urban' ? 'शहरी' : 'ग्रामीण';
  const modeRadio = page.getByRole('radio', { name: new RegExp(modeText) }).first();
  if ((await modeRadio.count().catch(() => 0)) > 0) {
    const container = modeRadio.locator(
      'xpath=ancestor::*[self::form or self::fieldset or contains(@class,"filter") or contains(@class,"filters") or contains(@class,"ant-form") or contains(@class,"form")][1]',
    );
    if ((await container.count().catch(() => 0)) > 0) return container.first();
  }
  // Or container near the Search button
  const searchBtn = page.getByRole('button', { name: /search|सर्च|खोज/i }).first();
  if ((await searchBtn.count().catch(() => 0)) > 0) {
    const container = searchBtn.locator(
      'xpath=ancestor::*[self::form or self::fieldset or contains(@class,"filter") or contains(@class,"filters") or contains(@class,"ant-form") or contains(@class,"form")][1]',
    );
    if ((await container.count().catch(() => 0)) > 0) return container.first();
  }
  return null;
}

async function getFilterRoot(page, labelHints) {
  // Try to find a nearby form-like container from a label or placeholder
  const hints = Array.isArray(labelHints) ? labelHints : [String(labelHints || '')];
  for (const hint of hints) {
    const lbl = page.locator(`text=${hint}`).first();
    if ((await lbl.count().catch(() => 0)) > 0) {
      const container = lbl.locator(
        'xpath=ancestor::*[self::form or self::fieldset or contains(@class,"filter") or contains(@class,"filters") or contains(@class,"ant-form") or contains(@class,"form")][1]',
      );
      if ((await container.count().catch(() => 0)) > 0) return container.first();
    }
    const ph = page.locator(`[placeholder*="${hint}"]`).first();
    if ((await ph.count().catch(() => 0)) > 0) {
      const container = ph.locator(
        'xpath=ancestor::*[self::form or self::fieldset or contains(@class,"filter") or contains(@class,"filters") or contains(@class,"ant-form") or contains(@class,"form")][1]',
      );
      if ((await container.count().catch(() => 0)) > 0) return container.first();
    }
  }
  // Fallback to page if nothing better found
  return page;
}

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
  'कांकेर',
  'गरियाबंद',
  'बलौदाबाजार-भाटापारा',
  'मुंगेली',
  'गौरेला-पेंड्रा-मरवाही',
  'बालोद',
  'खैरागढ़-छुईखदान-गंडई',
  'सारंगढ़-बिलाईगढ़',
  'मनेंद्रगढ़-चिरमिरी-भरतपुर',
  'सरगुजा',
]);

const LABELS = {
  district: ['जिला', 'District', 'जिले', 'जिला चुनें'],
  block: ['विकासखण्ड', 'विकास खंड', 'विकास खण्ड', 'जनपद', 'Block', 'Janpad', 'विकास खण्ड चुनें'],
  panchayat: ['ग्राम पंचायत', 'Gram Panchayat', 'ग्राम पंचायत चुनें'],
  village: ['ग्राम', 'Village', 'ग्राम चुनें'],
  ulb: [
    'ULB',
    'Urban Local Body',
    'नगर निगम',
    'नगर पालिका',
    'नगर पंचायत',
    'शहरी निकाय',
    'निकाय',
    'निकाय चुनें',
  ],
  ward: ['वार्ड', 'Ward', 'वार्ड चुनें'],
};

/**
 * Enumerator for rural cascade
 */
async function enumerateRural(page, limits) {
  const { maxDistricts, maxBlocks, maxPanchayats, maxVillages, delay } = limits;

  const out = [];
  if (DEBUG)
    console.log(
      '[CG Filters][Debug][Rural] Locating district dropdown with hints:',
      LABELS.district,
    );
  const districtCombo = await getComboboxByLabel(page, LABELS.district);
  if (DEBUG) console.log('[CG Filters][Debug][Rural] District dropdown found:', !!districtCombo);
  if (!districtCombo) throw new Error('District dropdown not found (Rural).');

  let districts = await readOptionsFromCombobox(page, districtCombo);
  if (DEBUG)
    console.log(
      '[CG Filters][Debug][Rural] District options (first 10):',
      (districts || []).slice(0, 10),
    );
  if (maxDistricts > 0) districts = districts.slice(0, maxDistricts);

  for (const d of districts) {
    await selectComboValue(page, districtCombo, d);
    await sleep(Math.max(1000, delay));

    const blockCombo = await getComboboxByLabel(page, LABELS.block);
    if (!blockCombo) {
      out.push({ ...fourVariants(d), blocks: [] });
      continue;
    }

    await waitForOptions(page, blockCombo, { min: 2, timeout: 10000 });
    let blocks = await readOptionsFromCombobox(page, blockCombo);
    if (maxBlocks > 0) blocks = blocks.slice(0, maxBlocks);

    const blocksOut = [];
    for (const b of blocks) {
      await selectComboValue(page, blockCombo, b);
      await sleep(Math.max(1000, delay));

      const pCombo = await getComboboxByLabel(page, LABELS.panchayat);
      if (!pCombo) {
        blocksOut.push({ ...fourVariants(b), panchayats: [] });
        continue;
      }

      await waitForOptions(page, pCombo, { min: 2, timeout: 10000 });
      let panchayats = await readOptionsFromCombobox(page, pCombo);
      if (maxPanchayats > 0) panchayats = panchayats.slice(0, maxPanchayats);

      const panchOut = [];
      for (const p of panchayats) {
        await selectComboValue(page, pCombo, p);
        await sleep(Math.max(1000, delay));

        const vCombo = await getComboboxByLabel(page, LABELS.village);
        let villages = [];
        if (vCombo) {
          await waitForOptions(page, vCombo, { min: 2, timeout: 10000 });
          villages = await readOptionsFromCombobox(page, vCombo);
          if (maxVillages > 0) villages = villages.slice(0, maxVillages);
        }

        panchOut.push({
          ...fourVariants(p),
          villages: villages.map((v) => ({ ...fourVariants(v) })),
        });
      }

      blocksOut.push({
        ...fourVariants(b),
        panchayats: panchOut,
      });
    }

    out.push({
      ...fourVariants(d),
      blocks: blocksOut,
    });
  }

  return out;
}

/**
 * Enumerator for urban cascade
 */
async function enumerateUrban(page, limits) {
  const { maxDistricts, maxULBs, maxWards, delay } = limits;

  const out = [];
  if (DEBUG)
    console.log(
      '[CG Filters][Debug][Urban] Locating district dropdown with hints:',
      LABELS.district,
    );
  const districtCombo = await getComboboxByLabel(page, LABELS.district);
  if (DEBUG) console.log('[CG Filters][Debug][Urban] District dropdown found:', !!districtCombo);
  if (!districtCombo) throw new Error('District dropdown not found (Urban).');

  let districts = await readOptionsFromCombobox(page, districtCombo);
  if (maxDistricts > 0) districts = districts.slice(0, maxDistricts);

  for (const d of districts) {
    await selectComboValue(page, districtCombo, d);
    await sleep(Math.max(1000, delay));

    const ulbCombo = await getComboboxByLabel(page, LABELS.ulb);
    let ulbs = [];
    if (ulbCombo) {
      await waitForOptions(page, ulbCombo, { min: 2, timeout: 10000 });
      ulbs = await readOptionsFromCombobox(page, ulbCombo);
      if (maxULBs > 0) ulbs = ulbs.slice(0, maxULBs);
    }

    const ulbOut = [];
    for (const u of ulbs) {
      await selectComboValue(page, ulbCombo, u);
      await sleep(Math.max(1000, delay));

      const wardCombo = await getComboboxByLabel(page, LABELS.ward);
      let wards = [];
      if (wardCombo) {
        await waitForOptions(page, wardCombo, { min: 2, timeout: 10000 });
        wards = await readOptionsFromCombobox(page, wardCombo);
        if (maxWards > 0) wards = wards.slice(0, maxWards);
      }

      ulbOut.push({
        ...fourVariants(u),
        wards: wards.map((w) => ({ ...fourVariants(w) })),
      });
    }

    out.push({
      ...fourVariants(d),
      ulbs: ulbOut,
    });
  }

  return out;
}

/**
 * Main
 */
(async () => {
  const browser = await chromium.launch({
    headless: !HEADFUL,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: 'hi-IN',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const limits = {
    maxDistricts: MAX_DISTRICTS,
    maxBlocks: MAX_BLOCKS,
    maxPanchayats: MAX_PANCHAYATS,
    maxVillages: MAX_VILLAGES,
    maxULBs: MAX_ULBS,
    maxWards: MAX_WARDS,
    delay: DELAY_MS,
  };

  const result = {
    source: 'Chhattisgarh SuShasan Portal — Filter Hierarchy',
    url: PORTAL_URL,
    fetched_at: nowISO(),
    params: {
      mode: MODE,
      limits,
    },
    rural: [],
    urban: [],
    summary: {
      rural: { districts: 0, blocks: 0, panchayats: 0, villages: 0 },
      urban: { districts: 0, ulbs: 0, wards: 0 },
    },
  };

  try {
    console.log('[CG Filters] Opening portal...');
    if (DEBUG) console.log('[CG Filters][Debug] Params:', { mode: MODE, limits });
    await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(800);

    if (MODE === 'rural' || MODE === 'both') {
      console.log('[CG Filters] Enumerating Rural...');
      await chooseMode(page, 'rural');
      await sleep(900);
      FILTER_ROOT =
        (await getFilterRootUsingAnchors(page, 'rural')) ||
        (await getFilterRoot(page, LABELS.district));

      const rural = await enumerateRural(page, limits);
      result.rural = rural;

      // Compute rural summary
      const dSet = new Set();
      const bSet = new Set();
      const pSet = new Set();
      const vSet = new Set();
      for (const d of rural) {
        dSet.add(d.hindi);
        for (const b of d.blocks || []) {
          bSet.add(`${d.hindi}::${b.hindi}`);
          for (const p of b.panchayats || []) {
            pSet.add(`${d.hindi}::${b.hindi}::${p.hindi}`);
            for (const v of p.villages || []) {
              vSet.add(`${d.hindi}::${b.hindi}::${p.hindi}::${v.hindi}`);
            }
          }
        }
      }
      result.summary.rural = {
        districts: dSet.size,
        blocks: bSet.size,
        panchayats: pSet.size,
        villages: vSet.size,
      };
      console.log('[CG Filters][Rural] Summary:', result.summary.rural);
    }

    if (MODE === 'urban' || MODE === 'both') {
      console.log('[CG Filters] Enumerating Urban...');
      await chooseMode(page, 'urban');
      await sleep(1200);
      await page
        .waitForSelector(
          'text=ULB, text=Urban Local Body, text=नगर निगम, text=नगर पालिका, text=नगर पंचायत',
          { timeout: 5000 },
        )
        .catch(() => {});
      FILTER_ROOT =
        (await getFilterRootUsingAnchors(page, 'urban')) || (await getFilterRoot(page, LABELS.ulb));

      const urban = await enumerateUrban(page, limits);
      result.urban = urban;

      // Compute urban summary
      const dSet = new Set();
      const uSet = new Set();
      const wSet = new Set();
      for (const d of urban) {
        dSet.add(d.hindi);
        for (const u of d.ulbs || []) {
          uSet.add(`${d.hindi}::${u.hindi}`);
          for (const w of u.wards || []) {
            wSet.add(`${d.hindi}::${u.hindi}::${w.hindi}`);
          }
        }
      }
      result.summary.urban = {
        districts: dSet.size,
        ulbs: uSet.size,
        wards: wSet.size,
      };
      console.log('[CG Filters][Urban] Summary:', result.summary.urban);
    }

    // Save output
    ensureDir(OUT_PATH);
    fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), 'utf8');
    console.log(`[CG Filters] Saved to ${OUT_PATH}`);
  } catch (err) {
    console.error('[CG Filters] Error:', err && err.message ? err.message : err);
    // Still try to save partial result
    ensureDir(OUT_PATH);
    fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), 'utf8');
    process.exitCode = 1;
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }
})();
