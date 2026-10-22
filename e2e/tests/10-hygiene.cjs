'use strict';
const assert = require('node:assert/strict');
const L = require('../lib.cjs');

const T = L.today();

/**
 * Console errors, uncaught errors and non-localhost requests are checked by the runner after
 * every test. These tests make sure every screen and every main action is exercised at least
 * once so that check has full coverage, and that the CSP is in place.
 */
module.exports = [
  {
    name: 'crawl every public and app route (light + dark): no console errors, no external requests',
    async run() {
      for (const scheme of ['light', 'dark']) {
        const { page, mon } = await L.open({ colorScheme: scheme });
        await L.goto(page, '/');
        for (const r of ['/', '/start', '/plans', '/library', '/library/ovulation-basics', '/legal', '/help', '/privacy']) await L.hashGo(page, r);
        const d = L.emptyData(T, { logs: L.cycleHistory(L.addDays(T, -12), [28, 30, 27, 29]), settings: { goal: 'conceive', fertilitySigns: true } });
        d.appointments = [{ id: 'a1', date: L.addDays(T, 3), title: 'Scan' }];
        await L.seed(page, d);
        for (const r of ['/app', '/app/calendar', '/app/log', '/app/fertility', '/app/pregnancy', '/app/insights', '/app/more', '/app/settings', '/app/privacy', '/app/membership', '/app/library', '/app/library/ovulation-basics']) {
          await L.hashGo(page, r);
          await page.waitForTimeout(80);
        }
        assert.deepEqual(mon.external, []);
        assert.deepEqual(mon.consoleErrors, []);
      }
    },
  },
  {
    name: 'CSP meta tag restricts connections to self',
    async run() {
      const { page } = await L.open();
      await L.goto(page, '/');
      const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
      assert.match(csp, /connect-src 'self'/);
      assert.match(csp, /script-src 'self'/);
      const ref = await page.locator('meta[name=referrer]').getAttribute('content');
      assert.equal(ref, 'no-referrer');
    },
  },
  {
    name: 'routes never carry dates or health state in the URL',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -3)) }));
      const seen = new Set();
      page.on('framenavigated', (f) => seen.add(f.url()));
      for (const n of ['Calendar', 'Log', 'Patterns', 'More']) await page.getByRole('link', { name: n, exact: true }).click();
      await page.getByRole('link', { name: 'Calendar', exact: true }).click();
      await page.locator('.cal .day').nth(10).click();
      seen.add(page.url());
      for (const u of seen) assert.ok(!/\d{4}-\d{2}-\d{2}|\?/.test(u), u);
    },
  },
];
