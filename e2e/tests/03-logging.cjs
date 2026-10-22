'use strict';
const assert = require('node:assert/strict');
const L = require('../lib.cjs');

const T = L.today();

async function logs(page) {
  await L.settle(page);
  return (await L.readVault(page)).data.logs;
}

function base(settings = {}) {
  return L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -12), 5), settings });
}

module.exports = [
  {
    name: 'every field logs and persists (flow, symptoms, pain, mood, energy, sleep, mucus, LH, BBT, note)',
    async run() {
      const { page } = await L.open();
      await L.seed(page, base({ goal: 'conceive', fertilitySigns: true }), { route: '/app/log' });
      for (const n of ['Medium', 'cramps', 'acne', 'Moderate', 'anxious', 'Energy 4 of 5', 'Sleep quality 2 of 5', 'Egg-white', 'Positive']) {
        await page.getByRole('button', { name: n, exact: true }).click();
      }
      await page.fill('#bbt', '36.55');
      await page.locator('#bbt').blur();
      await page.getByLabel('Private note').fill('Remember this');
      await page.getByLabel('Private note').blur();
      const l = (await logs(page))[T];
      assert.deepEqual(
        { ...l, note: l.note.trim() },
        { date: T, flow: 'medium', symptoms: ['cramps', 'acne'], pain: 2, mood: 'anxious', energy: 4, sleep: 2, mucus: 'eggwhite', bbt: 36.55, lh: 'positive', note: 'Remember this' },
      );
      await page.reload();
      await page.waitForSelector('#bbt');
      assert.equal(await page.inputValue('#bbt'), '36.55');
      assert.equal(await page.getByRole('button', { name: 'Medium', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal((await page.getByLabel('Private note').inputValue()).trim(), 'Remember this');
    },
  },
  {
    name: 'clearing every field removes the day entirely',
    async run() {
      const { page } = await L.open();
      const d = base({ fertilitySigns: true });
      d.logs[T] = { date: T, flow: 'light', symptoms: ['acne'], mood: 'calm', energy: 3, mucus: 'dry', bbt: 36.4, note: 'x' };
      await L.seed(page, d, { route: '/app/log' });
      for (const n of ['Light', 'acne', 'calm', 'Energy 3 of 5', 'Dry']) await page.getByRole('button', { name: n, exact: true }).click();
      await page.fill('#bbt', '');
      await page.locator('#bbt').blur();
      await page.getByLabel('Private note').fill('');
      await page.getByLabel('Private note').blur();
      assert.equal(T in (await logs(page)), false);
    },
  },
  {
    name: 'past days: previous-day navigation edits the right date; future days blocked',
    async run() {
      const { page } = await L.open();
      await L.seed(page, base(), { route: '/app/log' });
      assert.equal(await page.getByRole('button', { name: 'Next day' }).isDisabled(), true);
      await page.getByRole('button', { name: 'Previous day' }).click();
      await page.getByRole('button', { name: 'Previous day' }).click();
      assert.equal(await page.locator('main h2').first().textContent(), L.formatLong(L.addDays(T, -2)));
      await page.getByRole('button', { name: 'headache' }).click();
      assert.deepEqual((await logs(page))[L.addDays(T, -2)], { date: L.addDays(T, -2), symptoms: ['headache'] });
      // Calendar: future date has no Log button and no flow chips
      await L.hashGo(page, '/app/calendar');
      await page.getByRole('button', { name: new RegExp(`^${L.formatLong(L.addDays(T, 1))}`) }).click().catch(async () => {
        await page.getByRole('button', { name: 'Next month' }).click();
        await page.getByRole('button', { name: new RegExp(`^${L.formatLong(L.addDays(T, 1))}`) }).click();
      });
      assert.equal(await page.getByRole('button', { name: /^(Log|Edit)$/ }).count(), 0);
      assert.equal(await page.getByRole('group', { name: 'Flow' }).count(), 0);
      assert.ok((await page.locator('main').innerText()).includes('Future dates show estimates only.'));
      // Log screen clamps a selected future date to today
      await L.hashGo(page, '/app/log');
      assert.equal(await page.locator('main h2').first().textContent(), L.formatLong(T));
    },
  },
  {
    name: 'calendar: edit a past day from the calendar quick-flow',
    async run() {
      const { page } = await L.open();
      await L.seed(page, base(), { route: '/app/calendar' });
      const d = L.addDays(T, -1);
      await page.getByRole('button', { name: new RegExp(`^${L.formatLong(d)}`) }).click().catch(async () => {
        await page.getByRole('button', { name: 'Previous month' }).click();
        await page.getByRole('button', { name: new RegExp(`^${L.formatLong(d)}`) }).click();
      });
      await page.getByRole('group', { name: 'Flow' }).getByRole('button', { name: 'Spotting' }).click();
      assert.equal((await logs(page))[d].flow, 'spotting');
      assert.match(await page.getByRole('button', { name: new RegExp(`^${L.formatLong(d)}`) }).getAttribute('class'), /spotting/);
    },
  },
  {
    name: 'BBT in °F converts to °C for storage and back for display',
    async run() {
      const { page } = await L.open();
      await L.seed(page, base({ fertilitySigns: true, temperatureUnit: 'F' }), { route: '/app/log' });
      assert.match(await page.locator('label[for=bbt]').textContent(), /°F/);
      await page.fill('#bbt', '97.7');
      await page.locator('#bbt').blur();
      assert.equal((await logs(page))[T].bbt, 36.5);
      await page.reload();
      await page.waitForSelector('#bbt');
      assert.equal(await page.inputValue('#bbt'), '97.70');
    },
  },
  {
    name: 'BBT invalid values are rejected with a message and do not overwrite',
    async run() {
      const { page } = await L.open();
      const d = base({ fertilitySigns: true });
      d.logs[T] = { date: T, bbt: 36.5 };
      await L.seed(page, d, { route: '/app/log' });
      for (const bad of ['120', 'abc', '33.9', '40.5', '-1']) {
        await page.fill('#bbt', bad);
        await page.locator('#bbt').blur();
        await page.getByText('That temperature looks out of range.').waitFor();
        assert.equal((await logs(page))[T].bbt, 36.5, `"${bad}" changed the stored value`);
      }
      await page.fill('#bbt', '36,7'); // comma decimal
      await page.locator('#bbt').blur();
      assert.equal((await logs(page))[T].bbt, 36.7);
    },
  },
  {
    name: 'log summary shows temperature in the user’s unit (°F)',
    async run() {
      const { page } = await L.open();
      const d = base({ fertilitySigns: true, temperatureUnit: 'F' });
      d.logs[T] = { date: T, bbt: 36.5 };
      await L.seed(page, d, { route: '/app' });
      const summary = await page.getByText(/^Logged:/).first().textContent();
      assert.ok(!summary.includes('°C'), `summary says "${summary}" for a °F user`);
    },
  },
  {
    name: 'fertility-sign fields hidden unless enabled',
    async run() {
      const { page } = await L.open();
      await L.seed(page, base({ fertilitySigns: false }), { route: '/app/log' });
      assert.equal(await page.getByRole('heading', { name: 'Fertility signs' }).count(), 0);
      assert.equal(await page.locator('#bbt').count(), 0);
    },
  },
  {
    name: 'intimacy logging: hidden by default, loggable when enabled, stripped (after confirm) when disabled',
    async run() {
      const { page, mon } = await L.open();
      await L.seed(page, base(), { route: '/app/log' });
      assert.equal(await page.getByRole('heading', { name: 'Intimacy' }).count(), 0);
      await L.hashGo(page, '/app/settings');
      await page.getByRole('switch', { name: 'Intimacy logging' }).check();
      await L.hashGo(page, '/app/log');
      await page.getByRole('button', { name: 'Sex' }).click();
      assert.equal((await logs(page))[T].intercourse, true);
      await L.hashGo(page, '/app/settings');
      page.dialogAnswer = false;
      await page.getByRole('switch', { name: 'Intimacy logging' }).click();
      let v = (await L.readVault(page)).data;
      await L.settle(page);
      v = (await L.readVault(page)).data;
      assert.equal(v.settings.intercourseLogging, true, 'cancel should keep logging on');
      assert.equal(v.logs[T].intercourse, true);
      page.dialogAnswer = true;
      await page.getByRole('switch', { name: 'Intimacy logging' }).click();
      await L.settle(page);
      v = (await L.readVault(page)).data;
      assert.equal(v.settings.intercourseLogging, false);
      assert.equal(v.logs[T]?.intercourse, undefined);
      assert.ok(mon.dialogs.some((m) => /deletes intimacy entries/.test(m)));
      await L.hashGo(page, '/app/log');
      assert.equal(await page.getByRole('heading', { name: 'Intimacy' }).count(), 0);
    },
  },
  {
    name: 'imported intimacy entries are stripped when logging is off',
    async run() {
      const fs = require('fs');
      const d = base();
      d.logs[T] = { date: T, intercourse: true, mood: 'calm' };
      fs.writeFileSync('/tmp/ondessa-e2e-intimacy.json', JSON.stringify({ app: 'ondessa', kind: 'plain', exportedOn: T, payload: d }));
      const { page } = await L.open();
      await L.seed(page, base(), { route: '/app/privacy' });
      await page.locator('input[type=file]').setInputFiles('/tmp/ondessa-e2e-intimacy.json');
      await page.getByText('Backup restored').waitFor();
      assert.deepEqual((await logs(page))[T], { date: T, mood: 'calm' });
    },
  },
  {
    name: 'Home quick log: flow chips around a period, symptom/mood chips otherwise',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -1), 2) }));
      assert.equal(await page.getByRole('group', { name: 'Flow' }).count(), 1);
      await page.getByRole('group', { name: 'Flow' }).getByRole('button', { name: 'Heavy' }).click();
      assert.equal((await logs(page))[T].flow, 'heavy');
      const r = await L.open();
      await L.seed(r.page, base());
      await r.page.getByRole('group', { name: 'Quick symptoms' }).getByRole('button').first().click();
      await r.page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'happy' }).click();
      const l = (await logs(r.page))[T];
      assert.equal(l.symptoms.length, 1);
      assert.equal(l.mood, 'happy');
    },
  },
  {
    name: 'Log (+) tab opens today after a past day was edited',
    async run() {
      const { page } = await L.open();
      await L.seed(page, base(), { route: '/app/log' });
      await page.getByRole('button', { name: 'Previous day' }).click();
      await page.getByRole('link', { name: 'Today', exact: true }).click();
      await page.getByRole('link', { name: 'Log', exact: true }).click();
      assert.equal(await page.locator('main h2').first().textContent(), L.formatLong(T));
    },
  },
];
