'use strict';
const assert = require('node:assert/strict');
const L = require('../lib.cjs');

const T = L.today();

function pregnantData(extra = {}) {
  return L.emptyData(T, {
    logs: L.addPeriod({}, L.addDays(T, -130), 5),
    settings: { goal: 'pregnant', reminders: { periodHeadsUp: false, periodHeadsUpDays: 2, fertileWindow: false, dailyLog: false, discreet: true } },
    pregnancy: { startedOn: L.addDays(T, -90), lmp: L.addDays(T, -130) },
    appointments: [{ id: 'a1', date: L.addDays(T, 12), title: 'Anatomy scan' }],
    ...extra,
  });
}

/** Seven 28-day cycles with bloating 3 and 2 days before each period; latest started `ago` days back. */
function bloating(ago) {
  const logs = L.cycleHistory(L.addDays(T, -ago), [28, 28, 28, 28, 28, 28]);
  const starts = Object.keys(logs).filter((d) => !logs[L.addDays(d, -1)]).sort();
  for (const s of starts.slice(1)) for (const k of [3, 2]) { const d = L.addDays(s, -k); logs[d] = { ...(logs[d] || {}), date: d, symptoms: ['bloating'] }; }
  return L.emptyData(T, { logs });
}

module.exports = [
  {
    name: 'pregnancy: Today is the full dashboard with week notes, appointments and log tiles (no period tile)',
    async run() {
      const { page } = await L.open();
      await L.seed(page, pregnantData());
      const main = await page.locator('main').innerText();
      assert.match(main, /Week 18/);
      assert.match(main, /weeks 14–\d+/i);
      assert.match(main, /Anatomy scan/);
      assert.match(main, /Today’s journal/);
      assert.equal(await page.getByRole('link', { name: 'Period', exact: true }).count(), 0);
      assert.equal(await page.getByRole('link', { name: 'Symptoms', exact: true }).count(), 1);
      assert.equal(await page.locator('.tabbar [aria-current=page]').textContent(), 'Today');
    },
  },
  {
    name: 'pregnancy: calendar shows weeks and no period predictions; bleeding is logged as spotting with a call-for-help note',
    async run() {
      const { page } = await L.open();
      await L.seed(page, pregnantData(), { route: '/app/calendar' });
      const main = await page.locator('main').innerText();
      assert.doesNotMatch(main, /Most likely|Possible/);
      assert.match(main, /Pregnancy week 18/);
      await L.hashGo(page, '/app/log');
      await page.getByRole('heading', { name: 'Spotting or bleeding' }).waitFor();
      await page.getByRole('button', { name: 'Spotting or bleeding' }).click();
      assert.match(await page.locator('#log-flow').innerText(), /should be checked/);
      await L.settle(page);
      assert.equal((await L.readVault(page)).data.logs[T].flow, 'spotting', 'never starts a period');
    },
  },
  {
    name: 'pregnancy: ending it uses an in-app panel from Settings too, and keeps history',
    async run() {
      const { page, mon } = await L.open();
      await L.seed(page, pregnantData(), { route: '/app/settings' });
      await page.getByLabel('Life stage').selectOption('understand');
      await page.getByRole('alertdialog').waitFor();
      await page.getByRole('button', { name: 'Keep pregnancy mode' }).click();
      assert.equal(await page.getByLabel('Life stage').inputValue(), 'pregnant');
      await page.getByLabel('Life stage').selectOption('understand');
      await page.getByRole('button', { name: 'Yes, end pregnancy mode' }).click();
      await L.settle(page);
      const v = (await L.readVault(page)).data;
      assert.equal(v.pregnancy, undefined);
      assert.equal(v.pastPregnancies.length, 1);
      assert.equal(v.settings.goal, 'understand');
      assert.equal(mon.dialogs.length, 0);
    },
  },
  {
    name: 'paywall: plans come before the benefits; pregnant users see their week and pregnancy benefits first',
    async run() {
      const { page } = await L.open();
      await L.seed(page, pregnantData(), { entitled: false, route: '/plans' });
      const card = await page.getByRole('region', { name: 'Your pregnancy' }).innerText();
      assert.match(card, /Week 18/);
      const order = await page.evaluate(() => {
        const grid = document.querySelector('.price-grid');
        const list = document.querySelector('.benefit-list');
        return !!(grid.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      assert.ok(order, 'price grid should come before the benefits');
      assert.match(await page.locator('.benefit-list li').first().innerText(), /^Pregnancy, week by week/);
      const priceTop = await page.locator('.price-grid').evaluate((e) => e.getBoundingClientRect().top + window.scrollY);
      assert.ok(priceTop < 900, `plans start at ${priceTop}px`);
    },
  },
  {
    name: 'Today: a heads-up symptom stays one tap away even when flow chips lead',
    async run() {
      const { page } = await L.open();
      await L.seed(page, bloating(26)); // two days before the expected period
      assert.match(await page.locator('a.heads-up').innerText(), /Bloating/);
      assert.equal(await page.getByRole('group', { name: 'Flow' }).count(), 1);
      await page.getByRole('group', { name: 'Quick symptoms' }).getByRole('button', { name: 'bloating' }).click();
      await L.settle(page);
      assert.deepEqual((await L.readVault(page)).data.logs[T].symptoms, ['bloating']);
    },
  },
  {
    name: 'Today: no history card before any period; a late period links to test timing',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, {}));
      assert.doesNotMatch(await page.locator('main').innerText(), /history is still short|cycle length you entered/);
      await L.seed(page, L.emptyData(T, { logs: L.cycleHistory(L.addDays(T, -34), [28, 28, 28]) }));
      await page.getByRole('link', { name: /pregnancy test is most reliable/ }).click();
      await page.waitForURL(/#\/app\/library\/when-to-test$/);
    },
  },
  {
    name: 'Today: week strip names are clean for screen readers',
    async run() {
      const { page } = await L.open();
      await L.seed(page, bloating(20));
      const names = await page.locator('.week-strip button').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
      for (const n of names) {
        assert.doesNotMatch(n, /\(estimate\) \(estimate\)/, n);
        assert.doesNotMatch(n, / ,/, n);
      }
    },
  },
  {
    name: 'Log: note shows a counter and says when the limit is reached',
    async run() {
      const { page } = await L.open();
      await L.seed(page, bloating(20), { route: '/app/log' });
      await page.getByLabel('Private note').fill('x'.repeat(2100));
      assert.match(await page.locator('#note-count').innerText(), /Limit reached/);
      await page.getByLabel('Private note').fill('hello');
      assert.equal(await page.locator('#note-count').innerText(), '5 / 2000');
    },
  },
  {
    name: 'Onboarding: a reload keeps answers (never the passcode); finishing clears them',
    async run() {
      const { page } = await L.open();
      const last = L.addDays(T, -9);
      await L.onboard(page, { goal: 'conceive', lastStart: last, stopBeforeFinish: true });
      await page.reload();
      await page.getByRole('button', { name: 'Finish setup' }).waitFor();
      const draft = await page.evaluate(() => sessionStorage.getItem('ondessa.setupDraft'));
      assert.doesNotMatch(draft, /pin/i);
      await page.getByRole('button', { name: 'Back' }).click();
      assert.equal(await page.inputValue('#last'), last);
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Finish setup' }).click();
      await page.waitForURL(/#\/plans/);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('ondessa.setupDraft')), null);
      const v = (await L.readVault(page)).data;
      assert.equal(v.settings.goal, 'conceive');
      assert.deepEqual(Object.keys(v.logs).sort(), [0, 1, 2, 3, 4].map((i) => L.addDays(last, i)));
    },
  },
  {
    name: 'tour: privacy center and membership speak about sample data',
    async run() {
      const { page } = await L.open();
      await L.goto(page, '/');
      await page.getByRole('button', { name: 'Take the tour' }).click();
      await page.waitForURL(/#\/app/);
      await L.hashGo(page, '/app/privacy');
      assert.match(await page.locator('main').innerText(), /sample data for the tour/);
      await L.hashGo(page, '/app/membership');
      assert.match(await page.locator('h1').innerText(), /on the tour/);
    },
  },
  {
    name: 'You: "New" badges disappear once the feature has been opened',
    async run() {
      const { page } = await L.open();
      await L.seed(page, bloating(20), { route: '/app/you' });
      const shareRow = page.getByRole('link', { name: /Partner sharing/ });
      assert.match(await shareRow.innerText(), /NEW/);
      await shareRow.click();
      await page.waitForURL(/#\/app\/share$/);
      await L.hashGo(page, '/app/you');
      assert.doesNotMatch(await page.getByRole('link', { name: /Partner sharing/ }).innerText(), /NEW/);
    },
  },
  {
    name: 'Help: support email is shown as a mail link',
    async run() {
      const { page } = await L.open();
      await L.goto(page, '/help');
      const a = page.getByRole('link', { name: 'innerlink24@gmail.com' });
      assert.match(await a.getAttribute('href'), /^mailto:innerlink24@gmail\.com/);
    },
  },
  ...['light', 'dark'].map((scheme) => ({
    name: `axe (no exceptions) and 44px targets, ${scheme}: pregnancy Today, Calendar, Log, Settings panel, pregnant paywall, privacy without membership`,
    timeout: 120000,
    async run() {
      const { page } = await L.open({ colorScheme: scheme });
      const problems = [];
      const check = async (label) => {
        for (const v of await L.axe(page)) problems.push(`${label}: ${v.id} ${v.nodes.slice(0, 2).join(' | ')}`);
        for (const t of await L.smallTargets(page)) problems.push(`${label}: small target ${JSON.stringify(t)}`);
      };
      await L.seed(page, pregnantData());
      for (const r of ['/app', '/app/calendar', '/app/log']) { await L.hashGo(page, r); await page.waitForTimeout(150); await check(r); }
      await L.hashGo(page, '/app/settings');
      await page.getByLabel('Life stage').selectOption('understand');
      await check('/app/settings (end panel)');
      await L.seed(page, pregnantData(), { entitled: false, route: '/plans' });
      await check('/plans pregnant');
      await L.hashGo(page, '/app/privacy');
      await page.waitForTimeout(150);
      await check('/app/privacy limited');
      assert.deepEqual(problems.filter((p) => !/small target .*"(Terms of Use|Privacy Policy)"/.test(p)), []);
    },
  })),
];
