import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Exercise the real shared component in isolation; no production fixtures or APIs.
const kinds = [
  'tasks',
  'projects',
  'files',
  'notes',
  'messages',
  'notifications',
  'search',
  'analytics',
  'team',
  'integrations',
  'activity',
  'calendar',
  'invitations',
  'restricted',
  'offline',
  'error',
];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 401, body: '{}', contentType: 'application/json' }),
  );
  await page.goto(process.env.DEVUP_APP_URL || 'http://localhost:5182');
  await page.evaluate(async (kinds) => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const { EmptyIllustration } = await import('/src/shared/illustrations/EmptyIllustration.tsx');
    document.body.innerHTML =
      '<main class="workspace-app" data-theme="light"><div id="gallery"></div></main>';
    const style = document.createElement('style');
    style.textContent =
      'body{margin:0;font-family:Arial,sans-serif}.workspace-app{padding:24px!important;display:block!important;min-height:100vh!important;background:#fff!important;color:#172033!important}.workspace-app[data-theme=dark]{background:#1b1c20!important;color:#f0f1f3!important}#gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}.sample{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:13px;min-width:0}@media(max-width:500px){#gallery{grid-template-columns:repeat(2,minmax(0,1fr))}}';
    document.head.append(style);
    createRoot(document.getElementById('gallery')).render(
      React.createElement(
        React.Fragment,
        null,
        ...kinds.map((kind) =>
          React.createElement(
            'div',
            { className: 'sample', key: kind },
            React.createElement(EmptyIllustration, { kind, size: 144 }),
            kind,
          ),
        ),
      ),
    );
  }, kinds);
  await page.locator('.sample').last().waitFor();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('.devup-empty-art img')).every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await fs.mkdir('/tmp/devup-empty-artifacts', { recursive: true });
  for (const width of [1000, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['light', 'dark', 'light']) {
      await page
        .locator('.workspace-app')
        .evaluate((el, theme) => (el.dataset.theme = theme), theme);
      const visible = await page.locator('.devup-empty-art img:visible').evaluateAll((imgs) =>
        imgs.map((img) => ({
          src: img.getAttribute('src'),
          width: img.getBoundingClientRect().width,
          decorative: img.alt === '' && img.closest('[aria-hidden="true"]') !== null,
        })),
      );
      assert.equal(visible.length, 16);
      assert.ok(
        visible.every(
          (img) =>
            img.src.includes('/' + theme + '/') &&
            img.width > 0 &&
            img.width <= 144 &&
            img.decorative,
        ),
      );
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'Gallery fits mobile viewport',
      );
      await page.screenshot({
        path: `/tmp/devup-empty-artifacts/${theme}-${width}.png`,
        fullPage: true,
      });
    }
  }
  console.log(
    'Passed: 32 assets loaded; all 16 kinds switch live between explicit themes, remain decorative, and fit desktop/mobile.',
  );
} finally {
  await browser.close();
}
