/* Development-only browser checks. The deployed website has no Node dependency. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const base = '/english_teacher_web/';
const errors = [];
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(base)) { res.writeHead(404).end(); return; }
    const file = path.resolve(root, decodeURIComponent(url.pathname.slice(base.length)) || 'index.html');
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
const screenshot = async (page, name) => {
  if (!process.env.UI_SCREENSHOT_DIR) return;
  await fs.mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, name + '.png') });
};
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}${base}`;
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });
    await page.goto(url);
    for (const width of [320, 390, 768, 1024, 1051, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(dimensions.scroll <= dimensions.width + 1, `Horizontal overflow at ${width}: ${JSON.stringify(dimensions)}`);
      assert.equal(await page.locator('.menu-toggle').isVisible(), width <= 1050);
      assert.equal(await page.locator('.lesson-grid').evaluate(el => el.classList.contains('is-stacking')), width > 1050);
      console.log(`PASS layout ${width}px`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('.reveal').last().waitFor({ state: 'visible' });
    await page.waitForTimeout(800);
    await screenshot(page, 'desktop');
    await page.mouse.move(20, 250);
    await page.waitForFunction(() => document.documentElement.classList.contains('custom-cursor-active'));
    assert.equal(await page.locator('.cursor-dot').evaluate(el => el.classList.contains('is-dark')), false);
    await page.locator('#method').evaluate(el => el.scrollIntoView({ behavior: 'instant' }));
    await page.mouse.move(20, 350);
    await page.waitForFunction(() => document.querySelector('.cursor-dot').classList.contains('is-dark'));
    console.log('PASS contextual desktop cursor');
    await page.locator('.lesson-card').first().evaluate(el => el.scrollIntoView({ behavior: 'instant' }));
    await page.mouse.wheel(0, 550);
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.lesson-card').first().evaluate(el => getComputedStyle(el).position), 'sticky');
    assert.ok(await page.locator('.lesson-card').first().evaluate(el => Number(el.style.getPropertyValue('--stack-scale')) < 1));
    await screenshot(page, 'stacked-cards');
    console.log('PASS sticky overlay and scroll progress');

    const faq = page.locator('.faq-list details').nth(1);
    const summary = faq.locator('summary');
    await summary.scrollIntoViewIfNeeded();
    await summary.click();
    await page.waitForFunction(() => document.querySelectorAll('.faq-list details')[1].classList.contains('is-animating'));
    await page.waitForFunction(() => !document.querySelectorAll('.faq-list details')[1].classList.contains('is-animating'));
    assert.equal(await faq.getAttribute('open'), '');
    await summary.click();
    await page.waitForFunction(() => !document.querySelectorAll('.faq-list details')[1].open);
    // Interrupt and reverse using browser DOM clicks to avoid Playwright's stability wait.
    await summary.evaluate(el => { el.click(); setTimeout(() => el.click(), 90); });
    await page.waitForFunction(() => !document.querySelectorAll('.faq-list details')[1].classList.contains('is-animating'));
    assert.equal(await faq.getAttribute('open'), null);
    assert.equal(await summary.getAttribute('aria-expanded'), 'false');
    assert.equal(await faq.evaluate(el => el.style.height), '');
    console.log('PASS FAQ opening, closing and mid-animation reversal');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.menu-toggle').click();
    await page.waitForFunction(() => document.querySelector('#mobile-menu').open);
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    for (let i = 0; i < 10; i++) await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.querySelector('#mobile-menu').contains(document.activeElement)));
    await page.waitForTimeout(400);
    await screenshot(page, 'mobile-menu');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#mobile-menu').open);
    assert.equal(await page.evaluate(() => document.activeElement.className), 'menu-toggle magnetic-target');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    await page.locator('.menu-toggle').click();
    await page.mouse.click(3, 400);
    await page.waitForFunction(() => !document.querySelector('#mobile-menu').open);
    await page.locator('.menu-toggle').click();
    await page.locator('#mobile-menu a[href="#about"]').click();
    await page.waitForFunction(() => !document.querySelector('#mobile-menu').open);
    assert.equal(new URL(page.url()).hash, '#about');
    await page.locator('.menu-toggle').click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => !document.querySelector('#mobile-menu').open);
    console.log('PASS mobile navigation focus trap, Escape, backdrop, anchors and resize');

    // Pause drift first so the click target stays stable during automatic waiting.
    await page.locator('.mascot-motion').click({ force: true });
    assert.equal(await page.locator('.mascot-motion').getAttribute('aria-pressed'), 'true');
    const owl = page.locator('.mascot-button');
    await owl.click();
    assert.ok(await page.locator('.mascot-bubble').textContent());
    assert.equal(await page.locator('.mascot').evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
    await owl.click();
    assert.equal(await owl.getAttribute('aria-expanded'), 'false');
    await owl.click();
    await page.waitForFunction(() => document.querySelector('.mascot-button').getAttribute('aria-expanded') === 'false', null, { timeout: 8000 });
    await page.locator('.mascot-motion').click();
    await page.mouse.move(20, 300);
    assert.equal(await page.locator('.mascot').evaluate(el => getComputedStyle(el).animationPlayState), 'running');
    await page.locator('.mascot-dismiss').click({ force: true });
    assert.equal(await page.locator('.mascot').isVisible(), false);
    await page.reload();
    assert.equal(await page.locator('.mascot').isVisible(), false);
    console.log('PASS mascot phrases, repeat tap, timeout, manual pause, resume and dismissal');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.mouse.move(100, 250);
    assert.equal(await page.locator('.lesson-grid').evaluate(el => el.classList.contains('is-stacking')), false);
    assert.equal(await page.locator('.cursor-dot').isVisible(), false);
    assert.equal(await page.locator('.marquee-track').evaluate(el => getComputedStyle(el).animationName), 'none');
    const firstFaq = page.locator('.faq-list details').first();
    await firstFaq.locator('summary').click();
    assert.equal(await firstFaq.getAttribute('open'), null);
    assert.equal(await firstFaq.evaluate(el => el.getAnimations().length), 0);
    console.log('PASS live reduced-motion preference');
    await page.close();

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mobile = await touch.newPage();
    await mobile.goto(url);
    await mobile.mouse.move(100, 250);
    assert.equal(await mobile.locator('.cursor-dot').isVisible(), false);
    await mobile.locator('.mascot-button').tap({ force: true });
    assert.equal(await mobile.locator('.mascot-button').getAttribute('aria-expanded'), 'true');
    await screenshot(mobile, 'mobile-mascot');
    console.log('PASS touch cursor disabled and mascot tap');
    await touch.close();

    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const fallback = await noJs.newPage();
    await fallback.goto(url);
    assert.equal(await fallback.locator('.desktop-nav').isVisible(), true);
    assert.equal(await fallback.locator('h1').evaluate(el => getComputedStyle(el).opacity), '1');
    assert.ok(await fallback.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)));
    await fallback.locator('.faq-list summary').nth(1).click();
    assert.equal(await fallback.locator('.faq-list details').nth(1).getAttribute('open'), '');
    console.log('PASS no-JavaScript navigation, images, content and native FAQ');
    await noJs.close();
    assert.deepEqual(errors, [], 'Browser or asset errors');
    console.log('All browser checks passed.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
