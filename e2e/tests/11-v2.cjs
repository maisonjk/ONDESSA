'use strict';
const assert = require('node:assert/strict');
const fs = require('fs');
const L = require('../lib.cjs');

const T = L.today();

/** Seven 28-day cycles, the latest started 20 days ago, with bloating 3 and 2 days before each period. */
function bloatingData(extra = {}) {
  const logs = L.cycleHistory(L.addDays(T, -20), [28, 28, 28, 28, 28, 28]);
  const starts = Object.keys(logs).filter((d) => !logs[L.addDays(d, -1)]).sort();
  for (const s of starts.slice(1)) {
    for (const k of [3, 2]) { const d = L.addDays(s, -k); logs[d] = { ...(logs[d] || {}), date: d, symptoms: ['bloating'] }; }
  }
  return L.emptyData(T, { logs, ...extra });
}

module.exports = [
  {
    name: 'Today: heads-up from a pre-period pattern, with its evidence, links to Insights',
    async run() {
      const { page } = await L.open();
      await L.seed(page, bloatingData());
      const card = page.locator('a.heads-up');
      await card.waitFor();
      const text = await card.innerText();
      assert.match(text, /Bloating usually starts in about 5 days\./);
      assert.match(text, /6 of your last 6 cycles/);
      await card.click();
      await page.waitForURL(/#\/app\/insights$/);
    },
  },
  {
    name: 'Today: no heads-up without a pattern',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.cycleHistory(L.addDays(T, -20), [28, 28, 28]) }));
      assert.equal(await page.locator('a.heads-up').count(), 0);
    },
  },
  {
    name: 'Today: log tiles open the right section and show what is logged',
    async run() {
      const { page } = await L.open();
      await L.seed(page, bloatingData());
      await page.getByRole('link', { name: 'Sleep', exact: true }).click();
      await page.waitForURL(/#\/app\/log$/);
      await page.getByRole('button', { name: 'Sleep quality 4 of 5' }).click();
      await page.getByRole('button', { name: 'Done' }).click();
      await page.waitForURL(/#\/app$/);
      assert.equal(await page.getByRole('link', { name: 'Sleep, logged today' }).count(), 1);
      assert.equal(await page.getByRole('link', { name: 'Mood', exact: true }).count(), 1);
    },
  },
  {
    name: 'Log: symptoms common at this point in the cycle come first; the saved bar counts entries',
    async run() {
      const { page } = await L.open();
      const d = bloatingData();
      await L.seed(page, d, { route: '/app/log' });
      // today is cycle day 21; bloating was logged on days 25-26 earlier, too far → normal order
      let first = await page.locator('#log-symptoms .chips .chip').first().innerText();
      assert.equal(first.trim(), 'bloating', 'most-logged symptom first');
      const bar = page.locator('.saved-bar');
      assert.match(await bar.innerText(), /Nothing yet/);
      await page.getByRole('button', { name: 'cramps', exact: true }).click();
      await page.getByRole('button', { name: 'calm', exact: true }).click();
      assert.match(await bar.innerText(), /2 entries today/);
      // four days before the period, bloating is marked as common around now
      const near = bloatingData();
      await L.seed(page, { ...near, logs: Object.fromEntries(Object.entries(near.logs).map(([k, v]) => [L.addDays(k, -5), { ...v, date: L.addDays(k, -5) }])) }, { route: '/app/log' });
      assert.equal(await page.locator('#log-symptoms .hint-dot').count(), 1);
      assert.match(await page.locator('#log-symptoms').innerText(), /often log around this point/);
    },
  },
  {
    name: 'Insights: numbers, evidence strips and the recap link',
    async run() {
      const { page } = await L.open();
      await L.seed(page, bloatingData(), { route: '/app/insights' });
      const nums = await page.getByRole('group', { name: 'Your numbers' }).innerText();
      assert.match(nums, /28\s*d\s*Typical cycle/);
      assert.match(nums, /all equal/);
      assert.match(await page.locator('main').innerText(), /6 of your last 6 cycles/);
      await page.getByRole('link', { name: /Last cycle recap/ }).click();
      await page.waitForURL(/#\/app\/recap$/);
      assert.equal(await page.locator('h1').innerText(), 'Predicted to the day.');
      assert.doesNotMatch(await page.locator('main').innerText(), /Most logged/);
      await page.getByRole('switch', { name: 'Include symptoms and mood' }).click();
      assert.match(await page.locator('main').innerText(), /Most logged: bloating/);
    },
  },
  {
    name: 'Insights: new users see a countdown to patterns and a way to add past periods',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -9)) }), { route: '/app/insights' });
      assert.equal(await page.locator('h1').innerText(), 'Your first patterns arrive in 3 cycles');
      await page.getByRole('link', { name: 'Skip the wait: add past periods' }).click();
      await page.waitForURL(/#\/app\/history$/);
    },
  },
  {
    name: 'Past periods: earlier starts are saved, near-duplicates ignored, and predictions use them',
    async run() {
      const { page } = await L.open();
      const last = L.addDays(T, -9);
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, last) }), { route: '/app/history' });
      await page.fill('#past-0', L.addDays(last, -30));
      await page.fill('#past-1', L.addDays(last, -60));
      await page.fill('#past-2', L.addDays(last, -65)); // within 15 days of another: ignored
      await page.getByRole('button', { name: 'Save 2 periods' }).click();
      await page.waitForURL(/#\/app\/insights$/);
      await L.settle(page);
      const v = (await L.readVault(page)).data;
      assert.deepEqual(v.logs[L.addDays(last, -30)], { date: L.addDays(last, -30), flow: 'unspecified' });
      assert.ok(v.logs[L.addDays(last, -60)]);
      assert.equal(v.logs[L.addDays(last, -65)], undefined);
      assert.match(await page.locator('main').innerText(), /2 of 3 cycles/);
    },
  },
  {
    name: 'Onboarding: earlier period dates give a history-based first prediction',
    async run() {
      const { page } = await L.open();
      const last = L.addDays(T, -10);
      await L.onboard(page, { goal: 'understand', lastStart: last, earlier: [L.addDays(last, -31), L.addDays(last, -62)] });
      const v = (await L.readVault(page)).data;
      assert.deepEqual(Object.keys(v.logs).sort(), [L.addDays(last, -62), L.addDays(last, -31), last]);
      const card = await page.locator('[aria-label="Your prediction"]').innerText();
      // two 31-day cycles blended with the entered 28 days: (31 + 31 + 28) / 3 = 30
      assert.ok(card.includes(L.formatShort(L.addDays(last, 30))), `expected a 30-day cycle in ${card}`);
    },
  },
  {
    name: 'Partner sharing: preview follows the switches; nothing private; share copies the message',
    async run() {
      const { page, ctx } = await L.open();
      await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
      await L.seed(page, bloatingData(), { route: '/app/share' });
      const preview = page.getByRole('region', { name: 'Message preview' });
      assert.match(await preview.innerText(), /Period expected in about 8 days/);
      assert.match(await preview.innerText(), /Current phase: luteal \(estimate\)/);
      assert.doesNotMatch(await preview.innerText(), /bloating/i);
      await page.getByRole('switch', { name: 'Current phase' }).click();
      assert.doesNotMatch(await preview.innerText(), /phase/);
      await page.evaluate(() => { delete Navigator.prototype.share; });
      await page.getByRole('button', { name: 'Share update' }).click();
      await page.getByRole('status').getByText(/Copied/).waitFor();
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(clip, /Period expected in about 8 days/);
      assert.equal(await page.getByRole('switch', { name: 'Fertile window' }).count(), 1);
      await L.seed(page, bloatingData({ settings: { showFertility: false } }), { route: '/app/share' });
      assert.equal(await page.getByRole('switch', { name: 'Fertile window' }).count(), 0);
    },
  },
  {
    name: 'Partner sharing: calendar file has discreet titles and the predicted windows',
    async run() {
      const { page } = await L.open();
      await L.seed(page, bloatingData(), { route: '/app/share' });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Create calendar file' }).click()]);
      assert.match(dl.suggestedFilename(), /\.ics$/);
      const ics = fs.readFileSync(await dl.path(), 'utf8');
      assert.match(ics, /^BEGIN:VCALENDAR/);
      assert.match(ics, /SUMMARY:Ondessa/);
      assert.doesNotMatch(ics, /Period/);
      const nextExpected = L.addDays(T, 8).replace(/-/g, '');
      assert.match(ics, new RegExp(`UID:${nextExpected}-period`));
    },
  },
  {
    name: 'You: membership and privacy status; the tab stays selected on screens it opens',
    async run() {
      const { page } = await L.open();
      await L.seed(page, bloatingData());
      await page.getByRole('link', { name: 'You', exact: true }).click();
      await page.waitForURL(/#\/app\/you$/);
      const main = await page.locator('main').innerText();
      assert.match(main, /Preview pass/i);
      assert.match(main, /Stored only on this device/);
      assert.match(main, /passcode off/);
      await page.getByRole('link', { name: /Reminders & settings/ }).click();
      await page.waitForURL(/#\/app\/settings$/);
      assert.equal(await page.locator('.tabbar [aria-current=page]').textContent(), 'You');
      await L.hashGo(page, '/app/more');
      assert.match(await page.locator('h1').innerText(), /^You$/);
    },
  },
  {
    name: 'Appearance: a forced theme survives a reload; Auto follows the device again',
    async run() {
      const { page } = await L.open({ colorScheme: 'light' });
      await L.seed(page, bloatingData(), { route: '/app/settings' });
      await page.getByRole('group', { name: 'Appearance' }).getByRole('button', { name: 'Dark' }).click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
      await page.reload();
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert.equal(bg, 'rgb(17, 11, 19)');
      await page.getByRole('group', { name: 'Appearance' }).getByRole('button', { name: 'Auto' }).click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), undefined);
    },
  },
  ...['light', 'dark'].map((scheme) => ({
    name: `axe (WCAG 2.1 AA, no exceptions) and 44px targets, ${scheme}: heads-up, tiles, insights, recap, sharing, You, past periods`,
    timeout: 120000,
    async run() {
      const { page } = await L.open({ colorScheme: scheme });
      await L.seed(page, bloatingData());
      const problems = [];
      for (const r of ['/app', '/app/log', '/app/insights', '/app/recap', '/app/share', '/app/you', '/app/history', '/app/settings']) {
        await L.hashGo(page, r);
        await page.waitForTimeout(150);
        if (r === '/app/recap') await page.getByRole('switch', { name: 'Include symptoms and mood' }).click();
        for (const v of await L.axe(page)) problems.push(`${r}: ${v.id} ${v.nodes.slice(0, 2).join(' | ')}`);
        for (const t of await L.smallTargets(page)) problems.push(`${r}: small target ${JSON.stringify(t)}`);
      }
      assert.deepEqual(problems, []);
    },
  })),
];
