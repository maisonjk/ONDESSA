'use strict';
const assert = require('node:assert/strict');
const L = require('../lib.cjs');

const T = L.today();
const PUBLIC = ['/', '/plans', '/library', '/library/how-predictions-work', '/legal', '/help', '/privacy'];
const APP = ['/app', '/app/calendar', '/app/log', '/app/fertility', '/app/pregnancy', '/app/insights', '/app/more', '/app/settings', '/app/privacy', '/app/membership', '/app/library'];

function richData() {
  const d = L.emptyData(T, { logs: L.cycleHistory(L.addDays(T, -12), [28, 30, 27, 29]), settings: { goal: 'conceive', fertilitySigns: true, intercourseLogging: true } });
  d.logs[T] = { date: T, symptoms: ['cramps'], mood: 'calm', bbt: 36.5, note: 'x' };
  return d;
}

/** Problems on the current screen: horizontal scroll, off-screen elements, tab bar over content. */
async function layoutProblems(page, route) {
  const out = [];
  const hs = await L.noHorizontalScroll(page);
  if (!hs.ok) out.push(`${route}: horizontal scroll ${hs.scrollWidth} > ${hs.innerWidth}`);
  const off = await page.evaluate(() => {
    const res = [];
    for (const el of document.querySelectorAll('main *, header *, .tabbar *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || el.closest('.sr-only')) continue;
      let p = el.parentElement, scroller = false;
      while (p) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) { scroller = true; break; } p = p.parentElement; }
      if (!scroller && (r.right > innerWidth + 1 || r.left < -1)) res.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 24)}"`);
    }
    return res.slice(0, 3);
  });
  if (off.length) out.push(`${route}: off-screen ${off.join(', ')}`);
  if (route.startsWith('/app')) {
    const cover = await page.evaluate(async () => {
      window.scrollTo(0, document.scrollingElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 80));
      const outer = document.querySelector('.tabbar').getBoundingClientRect();
      const bar = document.querySelector('.tabbar nav').getBoundingClientRect();
      const main = document.querySelector('main').getBoundingClientRect();
      if (outer.height > innerHeight / 2) return main.left < bar.right - 1 ? `sidebar overlaps main (${Math.round(bar.right)} > ${Math.round(main.left)})` : null;
      const leaves = [...document.querySelectorAll('main *')].filter((e) => !e.children.length && e.getBoundingClientRect().height);
      const bottom = Math.max(...leaves.map((e) => e.getBoundingClientRect().bottom));
      return bottom > bar.top + 1 ? `last content at ${Math.round(bottom)} is under the tab bar at ${Math.round(bar.top)}` : null;
    });
    if (cover) out.push(`${route}: ${cover}`);
  }
  return out;
}

function sweep(width, scheme, routes, opts = {}) {
  return async () => {
    const { page } = await L.open({ viewport: { width, height: 800 }, colorScheme: scheme });
    if (opts.noData) await L.goto(page, '/');
    else await L.seed(page, richData());
    const problems = [];
    for (const r of routes) {
      await L.hashGo(page, r);
      await page.waitForTimeout(100);
      problems.push(...(await layoutProblems(page, r)));
    }
    if (scheme === 'dark') {
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const [r, g, b] = bg.match(/\d+/g).map(Number);
      assert.ok(r + g + b < 150, `dark mode body background ${bg}`);
    }
    assert.deepEqual(problems, []);
  };
}

const tests = [];
for (const w of [320, 390, 768, 1280]) {
  for (const scheme of ['light', 'dark']) {
    tests.push({ name: `${w}px ${scheme}: app screens — no horizontal scroll, nothing off-screen, tab bar never covers content`, run: sweep(w, scheme, APP) });
    tests.push({
      name: `${w}px ${scheme}: public screens (signed-in member header)`,
      run: sweep(w, scheme, PUBLIC),

    });
  }
}
tests.push({ name: '320px: public screens for a new visitor (Start button header)', run: sweep(320, 'light', PUBLIC, { noData: true }) });
tests.push({ name: '320px: onboarding steps fit', async run() {
  const { page } = await L.open({ viewport: { width: 320, height: 640 } });
  await L.goto(page, '/start');
  const problems = [...(await layoutProblems(page, '/start#0'))];
  await page.getByRole('button', { name: 'I understand, continue' }).click();
  problems.push(...(await layoutProblems(page, '/start#1')));
  await page.getByRole('button', { name: 'Continue' }).click();
  problems.push(...(await layoutProblems(page, '/start#2')));
  await page.getByLabel('I’m not sure. I’ll log my next period.').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  problems.push(...(await layoutProblems(page, '/start#3')));
  assert.deepEqual(problems, []);
} });
tests.push({ name: '960px+: tab bar becomes a left sidebar', async run() {
  const { page } = await L.open({ viewport: { width: 1280, height: 800 } });
  await L.seed(page, richData());
  const bar = await page.locator('.tabbar').boundingBox();
  const main = await page.locator('main').boundingBox();
  assert.ok(bar.height > 600 && bar.x < 50 && main.x >= bar.x + bar.width, JSON.stringify({ bar, main }));
} });

module.exports = tests;
