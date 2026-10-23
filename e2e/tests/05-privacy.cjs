'use strict';
const assert = require('node:assert/strict');
const fs = require('fs');
const L = require('../lib.cjs');

const T = L.today();

function richData() {
  const d = L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -6), 4) });
  d.logs[T] = { date: T, symptoms: ['headache'], note: 'secret note' };
  return d;
}

async function unlock(page, pin) {
  await page.getByLabel('Passcode').fill(pin);
  await page.getByRole('button', { name: 'Unlock' }).click();
}

async function turnOnPasscode(page, pin) {
  await page.getByLabel('Passcode', { exact: true }).fill(pin);
  await page.getByRole('button', { name: 'Turn on' }).click();
  await page.getByText('Passcode on: data encrypted').waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
}

module.exports = [
  {
    name: 'passcode: lock on reload, wrong passcode rejected, unlock returns to the deep-linked screen',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData(), { route: '/app/privacy' });
      await turnOnPasscode(page, '2468');
      const v = await L.readVault(page);
      assert.equal(v.mode, 'locked');
      assert.ok(!JSON.stringify(v).includes('secret note'));
      await page.evaluate(() => history.replaceState(null, '', '#/app/insights'));
      await page.reload();
      await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
      assert.equal(await page.locator('.tabbar').count(), 0);
      await unlock(page, '1111');
      await page.getByRole('alert').getByText('That passcode didn’t work.').waitFor({ timeout: 10000 });
      assert.equal(await page.getByLabel('Passcode').inputValue(), '');
      await unlock(page, '2468');
      await page.waitForSelector('.tabbar', { timeout: 10000 });
      assert.match(page.url(), /#\/app\/insights$/);
    },
  },
  {
    name: 'passcode: public deep links show the lock screen too (nothing rendered behind it)',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData(), { route: '/app/privacy' });
      await turnOnPasscode(page, '2468');
      for (const r of ['/app/calendar', '/library', '/plans', '/']) {
        await page.evaluate((r) => history.replaceState(null, '', `#${r}`), r);
        await page.reload();
        await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
        assert.equal(await page.locator('main').count(), 0, `${r} rendered content while locked`);
      }
    },
  },
  {
    name: 'passcode: change passcode — old one stops working, new one works',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData(), { route: '/app/privacy' });
      await turnOnPasscode(page, '2468');
      await page.getByLabel('Passcode', { exact: true }).fill('13579');
      await page.getByRole('button', { name: 'Change' }).click();
      await page.getByText('Passcode changed').waitFor({ timeout: 10000 });
      await page.waitForTimeout(500);
      await page.reload();
      await unlock(page, '2468');
      await page.getByRole('alert').waitFor({ timeout: 10000 });
      await unlock(page, '13579');
      await page.waitForSelector('.tabbar', { timeout: 10000 });
    },
  },
  {
    name: 'passcode: turning it off stores data unencrypted and removes the lock',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData(), { route: '/app/privacy' });
      await turnOnPasscode(page, '2468');
      await page.getByRole('button', { name: 'Turn off' }).click();
      await page.getByText('Passcode off').waitFor({ timeout: 10000 });
      await page.waitForTimeout(1000);
      assert.equal((await L.readVault(page)).mode, 'plain', 'record still encrypted after "Passcode off"');
      await page.reload();
      await page.waitForSelector('.tabbar', { timeout: 5000 });
    },
  },
  {
    name: 'passcode: lockout after 5 wrong attempts survives a reload',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData(), { route: '/app/privacy' });
      await turnOnPasscode(page, '2468');
      await page.reload();
      for (let i = 0; i < 5; i++) {
        await unlock(page, '0000');
        await page.waitForFunction(() => document.querySelector('button.btn.block')?.textContent === 'Unlock');
      }
      await page.getByText(/Too many attempts/).waitFor();
      await page.reload();
      await page.getByLabel('Passcode').fill('2468');
      assert.equal(await page.getByRole('button', { name: 'Unlock' }).isDisabled(), true, 'reload resets the lockout');
    },
  },
  {
    name: 'passcode: auto-locks after 5 minutes in the background',
    async run() {
      const { page } = await L.open();
      await page.clock.install({ time: new Date() });
      await L.seed(page, richData(), { route: '/app/privacy' });
      await page.getByLabel('Passcode', { exact: true }).fill('2468');
      await page.getByRole('button', { name: 'Turn on' }).click();
      await page.getByText('Passcode on: data encrypted').waitFor({ timeout: 10000 });
      await page.waitForTimeout(500);
      await page.clock.runFor(1000);
      const setVis = (s) => page.evaluate((s) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
        document.dispatchEvent(new Event('visibilitychange'));
      }, s);
      await setVis('hidden');
      await page.clock.runFor(6 * 60_000);
      await setVis('visible');
      await page.clock.runFor(2000);
      await page.getByRole('heading', { name: 'Welcome back' }).waitFor({ timeout: 5000 });
    },
  },
  {
    name: 'export: encrypted (password ≥ 8, no plaintext) and plain (confirmation first) downloads',
    async run() {
      const { page, mon } = await L.open();
      await L.seed(page, richData(), { route: '/app/privacy' });
      const enc = page.getByRole('button', { name: 'Encrypted backup' });
      await page.getByLabel('Backup password', { exact: true }).fill('short');
      assert.equal(await enc.isDisabled(), true);
      await page.getByLabel('Backup password', { exact: true }).fill('correct horse');
      let [dl] = await Promise.all([page.waitForEvent('download'), enc.click()]);
      assert.equal(dl.suggestedFilename(), `ondessa-backup-${L.today()}.encrypted.json`); // date at download time, so a run across midnight still passes
      await dl.saveAs('/tmp/ondessa-e2e-p-enc.json');
      const encText = fs.readFileSync('/tmp/ondessa-e2e-p-enc.json', 'utf8');
      assert.equal(JSON.parse(encText).kind, 'encrypted');
      assert.ok(!encText.includes('secret note') && !encText.includes('headache'));
      page.dialogAnswer = false;
      let got = false;
      page.once('download', () => { got = true; });
      await page.getByRole('button', { name: 'Unencrypted JSON' }).click();
      await page.waitForTimeout(500);
      assert.equal(got, false, 'plain export downloaded although the warning was cancelled');
      page.dialogAnswer = true;
      [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unencrypted JSON' }).click()]);
      assert.equal(dl.suggestedFilename(), `ondessa-backup-${L.today()}.json`);
      await dl.saveAs('/tmp/ondessa-e2e-p-plain.json');
      const plain = JSON.parse(fs.readFileSync('/tmp/ondessa-e2e-p-plain.json', 'utf8'));
      assert.equal(plain.payload.logs[T].note, 'secret note');
      assert.ok(mon.dialogs.some((m) => /unencrypted export/.test(m)));
      await L.settle(page);
      assert.equal((await L.readVault(page)).data.lastBackupOn, L.today());
    },
  },
  {
    name: 'import: garbage, foreign JSON, wrong password, then correct password replaces data after confirm',
    async run() {
      const src = await L.open();
      await L.seed(src.page, richData(), { route: '/app/privacy' });
      await src.page.getByLabel('Backup password', { exact: true }).fill('correct horse');
      const [dl] = await Promise.all([src.page.waitForEvent('download'), src.page.getByRole('button', { name: 'Encrypted backup' }).click()]);
      await dl.saveAs('/tmp/ondessa-e2e-i-enc.json');
      fs.writeFileSync('/tmp/ondessa-e2e-i-garbage.json', '\u0000\u0001 binary garbage');
      fs.writeFileSync('/tmp/ondessa-e2e-i-foreign.json', JSON.stringify({ app: 'other', payload: {} }));
      fs.writeFileSync('/tmp/ondessa-e2e-i-badver.json', JSON.stringify({ app: 'ondessa', kind: 'plain', payload: { schemaVersion: 99 } }));

      const { page, mon } = await L.open();
      const other = L.emptyData(T, { logs: { [T]: { date: T, mood: 'calm' } } });
      await L.seed(page, other, { route: '/app/privacy' });
      const input = page.locator('input[type=file]');
      for (const f of ['garbage', 'foreign']) {
        await input.setInputFiles(`/tmp/ondessa-e2e-i-${f}.json`);
        await page.getByText('This is not an Ondessa backup file.').waitFor();
      }
      await input.setInputFiles('/tmp/ondessa-e2e-i-badver.json');
      await page.getByText('Unsupported data version').waitFor();
      await input.setInputFiles('/tmp/ondessa-e2e-i-enc.json');
      await page.getByLabel('Backup password to restore').fill('wrong pass');
      await page.getByRole('button', { name: 'Unlock backup' }).click();
      await page.getByText('That password did not open the backup.').waitFor({ timeout: 10000 });
      assert.deepEqual(Object.keys((await L.readVault(page)).data.logs), [T], 'data changed by a failed import');
      page.dialogAnswer = false;
      await page.getByLabel('Backup password to restore').fill('correct horse');
      await page.getByRole('button', { name: 'Unlock backup' }).click();
      await page.waitForTimeout(1500);
      assert.equal((await L.readVault(page)).data.logs[T].mood, 'calm', 'import ran although the confirm was cancelled');
      page.dialogAnswer = true;
      await page.getByRole('button', { name: 'Unlock backup' }).click();
      await page.getByText('Backup restored').waitFor({ timeout: 10000 });
      await L.settle(page);
      assert.equal((await L.readVault(page)).data.logs[T].note, 'secret note');
      assert.ok(mon.dialogs.some((m) => /Replace the data on this device with this backup \(5 logged days\)/.test(m)));
    },
  },
  {
    name: 'delete everything: requires DELETE, then IndexedDB, localStorage, sessionStorage and caches are empty',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData(), { route: '/app/privacy' });
      await page.evaluate(() => sessionStorage.setItem('x', '1'));
      const btn = page.getByRole('button', { name: 'Permanently delete' });
      await page.getByLabel('Type DELETE to confirm').fill('delet');
      assert.equal(await btn.isDisabled(), true);
      await page.getByLabel('Type DELETE to confirm').fill(' delete ');
      assert.equal(await btn.isDisabled(), false, 'any case is accepted');
      await btn.click();
      await page.waitForURL(/#\/deleted$/, { timeout: 10000 });
      assert.equal(await page.locator('h1').first().textContent(), 'Everything is deleted.');
      assert.deepEqual(await L.idbNames(page), []);
      assert.deepEqual(await L.storageKeys(page), { local: [], session: [] });
      assert.deepEqual(await page.evaluate(async () => caches.keys()), []);
      await page.reload();
      assert.equal(await L.readVault(page), null);
      await L.hashGo(page, '/app');
      await page.waitForURL(/#\/start$/);
    },
  },
  {
    name: 'delete everything with the app open in a second tab: data stays deleted',
    async run() {
      const { page, ctx } = await L.open();
      await L.seed(page, richData(), { route: '/app/privacy' });
      const tab2 = await ctx.newPage();
      await tab2.goto(`${L.BASE}/#/app`);
      await tab2.waitForSelector('.tabbar');
      await page.getByLabel('Type DELETE to confirm').fill('DELETE');
      await page.getByRole('button', { name: 'Permanently delete' }).click();
      await page.waitForURL(/#\/deleted$/, { timeout: 10000 });
      // The other tab learns about the deletion and leaves the app instead of writing data back.
      await tab2.waitForURL(/#\/(start|plans)$/, { timeout: 10000 });
      await tab2.waitForTimeout(800);
      assert.equal(await L.readVault(page), null, 'second tab wrote the deleted data back to IndexedDB');
      assert.ok(!(await tab2.locator('.tabbar').count()), 'second tab still shows the app after deletion');
    },
  },
  {
    name: 'Privacy center shows accurate counts and encryption status',
    async run() {
      const { page } = await L.open();
      await L.seed(page, richData(), { route: '/app/privacy' });
      const t = await page.locator('main').innerText();
      assert.ok(t.includes('5 logged days, 1 note, 0 appointments'), t.slice(0, 300));
      assert.ok(t.includes('Not encrypted.'));
    },
  },
];
