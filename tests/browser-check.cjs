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
    assert.equal(await page.locator('#year').textContent(), String(new Date().getFullYear()));
    assert.equal(await page.locator('.mascot').getAttribute('data-state'), 'greeting');
    assert.ok((await page.locator('.mascot-bubble').textContent()).includes('Nice to meet you'));
    for (const width of [320, 390, 768, 1024, 1051, 1280, 1440, 1920, 2560, 3840]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(dimensions.scroll <= dimensions.width + 1, `Horizontal overflow at ${width}: ${JSON.stringify(dimensions)}`);
      assert.equal(await page.locator('.menu-toggle').isVisible(), width <= 1050);
      assert.equal(await page.locator('.lesson-grid').evaluate(el => el.classList.contains('is-stacking')), width > 1050);
      const repeat = await page.locator('.marquee-track').evaluate(el => {
        const groups = [...el.children].map(group => group.getBoundingClientRect().width);
        return { groups, viewport: el.parentElement.clientWidth };
      });
      assert.equal(repeat.groups.length, 2);
      assert.ok(repeat.groups[0] >= repeat.viewport, `Marquee repeat too short at ${width}`);
      assert.ok(Math.abs(repeat.groups[0] - repeat.groups[1]) < .1);
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
    await page.locator('.lesson-card').last().evaluate(el => {
      const target = window.scrollY + el.getBoundingClientRect().top - parseFloat(getComputedStyle(el).top) + 80;
      window.scrollTo({ top: target, behavior: 'instant' });
    });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.lesson-card').first().evaluate(el => getComputedStyle(el).position), 'sticky');
    const inspectStack = () => page.locator('.lesson-card').evaluateAll(cards => cards.map(card => {
      const rect = card.getBoundingClientRect();
      const icon = card.querySelector('.card-icon').getBoundingClientRect();
      const target = document.elementFromPoint(icon.left + icon.width / 2, icon.top + icon.height / 2);
      return { top: rect.top, bottom: rect.bottom, sticky: parseFloat(getComputedStyle(card).top),
        iconVisible: card.querySelector('.card-icon').contains(target),
        contentFits: card.scrollHeight <= card.clientHeight + 1 };
    }));
    const stacked = await inspectStack();
    stacked.forEach((card, index) => {
      assert.ok(Math.abs(card.top - card.sticky) < 1, `Card ${index} did not finish stacking`);
      assert.ok(card.iconVisible, `Card ${index} letter is covered`);
      assert.ok(card.contentFits, `Card ${index} content overflows`);
      if (index) assert.ok(card.top - stacked[index - 1].top >= 83);
    });
    assert.ok(stacked.at(-1).bottom < 900 - 20, 'Final card is clipped by viewport');
    await page.evaluate(() => window.scrollBy({ top: 160, behavior: 'instant' }));
    await page.waitForTimeout(100);
    (await inspectStack()).forEach(card => assert.ok(Math.abs(card.top - card.sticky) < 1, 'Stack exits too early'));
    await screenshot(page, 'stacked-cards');
    console.log('PASS final card fully visible, all letter strips exposed and exit scroll room');
    for (const height of [650, 768, 800, 900]) {
      await page.setViewportSize({ width: 1440, height });
      await page.waitForTimeout(100);
      assert.equal(await page.locator('.lesson-grid').evaluate(el => el.classList.contains('is-stacking')), height >= 800);
    }
    await page.locator('.marquee-track').evaluate(el => {
      const animation = el.getAnimations()[0];
      animation.pause();
      animation.currentTime = animation.effect.getTiming().duration * .9999;
    });
    const seam = await page.locator('.marquee-track').evaluate(el => ({
      remaining: el.children[1].getBoundingClientRect().left - el.parentElement.getBoundingClientRect().left,
      covered: el.getBoundingClientRect().right >= el.parentElement.getBoundingClientRect().right
    }));
    assert.ok(Math.abs(seam.remaining) < 1, 'Marquee reset does not match repeated content');
    assert.ok(seam.covered);
    await page.locator('.marquee-track').evaluate(el => el.getAnimations()[0].play());
    console.log('PASS marquee coverage through 3840px and seamless cycle boundary');

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
    const cross = await page.locator('.menu-close').evaluate(el => {
      const button = el.getBoundingClientRect(), svg = el.querySelector('svg').getBoundingClientRect();
      return { dx: button.left + button.width / 2 - svg.left - svg.width / 2,
        dy: button.top + button.height / 2 - svg.top - svg.height / 2 };
    });
    assert.ok(Math.abs(cross.dx) < .1 && Math.abs(cross.dy) < .1, 'Close icon is not centered');
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

    await page.waitForFunction(() => document.querySelector('.mascot').dataset.state === 'idle');
    await page.keyboard.press('Escape');
    await page.mouse.move(20, 300);
    const leftEye = await page.locator('.dog-pupil').first().getAttribute('transform');
    await page.mouse.move(1400, 300);
    await page.waitForTimeout(50);
    assert.notEqual(await page.locator('.dog-pupil').first().getAttribute('transform'), leftEye);
    await page.locator('.mascot-motion').click({ force: true });
    assert.equal(await page.locator('.mascot-motion').getAttribute('aria-pressed'), 'true');
    const dog = page.locator('.mascot-button');
    await dog.click();
    assert.ok(await page.locator('.mascot-bubble').textContent());
    assert.equal(await page.locator('.dog-tail').evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
    await dog.click();
    assert.equal(await dog.getAttribute('aria-expanded'), 'false');
    await dog.click();
    await page.waitForFunction(() => document.querySelector('.mascot-button').getAttribute('aria-expanded') === 'false', null, { timeout: 8000 });
    await page.locator('.mascot-motion').click();
    await page.mouse.move(20, 300);
    assert.equal(await page.locator('.dog-tail').evaluate(el => getComputedStyle(el).animationPlayState), 'running');
    await page.locator('.doghouse').click();
    await page.waitForFunction(() => document.querySelector('.mascot').hidden);
    assert.equal(await page.locator('.mascot').isVisible(), false);
    assert.equal(await page.locator('.doghouse').isVisible(), true);
    await page.locator('.doghouse').click();
    await page.waitForFunction(() => document.querySelector('.mascot').dataset.state === 'idle');
    const homecoming = await dog.boundingBox();
    assert.ok(Math.abs(homecoming.x + homecoming.width / 2 - 712.5) < 20, 'Dog did not return to bottom center');
    await page.mouse.move(homecoming.x + 58, homecoming.y + 60);
    await page.mouse.down();
    await page.mouse.move(260, 260, { steps: 8 });
    assert.equal(await page.locator('.mascot').getAttribute('data-state'), 'dragging');
    const dragged = await dog.boundingBox();
    assert.ok(dragged.x < 300 && dragged.y < 300, 'Dog did not follow drag');
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.mascot').hidden);
    await page.locator('.doghouse').click();
    // Reversing a journey must not allow an old completion to hide the dog.
    await page.waitForTimeout(100);
    await page.locator('.doghouse').click();
    await page.waitForTimeout(100);
    await page.locator('.doghouse').click();
    await page.waitForFunction(() => document.querySelector('.mascot').dataset.state === 'idle');
    assert.equal(await page.locator('.mascot').isVisible(), true);
    await screenshot(page, 'desktop-dog');
    console.log('PASS dog eyes, phrases, timeout, pause, house toggle, drag return and reversed journeys');

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
    await mobile.waitForFunction(() => document.querySelector('.mascot').dataset.state === 'idle');
    await mobile.keyboard.press('Escape');
    await mobile.mouse.move(100, 250);
    assert.equal(await mobile.locator('.cursor-dot').isVisible(), false);
    await mobile.locator('.mascot-button').tap({ force: true });
    assert.equal(await mobile.locator('.mascot-button').getAttribute('aria-expanded'), 'true');
    await mobile.waitForTimeout(300);
    await screenshot(mobile, 'mobile-mascot');
    const session = await touch.newCDPSession(mobile);
    const touchDog = await mobile.locator('.mascot-button').boundingBox();
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchDog.x + 58, y: touchDog.y + 60 }] });
    await mobile.waitForTimeout(80);
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: 250 }] });
    assert.equal(await mobile.locator('.mascot').getAttribute('data-state'), 'dragging');
    await mobile.waitForTimeout(80);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.waitForFunction(() => document.querySelector('.mascot').hidden);
    const touchHouse = await mobile.locator('.doghouse').boundingBox();
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchHouse.x + 44, y: touchHouse.y + 52 }] });
    await mobile.waitForTimeout(80);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.waitForFunction(() => document.querySelector('.mascot').dataset.state === 'idle');
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
    const calendar = await browser.newContext();
    await calendar.addInitScript(() => {
      const NativeDate = Date;
      window.testYear = 2031;
      window.Date = class extends NativeDate { getFullYear() { return window.testYear; } };
    });
    const yearPage = await calendar.newPage();
    await yearPage.goto(url);
    assert.equal(await yearPage.locator('#year').textContent(), '2031');
    await yearPage.evaluate(() => { window.testYear = 2032; document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await yearPage.locator('#year').textContent(), '2032');
    await calendar.close();
    console.log('PASS reactive footer year after calendar rollover');
    assert.deepEqual(errors, [], 'Browser or asset errors');
    console.log('All browser checks passed.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
