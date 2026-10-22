'use strict';
const assert = require('node:assert/strict');
const fs = require('fs');
const L = require('../lib.cjs');

const T = L.today();

async function stored(page) {
  const v = await L.readVault(page);
  assert.ok(v, 'nothing stored in IndexedDB');
  return v;
}

module.exports = [
  {
    name: 'understand: saves locally before paywall, shows own prediction on Plans',
    async run() {
      const { page } = await L.open();
      const last = L.addDays(T, -10);
      await L.onboard(page, { goal: 'understand', lastStart: last });
      assert.match(page.url(), /#\/plans$/);
      assert.equal(await page.locator('h1').first().textContent(), 'Your first prediction is ready.');
      const card = await page.locator('[aria-label="Your prediction"]').innerText();
      assert.ok(card.includes(L.formatShort(L.addDays(last, 28))), `expected ${L.formatShort(L.addDays(last, 28))} in ${card}`);
      const v = await stored(page);
      assert.equal(v.mode, 'plain');
      assert.equal(v.data.settings.goal, 'understand');
      assert.equal(v.data.settings.showFertility, false, 'fertile days default off unless conceiving');
      assert.deepEqual(v.data.logs[last], { date: last, flow: 'unspecified' });
    },
  },
  {
    name: 'conceive: fertile days on by default, fertility signs and fertile reminder on',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { goal: 'conceive', lastStart: L.addDays(T, -5), stopBeforeFinish: true });
      assert.equal(await page.getByRole('switch', { name: 'Show estimated fertile days' }).isChecked(), true);
      await page.getByRole('button', { name: 'Finish setup' }).click();
      await page.waitForURL(/#\/plans/);
      const s = (await stored(page)).data.settings;
      assert.deepEqual([s.goal, s.showFertility, s.fertilitySigns, s.reminders.fertileWindow, s.intercourseLogging], ['conceive', true, true, true, false]);
    },
  },
  {
    name: 'conceive: fertile-days toggle can be switched off',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { goal: 'conceive', lastStart: L.addDays(T, -5), fertile: false });
      assert.equal((await stored(page)).data.settings.showFertility, false);
    },
  },
  {
    name: 'understand: fertile-days toggle can be switched on',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { goal: 'understand', lastStart: L.addDays(T, -5), fertile: true });
      assert.equal((await stored(page)).data.settings.showFertility, true);
    },
  },
  {
    name: 'perimenopause: goal saved, hot-flush and night-sweat symptoms offered',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { goal: 'perimenopause', lastStart: L.addDays(T, -40) });
      assert.equal((await stored(page)).data.settings.goal, 'perimenopause');
      await page.getByRole('button', { name: /preview pass/ }).click();
      await page.waitForURL(/#\/app$/);
      await page.getByRole('link', { name: 'Log', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'hot flush' }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'night sweats' }).count(), 1);
    },
  },
  {
    name: 'pregnant (clinician due date): week shown, period heads-up off',
    async run() {
      const { page } = await L.open();
      const due = L.addDays(T, 140); // 20 weeks
      await L.onboard(page, { goal: 'pregnant', dueDate: due });
      const v = (await stored(page)).data;
      assert.equal(v.pregnancy.clinicianDueDate, due);
      assert.equal(v.settings.reminders.periodHeadsUp, false);
      assert.equal(v.settings.showFertility, false);
      await page.getByRole('button', { name: /preview pass/ }).click();
      await page.waitForURL(/#\/app$/);
      assert.equal(await page.locator('main h1').first().textContent(), 'Week 20');
      assert.ok((await page.locator('main').innerText()).includes('(from your clinician)'));
    },
  },
  {
    name: 'pregnant (LMP): due date LMP + 280',
    async run() {
      const { page } = await L.open();
      const lmp = L.addDays(T, -70);
      await L.onboard(page, { goal: 'pregnant', lmp });
      await page.getByRole('button', { name: /preview pass/ }).click();
      await page.waitForURL(/#\/app$/);
      assert.equal(await page.locator('main h1').first().textContent(), 'Week 10');
      assert.ok((await page.locator('main').innerText()).includes(L.formatLong(L.addDays(lmp, 280))));
    },
  },
  {
    name: 'pregnant (LMP): Plans page must not promise a next-period prediction',
    bug: 'BUG-05',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { goal: 'pregnant', lmp: L.addDays(T, -20) });
      assert.equal(await page.locator('[aria-label="Your prediction"]').count(), 0, 'Plans shows "Next period · most likely" card to a pregnant user');
      assert.notEqual(await page.locator('h1').first().textContent(), 'Your first prediction is ready.');
    },
  },
  {
    name: 'pregnant: a due date beyond the allowed range is rejected at setup',
    bug: 'BUG-12',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { goal: 'pregnant', dueDate: L.addDays(T, 400), stopBeforeFinish: true }).catch(() => {});
      // Either the Continue/Finish step must be blocked, or the app must show a week afterwards.
      const finish = page.getByRole('button', { name: 'Finish setup' });
      if (await finish.count() && !(await finish.isDisabled())) {
        await finish.click();
        await page.waitForURL(/#\/plans/);
        await page.getByRole('button', { name: /preview pass/ }).click();
        await page.waitForURL(/#\/app$/);
        const h1 = await page.locator('main h1').first().textContent();
        assert.match(h1, /^Week \d+/, `accepted a due date 400 days out and now shows "${h1}" with no way to correct it`);
      }
    },
  },
  {
    name: '"I’m not sure" path: no period logged, Plans says "You’re set up", Home asks to log',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { goal: 'understand', unsure: true });
      assert.equal(await page.locator('h1').first().textContent(), 'You’re set up.');
      assert.deepEqual((await stored(page)).data.logs, {});
      await page.getByRole('button', { name: /preview pass/ }).click();
      await page.waitForURL(/#\/app$/);
      assert.ok((await page.locator('.phase-hero').innerText()).includes('Log your period to begin'));
    },
  },
  {
    name: 'date step: Continue disabled until a date or "not sure" is given',
    async run() {
      const { page } = await L.open();
      await L.goto(page, '/start');
      await page.getByRole('button', { name: 'I understand, continue' }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      const cont = page.getByRole('button', { name: 'Continue' });
      assert.equal(await cont.isDisabled(), true);
      await page.getByLabel('I’m not sure. I’ll log my next period.').check();
      assert.equal(await cont.isDisabled(), false);
      assert.equal(await page.locator('#last').isDisabled(), true);
    },
  },
  {
    name: 'cycle steppers clamp to 15–90 and 1–15',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { lastStart: L.addDays(T, -2), cycleLen: 95, periodLen: 18 });
      assert.deepEqual((await stored(page)).data.settings.cycle, { typicalCycleLength: 90, typicalPeriodLength: 15 });
      const r = await L.open();
      await L.onboard(r.page, { lastStart: L.addDays(T, -2), cycleLen: 10, periodLen: 0 });
      assert.deepEqual((await stored(r.page)).data.settings.cycle, { typicalCycleLength: 15, typicalPeriodLength: 1 });
    },
  },
  {
    name: 'passcode on: validation (4–8 digits, must match) and data stored encrypted',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { lastStart: L.addDays(T, -3), stopBeforeFinish: true });
      await page.getByRole('switch', { name: 'Lock and encrypt with a passcode' }).check();
      const finish = page.getByRole('button', { name: 'Finish setup' });
      await page.getByLabel('New passcode').fill('12');
      await page.getByLabel('Repeat passcode').fill('12');
      assert.equal(await finish.isDisabled(), true, 'short passcode accepted');
      await page.getByLabel('New passcode').fill('1234');
      await page.getByLabel('Repeat passcode').fill('1235');
      assert.equal(await finish.isDisabled(), true, 'mismatch accepted');
      assert.equal(await page.getByText('Passcodes don’t match.').count(), 1);
      await page.getByLabel('New passcode').fill('12ab34');
      assert.equal(await page.getByLabel('New passcode').inputValue(), '1234');
      await page.getByLabel('Repeat passcode').fill('1234');
      await finish.click();
      await page.waitForURL(/#\/plans/);
      const v = await stored(page);
      assert.equal(v.mode, 'locked');
      assert.ok(!JSON.stringify(v).includes('unspecified'), 'plaintext health data in locked record');
    },
  },
  {
    name: 'passcode off: data stored plain',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { lastStart: L.addDays(T, -3) });
      assert.equal((await stored(page)).mode, 'plain');
    },
  },
  {
    name: 'restore from backup before purchase: plain, encrypted, wrong password, garbage',
    async run() {
      // Make backups from a seeded install.
      const src = await L.open();
      const data = L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -6), 4) });
      data.logs[T] = { date: T, symptoms: ['acne'] };
      await L.seed(src.page, data, { route: '/app/privacy' });
      await src.page.getByLabel('Backup password', { exact: true }).fill('correct horse');
      const [enc] = await Promise.all([src.page.waitForEvent('download'), src.page.getByRole('button', { name: 'Encrypted backup' }).click()]);
      await enc.saveAs('/tmp/ondessa-e2e-enc.json');
      const [pl] = await Promise.all([src.page.waitForEvent('download'), src.page.getByRole('button', { name: 'Unencrypted JSON' }).click()]);
      await pl.saveAs('/tmp/ondessa-e2e-plain.json');
      fs.writeFileSync('/tmp/ondessa-e2e-garbage.json', '{{{ not json');

      const { page } = await L.open();
      await L.goto(page, '/start');
      await page.getByText('Moving from another device? Restore a backup').click();
      await page.getByLabel('Backup file').setInputFiles('/tmp/ondessa-e2e-garbage.json');
      await page.getByText('This is not an Ondessa backup file.').waitFor();
      await page.getByLabel('Backup file').setInputFiles('/tmp/ondessa-e2e-enc.json');
      await page.getByText('This backup is encrypted. Enter its password.').waitFor();
      await page.getByLabel('Backup password').fill('wrong password');
      await page.getByRole('button', { name: 'Unlock backup' }).click();
      await page.getByText('That password did not open the backup.').waitFor({ timeout: 10000 });
      await page.getByLabel('Backup password').fill('correct horse');
      await page.getByRole('button', { name: 'Unlock backup' }).click();
      await page.waitForURL(/#\/plans/, { timeout: 10000 });
      let v = await stored(page);
      assert.deepEqual(v.data.logs[T], { date: T, symptoms: ['acne'] });

      const r = await L.open();
      await L.goto(r.page, '/start');
      await r.page.getByText('Moving from another device? Restore a backup').click();
      await r.page.getByLabel('Backup file').setInputFiles('/tmp/ondessa-e2e-plain.json');
      await r.page.waitForURL(/#\/plans/);
      v = await stored(r.page);
      assert.equal(Object.keys(v.data.logs).length, 5);
    },
  },
  {
    name: 'returning user on /start is sent into the app',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -3)) }));
      await L.hashGo(page, '/start');
      await page.waitForURL(/#\/app$/);
    },
  },
];
