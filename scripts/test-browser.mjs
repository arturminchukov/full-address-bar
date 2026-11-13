// Exercise the built content script in real layout engines. Only storage is
// replaced; DOM, CSS, pointer events, keyboard, focus and scrolling are real.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';

await mkdir('release/screenshots', { recursive: true });
let cases = 0;
for (const [engine, browserType] of Object.entries({ chromium, firefox })) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const width of [1280, 360]) {
      for (const position of ['top', 'bottom']) {
        for (const layout of ['viewport', 'long', 'nested']) {
          const page = await browser.newPage({ viewport: { width, height: 800 } });
          const errors = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.setContent(`<!doctype html><html><head><style>
            * { box-sizing: border-box; }
            html, body { margin: 0; }
            body { font: 16px sans-serif; background: #f5f5f5; }
            header, footer { position: fixed; left: 0; right: 0; height: 40px; background: #cce1fa; }
            header { top: 0; } footer { bottom: 0; }
            main { padding: 60px 12px; height: ${layout === 'long' ? '250vh' : '100vh'}; }
            section { height: 100%; overflow: auto; }
          </style></head><body><header>Fixed header <button id="edge-top">Page action</button></header>
          <main><input id="page-input" aria-label="Page input" placeholder="Page input">
          <section><h1>Full Address Bar layout regression</h1><p>Page content must not move.</p>
          ${layout === 'nested' ? '<div style="height:200vh">Nested scroller</div>' : ''}</section></main>
          <footer>Fixed footer <button id="edge-bottom">Page action</button></footer></body></html>`);
          await page.evaluate((position) => {
            let settings = { enabled: true, autoHide: true, position, theme: 'light', deniedHosts: [] };
            let listener;
            window.chrome = { storage: {
              local: {
                get: async () => ({ 'fab-settings': settings }),
                set: async (values) => {
                  settings = values['fab-settings'];
                  listener?.({ 'fab-settings': { newValue: settings } }, 'local');
                },
              },
              onChanged: { addListener: (fn) => { listener = fn; } },
            } };
            window.updateSettings = (patch) => window.chrome.storage.local.set({ 'fab-settings': { ...settings, ...patch } });
          }, position);
          const geometry = () => page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            body: document.body.getBoundingClientRect().toJSON(),
            header: document.querySelector('header').getBoundingClientRect().toJSON(),
            footer: document.querySelector('footer').getBoundingClientRect().toJSON(),
          }));
          const before = await geometry();
          await page.addScriptTag({ path: `dist-${engine === 'chromium' ? 'chrome' : 'firefox'}/content.js` });
          const bar = page.locator('#full-address-bar-host .fab-bar');
          const input = page.locator('#full-address-bar-host .fab-input');
          await bar.waitFor();
          assert.deepEqual(await geometry(), before, `${engine}/${width}/${position}/${layout}: mounted layout`);
          await page.waitForFunction(() => document.getElementById('full-address-bar-host').shadowRoot.querySelector('.fab-bar').dataset.hidden === 'true');
          assert.deepEqual(await geometry(), before, 'hidden layout');
          assert.equal(await bar.isVisible(), false, 'hidden bar has no visible/focusable box');
          assert.equal(await page.evaluate((position) => {
            const y = position === 'top' ? 1 : innerHeight - 1;
            return document.elementFromPoint(10, y).closest('header, footer') !== null;
          }, position), true, 'hidden bar does not intercept page edge');
          await page.mouse.move(10, position === 'top' ? 1 : 799);
          await bar.waitFor({ state: 'visible' });
          await page.mouse.move(100, position === 'top' ? 14 : 786);
          await page.waitForTimeout(650);
          assert.equal(await bar.isVisible(), true, 'pointer holds bar');
          await page.mouse.move(200, 300);
          await bar.waitFor({ state: 'hidden' });
          await page.locator('#page-input').focus();
          await page.keyboard.press('Alt+Shift+l');
          await input.waitFor({ state: 'visible' });
          await page.waitForTimeout(650);
          assert.equal(await input.evaluate((el) => el.getRootNode().activeElement === el), true);
          await page.keyboard.press('Escape');
          assert.equal(await bar.isVisible(), false);
          assert.equal(await page.locator('#page-input').evaluate((el) => document.activeElement === el), true);
          await page.evaluate(() => {
            const host = document.createElement('div');
            host.id = 'page-shadow-host';
            host.style.cssText = 'position:fixed;top:100px;left:10px';
            document.body.append(host);
            const nested = document.createElement('div');
            host.attachShadow({ mode: 'open' }).append(nested);
            const field = document.createElement('input');
            nested.attachShadow({ mode: 'open' }).append(field);
            field.focus();
          });
          await page.keyboard.press('Alt+Shift+l');
          await input.waitFor({ state: 'visible' });
          await page.keyboard.press('Escape');
          assert.equal(await page.evaluate(() => {
            const host = document.getElementById('page-shadow-host');
            const nested = host.shadowRoot.querySelector('div');
            return nested.shadowRoot.activeElement?.tagName === 'INPUT';
          }), true, 'Escape restores focus inside nested page shadow roots');
          await page.locator('#page-shadow-host').evaluate((el) => el.remove());
          await page.locator('#page-input').focus();
          await page.keyboard.press('Alt+Shift+l');
          await input.fill('https://example.com/' + 'x'.repeat(10000));
          assert.deepEqual(await geometry(), before, 'long URL cannot enlarge page');
          await page.keyboard.press('Escape');
          await page.mouse.move(10, position === 'top' ? 1 : 799);
          await page.locator('#full-address-bar-host .fab-menu-btn').click();
          await page.mouse.move(200, 300);
          await page.waitForTimeout(650);
          assert.equal(await bar.isVisible(), true, 'menu holds bar');
          await page.keyboard.press('Escape');
          assert.equal(await bar.isVisible(), false, 'Escape dismisses a menu-only interaction');
          assert.equal(await page.locator('#page-input').evaluate((el) => document.activeElement === el), true, 'menu restores previous page focus');
          await page.mouse.move(10, position === 'top' ? 1 : 799);
          await page.locator('#full-address-bar-host .fab-menu-btn').click();
          await page.getByRole('menuitem', { name: 'Always show (overlays page)' }).click();
          await page.waitForTimeout(650);
          assert.equal(await bar.isVisible(), true, 'pinned mode');
          assert.deepEqual(await geometry(), before, 'pinned layout');
          if (width === 1280 && layout === 'viewport') {
            await page.screenshot({ path: `release/screenshots/${engine}-${position}.png` });
          }
          await page.locator('#page-input').focus();
          await page.keyboard.press('Alt+Shift+l');
          await page.evaluate(() => {
            const other = document.createElement('input');
            other.id = 'other-page-input';
            document.querySelector('main').append(other);
            other.focus();
          });
          const beforeDisable = await geometry();
          await page.evaluate(() => window.updateSettings({ enabled: false }));
          assert.equal(await page.locator('#other-page-input').evaluate((el) => document.activeElement === el), true, 'unmount does not steal focus after editor blur');
          await page.locator('#other-page-input').evaluate((el) => el.remove());
          assert.equal(await page.locator('#full-address-bar-host').count(), 0);
          assert.deepEqual(await geometry(), beforeDisable, 'disabled layout');
          assert.deepEqual(errors, []);
          await page.close();
          cases++;
          console.log(`PASS ${engine} ${width}px ${position} ${layout}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
}
console.log(`PASS ${cases} browser layout and interaction scenarios`);
