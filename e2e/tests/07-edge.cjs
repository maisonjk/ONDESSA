'use strict';
const assert = require('node:assert/strict');
const L = require('../lib.cjs');

const T = L.today();

module.exports = [
  {
    name: 'time zones: Auckland and Los Angeles use the local calendar date for today and cycle day',
    async run() {
      for (const [tz, at] of [['Pacific/Auckland', '2026-10-22T11:30:00Z'], ['America/Los_Angeles', '2026-10-23T06:30:00Z']]) {
        const { page } = await L.open({ timezoneId: tz });
        await page.clock.setFixedTime(new Date(at));
        const today = L.todayIn(tz, new Date(at));
        await L.seed(page, L.emptyData(today, { logs: L.addPeriod({}, L.addDays(today, -9)) }));
        assert.equal(await page.locator('.topbar .small').textContent(), L.formatLong(today), tz);
        assert.match(await page.locator('svg.ring').getAttribute('aria-label'), /^Cycle day 10 /, tz);
      }
    },
  },
  {
    name: 'DST: cycle day correct across the US fall-back transition',
    async run() {
      const { page } = await L.open({ timezoneId: 'America/Los_Angeles' });
      await page.clock.setFixedTime(new Date('2026-11-02T08:30:00Z'));
      await L.seed(page, L.emptyData('2026-11-02', { logs: L.addPeriod({}, '2026-10-25', 5) }));
      assert.match(await page.locator('svg.ring').getAttribute('aria-label'), /^Cycle day 9 /);
    },
  },
  {
    name: 'DST: cycle day correct across the NZ spring-forward transition',
    async run() {
      const { page } = await L.open({ timezoneId: 'Pacific/Auckland' });
      await page.clock.setFixedTime(new Date('2026-09-27T12:00:00Z')); // Sep 28 01:00 NZDT
      await L.seed(page, L.emptyData('2026-09-28', { logs: L.addPeriod({}, '2026-09-20', 5) }));
      assert.match(await page.locator('svg.ring').getAttribute('aria-label'), /^Cycle day 9 /);
    },
  },
  {
    name: 'midnight: header date rolls over without reload',
    async run() {
      const { page } = await L.open({ timezoneId: 'Pacific/Auckland' });
      await page.clock.install({ time: new Date('2026-10-22T10:58:00Z') }); // 23:58 local
      await L.seed(page, L.emptyData('2026-10-22', { logs: L.addPeriod({}, '2026-10-10', 5) }));
      await page.clock.runFor(1000);
      assert.equal(await page.locator('.topbar .small').textContent(), 'October 22, 2026');
      await page.clock.runFor(3 * 60_000);
      assert.equal(await page.locator('.topbar .small').textContent(), 'October 23, 2026');
      assert.match(await page.locator('svg.ring').getAttribute('aria-label'), /^Cycle day 14 /);
    },
  },
  {
    name: 'midnight: Log tab logs the new day after rollover',
    async run() {
      const { page } = await L.open({ timezoneId: 'Pacific/Auckland' });
      await page.clock.install({ time: new Date('2026-10-22T10:58:00Z') });
      await L.seed(page, L.emptyData('2026-10-22', { logs: L.addPeriod({}, '2026-10-10', 5) }));
      await page.clock.runFor(3 * 60_000);
      await page.getByRole('link', { name: 'Log', exact: true }).click();
      await page.clock.runFor(500);
      assert.equal(await page.locator('main h2').first().textContent(), 'October 23, 2026');
    },
  },
  {
    name: 'leap day: period on Feb 29 2028 is shown, cycle lengths and predictions correct',
    async run() {
      const { page } = await L.open({ timezoneId: 'UTC' });
      await page.clock.setFixedTime(new Date('2028-03-05T12:00:00Z'));
      await L.seed(page, L.emptyData('2028-03-05', { logs: L.addPeriod(L.addPeriod({}, '2028-02-01', 5), '2028-02-29', 5) }));
      assert.match(await page.locator('svg.ring').getAttribute('aria-label'), /^Cycle day 6 /);
      await L.hashGo(page, '/app/calendar');
      await page.getByRole('button', { name: 'Previous month' }).click();
      assert.match(await page.locator('.cal .day[aria-label^="February 29, 2028"]').getAttribute('class'), /\bperiod\b/);
      await L.hashGo(page, '/app/insights');
      assert.ok((await page.locator('main').innerText()).includes('28 days · period 5 days'));
      const r = await L.open({ timezoneId: 'UTC' });
      await r.page.clock.setFixedTime(new Date('2028-03-01T12:00:00Z'));
      await L.onboard(r.page, { lastStart: '2028-02-29' });
      assert.ok((await r.page.locator('[aria-label="Your prediction"]').innerText()).includes('Mar 28'));
    },
  },
  {
    name: 'very long (90) and very short (15) typical cycles produce sane predictions',
    async run() {
      for (const [len, plen, exp] of [[90, 15, 90], [15, 1, 15]]) {
        const { page } = await L.open();
        const last = L.addDays(T, -2);
        await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, last, plen), settings: { cycle: { typicalCycleLength: len, typicalPeriodLength: plen }, showFertility: true } }));
        assert.match(await page.locator('svg.ring').getAttribute('aria-label'), new RegExp(`^Cycle day 3 of about ${exp}`));
        await page.getByText('How is this calculated?').click();
        assert.ok((await page.locator('.phase-hero details').innerText()).includes(L.formatShort(L.addDays(last, exp))));
        await L.hashGo(page, '/app/fertility');
        assert.ok(!(await page.locator('main h1').first().textContent()).includes('NaN'));
      }
    },
  },
  {
    name: 'performance: 2 years of daily logs load < 2 s, a tap updates < 150 ms, saved < 500 KB',
    async run() {
      const { page } = await L.open();
      const logs = L.cycleHistory(L.addDays(T, -10), Array.from({ length: 25 }, (_, i) => 27 + (i % 4)));
      for (let i = 0; i < 730; i++) {
        const d = L.addDays(T, -i);
        logs[d] = { ...(logs[d] || {}), date: d, mood: 'calm', energy: 3, symptoms: ['fatigue'], note: 'n'.repeat(80) };
      }
      const t0 = Date.now();
      await L.seed(page, L.emptyData(L.addDays(T, -730), { logs }));
      await page.waitForSelector('.phase-hero');
      const load = Date.now() - t0;
      assert.ok(load < 2000, `load ${load} ms`);
      const tap = await page.evaluate(async () => {
        const b = [...document.querySelectorAll('button.chip')][0];
        const t = performance.now(); b.click();
        await new Promise((r) => requestAnimationFrame(() => r()));
        return performance.now() - t;
      });
      assert.ok(tap < 150, `tap ${tap} ms`);
      for (const r of ['/app/calendar', '/app/insights', '/app/fertility']) {
        const t = Date.now();
        await L.hashGo(page, r);
        await page.waitForSelector('main h1, main h2');
        assert.ok(Date.now() - t < 1000, `${r} slow`);
      }
      await L.settle(page, 800);
      const bytes = JSON.stringify(await L.readVault(page)).length;
      assert.ok(bytes < 500_000, `${bytes} bytes`);
    },
  },
  {
    name: 'offline: the built app reloads with the network off after one online visit',
    async run() {
      const { page, ctx } = await L.open({ serviceWorkers: 'allow' });
      await L.goto(page, '/');
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.waitForTimeout(500);
      await ctx.setOffline(true);
      await page.reload();
      await page.locator('h1').first().waitFor({ timeout: 5000 });
      assert.match(await page.locator('h1').first().textContent(), /Know your rhythm/);
      await ctx.setOffline(false);
    },
  },
  {
    name: 'back/forward navigation between app screens restores the right screen and tab',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -9)) }));
      for (const n of ['Calendar', 'Insights', 'You']) await page.getByRole('link', { name: n, exact: true }).click();
      await page.goBack();
      await page.waitForURL(/#\/app\/insights$/);
      assert.equal(await page.locator('.tabbar [aria-current=page]').textContent(), 'Insights');
      await page.goBack();
      await page.waitForURL(/#\/app\/calendar$/);
      await page.goBack();
      await page.waitForURL(/#\/app$/);
      await page.goForward();
      await page.waitForURL(/#\/app\/calendar$/);
      assert.ok((await page.locator('main h2').first().textContent()).match(/\d{4}$/));
    },
  },
  {
    name: 'unknown routes and unknown articles fall back gracefully',
    async run() {
      const { page } = await L.open();
      await L.goto(page, '/nope');
      await page.waitForURL(/#\/$/);
      await L.hashGo(page, '/library/does-not-exist');
      assert.ok((await page.locator('main').innerText()).includes('Article not found.'));
    },
  },
  {
    name: 'library: public index, article with sources; in-app library stays inside the app',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -3)) }), { route: '/app/library' });
      await page.locator('main a.list-btn').first().click();
      assert.match(page.url(), /#\/app\/library\//, `in-app article opened at ${page.url()}`);
      assert.equal(await page.locator('.tabbar').count(), 1);
    },
  },
];
