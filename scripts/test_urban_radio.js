const { chromium } = require('playwright');

const TARGET_URL = 'https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports';
const HEADFUL = process.env.HEADFUL === '1';

async function testUrbanRadio() {
  console.log('[Test] Launching browser...');
  const browser = await chromium.launch({ headless: !HEADFUL });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await new Promise(r => setTimeout(r, 2000)); // Wait for React

  console.log('[Test] Inspecting radios...');
  const radios = await page.locator('input[type="radio"]').all();
  for (let i = 0; i < radios.length; i++) {
    const value = await radios[i].getAttribute('value');
    const checked = await radios[i].isChecked();
    const name = await radios[i].getAttribute('name');
    console.log(`[Test] Radio ${i}: value="${value}", checked=${checked}, name="${name}"`);
  }

  console.log('[Test] Attempting to trigger urban mode...');
  // Try multiple ways
  const methods = [
    async () => {
      const byRole = page.getByRole('radio', { name: 'शहरी' });
      if (await byRole.count()) {
        console.log('[Test] Clicking by role...');
        await byRole.click({ force: true });
        return true;
      }
      return false;
    },
    async () => {
      const label = page.locator('label:has-text("शहरी")');
      if (await label.count()) {
        console.log('[Test] Clicking label...');
        await label.click({ force: true });
        return true;
      }
      return false;
    },
    async () => {
      const span = page.locator('.ant-radio-group >> text=शहरी');
      if (await span.count()) {
        console.log('[Test] Clicking span...');
        await span.click({ force: true });
        return true;
      }
      return false;
    },
    async () => {
      const input = page.locator('input[value="urban"], input[value="शहरी"]');
      if (await input.count()) {
        console.log('[Test] Checking input...');
        await input.check({ force: true });
        return true;
      }
      return false;
    },
    async () => {
      await page.evaluate(() => {
        const radios = document.querySelectorAll('input[type="radio"]');
        for (const r of radios) {
          if (r.value === 'urban' || r.value === 'शहरी' || r.name.includes('urban') || r.name.includes('शहरी')) {
            console.log('[Test] Dispatching events on radio...');
            r.checked = true;
            r.dispatchEvent(new Event('click', { bubbles: true }));
            r.dispatchEvent(new Event('input', { bubbles: true }));
            r.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      });
      return true;
    }
  ];

  for (const method of methods) {
    try {
      const success = await method();
      if (success) {
        console.log('[Test] Method succeeded, waiting for urban filters...');
        await new Promise(r => setTimeout(r, 2000));
        const urbantype = page.locator('#urbantype');
        if (await urbantype.count()) {
          console.log('[Test] SUCCESS: UrbanType input found!');
          await browser.close();
          return;
        } else {
          console.log('[Test] UrbanType not found yet.');
        }
      }
    } catch (e) {
      console.log('[Test] Method failed:', e.message);
    }
  }

  console.log('[Test] All methods failed. Taking screenshot...');
  await page.screenshot({ path: 'urban_radio_debug.png' });
  await browser.close();
  console.log('[Test] Screenshot saved as urban_radio_debug.png');
}

testUrbanRadio().catch(console.error);
