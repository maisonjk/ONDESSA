'use strict';
const assert = require('node:assert/strict');
const L = require('../lib.cjs');

const T = L.today();
const ROUTES = ['/', '/plans', '/library', '/library/how-predictions-work', '/legal', '/help', '/privacy',
  '/app', '/app/calendar', '/app/log', '/app/fertility', '/app/pregnancy', '/app/insights', '/app/more',
  '/app/settings', '/app/privacy', '/app/membership', '/app/library', '/app/library/how-predictions-work'];
/** Violation types already reported (A11Y-01, A11Y-02); anything else fails the sweep. */
const KNOWN = new Set(['color-contrast', 'label-content-name-mismatch']);

function richData() {
  const d = L.emptyData(T, { logs: L.cycleHistory(L.addDays(T, -12), [28, 30, 27, 29]), settings: { goal: 'conceive', fertilitySigns: true, intercourseLogging: true } });
  for (let i = 0; i < 6; i++) d.logs[L.addDays(T, -i)] = { ...(d.logs[L.addDays(T, -i)] || {}), date: L.addDays(T, -i), bbt: 36.3 + (i % 3) / 10 };
  return d;
}

/** Run axe on onboarding steps, the lock screen and every route; return {id: [screens]}. */
async function sweep(scheme) {
  const found = {};
  const add = (label, vs) => { for (const v of vs) (found[v.id] ??= { impact: v.impact, screens: [], nodes: v.nodes }).screens.push(label); };
  const { page } = await L.open({ colorScheme: scheme });
  await L.goto(page, '/start');
  add('/start#1', await L.axe(page));
  await page.getByRole('button', { name: 'I understand, continue' }).click();
  add('/start#2', await L.axe(page));
  await page.getByRole('button', { name: 'Continue' }).click();
  add('/start#3', await L.axe(page));
  await page.fill('#last', L.addDays(T, -3));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('switch', { name: 'Lock and encrypt with a passcode' }).check();
  add('/start#4', await L.axe(page));
  await L.seed(page, richData());
  for (const r of ROUTES) {
    await L.hashGo(page, r);
    await page.waitForTimeout(100);
    add(r, await L.axe(page));
  }
  await L.hashGo(page, '/app/privacy');
  await page.getByLabel('Passcode', { exact: true }).fill('2468');
  await page.getByRole('button', { name: 'Turn on' }).click();
  await page.getByText('Passcode on: data encrypted').waitFor({ timeout: 10000 });
  await page.reload();
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  add('lock screen', await L.axe(page));
  return found;
}

const cache = {};
const sweepOnce = (scheme) => (cache[scheme] ??= sweep(scheme));

module.exports = [
  ...['light', 'dark'].map((scheme) => ({
    name: `axe (WCAG 2.1 AA), ${scheme}: no violations beyond the known ones on any screen`,
    timeout: 180000,
    async run() {
      const found = await sweepOnce(scheme);
      const unexpected = Object.entries(found).filter(([id]) => !KNOWN.has(id)).map(([id, v]) => `${id} (${v.impact}) on ${v.screens.join(', ')}: ${v.nodes.slice(0, 2).join(' | ')}`);
      assert.deepEqual(unexpected, []);
    },
  })),
  ...['light', 'dark'].map((scheme) => ({
    name: `axe, ${scheme}: text colour contrast ≥ 4.5:1`,
    timeout: 180000,
    async run() {
      const found = await sweepOnce(scheme);
      assert.equal(found['color-contrast'], undefined, `color-contrast on ${found['color-contrast']?.screens.join(', ')}`);
    },
  })),
  {
    name: 'axe: visible label is part of the accessible name (week strip)',
    timeout: 180000,
    async run() {
      const found = await sweepOnce('light');
      assert.equal(found['label-content-name-mismatch'], undefined, `on ${found['label-content-name-mismatch']?.screens.join(', ')}`);
    },
  },
  {
    name: 'touch targets ≥ 44px: onboarding, Today, Log and tab bar',
    async run() {
      const { page } = await L.open();
      const bad = [];
      await L.goto(page, '/start');
      await page.getByRole('button', { name: 'I understand, continue' }).click();
      bad.push(...(await L.smallTargets(page)).map((t) => ['/start#2', t]));
      await page.getByRole('button', { name: 'Continue' }).click();
      bad.push(...(await L.smallTargets(page)).map((t) => ['/start#3', t]));
      await L.seed(page, richData());
      for (const r of ['/app', '/app/log']) {
        await L.hashGo(page, r);
        bad.push(...(await L.smallTargets(page)).filter((t) => t.text !== 'Ondessa').map((t) => [r, t]));
      }
      assert.deepEqual(bad.map(([r, t]) => `${r} ${t.tag} "${t.text}" ${t.w}x${t.h}`), []);
    },
  },
  {
    name: 'touch targets ≥ 44px: Settings, Calendar, footer links',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData());
      const bad = [];
      for (const r of ['/app/settings', '/app/calendar', '/']) {
        await L.hashGo(page, r);
        bad.push(...(await L.smallTargets(page)).map((t) => `${r} ${t.tag} "${t.text}" ${t.w}x${t.h}`));
      }
      assert.deepEqual(bad, []);
    },
  },
  {
    name: 'toggle switches respond to a tap anywhere on the visible switch',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData(), { route: '/app/settings' });
      const sw = page.getByRole('switch', { name: 'Daily check-in' });
      await sw.scrollIntoViewIfNeeded();
      const box = await page.locator('.switch').filter({ has: sw }).boundingBox();
      const before = await sw.isChecked();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); // centre of the visible switch
      await page.waitForTimeout(100);
      assert.notEqual(await sw.isChecked(), before, 'tap on the centre of the switch did nothing');
      await page.mouse.click(box.x + box.width - 4, box.y + box.height - 4); // bottom-right of the knob track
      await page.waitForTimeout(100);
      assert.equal(await sw.isChecked(), before, 'tap on the right edge of the switch did nothing');
    },
  },
  {
    name: 'keyboard only: complete onboarding (goal, date, stepper, finish) with Tab/Enter/Space',
    async run() {
      const { page } = await L.open();
      await L.goto(page, '/');
      const focused = () => page.evaluate(() => { const a = document.activeElement; return (a.getAttribute('aria-label') || a.textContent || '').trim(); });
      async function tabTo(pred, max = 40) {
        for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); if (pred(await focused())) return; }
        throw new Error('focus target not reachable by Tab');
      }
      await tabTo((t) => t === 'Get started'); await page.keyboard.press('Enter');
      await tabTo((t) => t.startsWith('I understand')); await page.keyboard.press('Enter');
      await tabTo((t) => t.startsWith('Plan a pregnancy')); await page.keyboard.press('Space');
      await tabTo((t) => t === 'Continue'); await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      const d = L.addDays(T, -4).split('-');
      await page.keyboard.type(`${d[1]}${d[2]}${d[0]}`);
      await tabTo((t) => t === 'Increase Usual cycle length'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      await tabTo((t) => t === 'Continue'); await page.keyboard.press('Enter');
      await tabTo((t) => t === 'Lock and encrypt with a passcode');
      await page.keyboard.press('Space');
      await page.keyboard.press('Tab'); await page.keyboard.type('2468');
      await page.keyboard.press('Tab'); await page.keyboard.type('2468');
      await tabTo((t) => t === 'Finish setup'); await page.keyboard.press('Enter');
      await page.waitForURL(/#\/plans/, { timeout: 10000 });
      const v = await L.readVault(page);
      assert.equal(v.mode, 'locked');
    },
  },
  {
    name: 'keyboard only: log flow, energy and a note, with a visible focus indicator',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData(), { route: '/app' });
      const info = () => page.evaluate(() => {
        const a = document.activeElement; const cs = getComputedStyle(a);
        return { t: (a.getAttribute('aria-label') || a.textContent || '').trim(), ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' };
      });
      async function tabTo(t, max = 80) {
        for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); const f = await info(); if (f.t === t) return f; }
        throw new Error(`"${t}" not reachable by Tab`);
      }
      let f = await tabTo('Log');
      assert.ok(f.ring, 'no focus ring on tab bar');
      await page.keyboard.press('Enter');
      f = await tabTo('Light');
      assert.ok(f.ring, 'no focus ring on chip');
      await page.keyboard.press('Space');
      await tabTo('Energy 3 of 5'); await page.keyboard.press('Enter');
      await tabTo('Private note'); await page.keyboard.type('typed with keys');
      await tabTo('Done'); await page.keyboard.press('Enter');
      await L.settle(page);
      const l = (await L.readVault(page)).data.logs[T];
      assert.equal(l.flow, 'light');
      assert.equal(l.energy, 3);
      assert.equal(l.note.trim(), 'typed with keys');
    },
  },
  {
    name: 'every screen has a heading and the page language is set',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData());
      assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
      const missing = [];
      for (const r of ROUTES) {
        await L.hashGo(page, r);
        const n = await page.locator('h1, h2').count();
        if (!n) missing.push(r);
      }
      assert.deepEqual(missing, []);
    },
  },
];
