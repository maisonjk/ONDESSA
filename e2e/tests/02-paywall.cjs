'use strict';
const assert = require('node:assert/strict');
const L = require('../lib.cjs');

const T = L.today();
const APP_ROUTES = ['/app', '/app/calendar', '/app/log', '/app/fertility', '/app/pregnancy', '/app/insights', '/app/more', '/app/settings', '/app/privacy', '/app/membership', '/app/library'];

module.exports = [
  {
    name: 'no data: every /app route redirects to /start',
    async run() {
      const { page } = await L.open();
      await L.goto(page, '/');
      for (const r of APP_ROUTES) {
        await L.hashGo(page, r);
        await page.waitForURL(/#\/start$/);
        await L.hashGo(page, '/');
      }
    },
  },
  {
    name: 'data but no membership: every /app route (deep link and reload) redirects to /plans',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -3)) }), { entitled: false, route: '/plans' });
      for (const r of APP_ROUTES) {
        await page.evaluate((r) => history.replaceState(null, '', `#${r}`), r);
        await page.reload();
        await page.waitForURL(/#\/plans$/);
        assert.equal(await page.locator('.tabbar').count(), 0, `${r} rendered the app shell`);
      }
    },
  },
  {
    name: 'expired preview pass is not an entitlement',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -3)) }), { entitled: false, route: '/app' });
      await page.evaluate(() => localStorage.setItem('ondessa.entitlement', 'preview:1000'));
      await page.reload();
      await page.waitForURL(/#\/plans$/);
    },
  },
  {
    name: 'preview pass unlocks the app and Membership shows plan and end date',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { lastStart: L.addDays(T, -3) });
      assert.equal(await page.getByRole('button', { name: /^Continue with yearly/ }).isDisabled(), true, 'checkout should be disabled in this build');
      await page.getByRole('button', { name: /preview pass/ }).click();
      await page.waitForURL(/#\/app$/);
      assert.match(await page.evaluate(() => localStorage.getItem('ondessa.entitlement')), /^preview:\d+$/);
      await L.hashGo(page, '/app/membership');
      const text = await page.locator('main').innerText();
      assert.ok(text.includes('You’re a member'));
      assert.ok(text.includes('Preview pass'));
      await page.reload();
      await page.waitForURL(/#\/app\/membership$/);
      assert.equal(await page.locator('.tabbar').count(), 1, 'entitlement lost on reload');
    },
  },
  {
    name: 'Membership end date is the local calendar date (Los Angeles)',
    async run() {
      const at = new Date('2026-10-23T06:30:00Z'); // Oct 22, 23:30 in LA
      const { page } = await L.open({ timezoneId: 'America/Los_Angeles' });
      await page.clock.setFixedTime(at);
      const today = L.todayIn('America/Los_Angeles', at);
      await L.seed(page, L.emptyData(today, { logs: L.addPeriod({}, L.addDays(today, -3)) }), { route: '/app/membership' });
      const expires = await page.evaluate(() => Number(localStorage.getItem('ondessa.entitlement').slice(8)));
      const expected = L.formatLong(L.todayIn('America/Los_Angeles', new Date(expires * 1000)));
      const shown = (await page.locator('main').innerText()).match(/Ends\s+(.+)/)[1].trim();
      assert.equal(shown, expected);
    },
  },
  {
    name: 'restore key: garbage input is rejected and nothing is stored',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -3)) }), { entitled: false, route: '/plans' });
      await page.getByText('Restore a purchase with your membership key').click();
      const verify = page.getByRole('button', { name: 'Verify key' });
      assert.equal(await verify.isDisabled(), true);
      for (const k of ['garbage', 'a.b', 'eyJ2IjoxfQ.AAAA', 'x'.repeat(3000), '   ']) {
        await page.getByLabel('Membership key').fill(k);
        if (await verify.isDisabled()) continue;
        await verify.click();
        await page.getByText('That key could not be verified. Check it and try again.').waitFor();
      }
      assert.equal(await page.evaluate(() => localStorage.getItem('ondessa.entitlement')), null);
      await L.hashGo(page, '/app');
      await page.waitForURL(/#\/plans$/);
    },
  },
  {
    name: 'Plans with active membership offers "Open Ondessa"',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -3)) }), { route: '/plans' });
      await page.getByRole('button', { name: 'Open Ondessa' }).click();
      await page.waitForURL(/#\/app$/);
    },
  },
];
