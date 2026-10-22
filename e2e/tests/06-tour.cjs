'use strict';
const assert = require('node:assert/strict');
const L = require('../lib.cjs');

const T = L.today();

async function startTour(page) {
  await L.goto(page, '/');
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await page.waitForURL(/#\/app$/);
  await page.locator('.tour-banner').waitFor();
}

module.exports = [
  {
    name: 'tour: sample data across screens, nothing written to IndexedDB or localStorage',
    async run() {
      const { page } = await L.open();
      await startTour(page);
      assert.ok(/nothing is saved/i.test(await page.locator('.tour-banner').innerText()));
      assert.ok(/days until your period|day of your period|past the expected date|may start today/.test(await page.locator('.phase-hero').innerText()));
      await page.getByRole('link', { name: 'Log', exact: true }).click();
      await page.getByRole('button', { name: 'nausea' }).click();
      await L.hashGo(page, '/app/settings');
      await page.getByRole('switch', { name: 'Daily check-in' }).check();
      await L.hashGo(page, '/app/insights');
      assert.ok((await page.locator('.bar').count()) >= 5, 'tour insights should show history');
      await L.hashGo(page, '/app/privacy');
      assert.equal(await page.getByRole('button', { name: 'Turn on' }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: /Restore from backup/ }).isDisabled(), true);
      await L.settle(page, 800);
      assert.equal(await L.readVault(page), null, 'tour wrote to IndexedDB');
      assert.deepEqual((await L.storageKeys(page)).local, []);
    },
  },
  {
    name: 'tour: Exit returns to the landing page and /app is gated again',
    async run() {
      const { page } = await L.open();
      await startTour(page);
      await page.getByRole('button', { name: 'Exit' }).click();
      await page.waitForURL(/#\/$/);
      await L.hashGo(page, '/app');
      await page.waitForURL(/#\/start$/);
    },
  },
  {
    name: 'tour: "Start with my own data" opens setup, and setup is saved normally',
    async run() {
      const { page } = await L.open();
      await startTour(page);
      await page.getByRole('button', { name: 'Start with my own data' }).click();
      await page.waitForURL(/#\/start$/);
      assert.equal(await page.locator('.tour-banner').count(), 0);
      await L.onboard(page, { lastStart: L.addDays(T, -4) });
      assert.equal(await page.locator('h1').first().textContent(), 'Your first prediction is ready.');
      assert.ok(await L.readVault(page));
    },
  },
  {
    name: 'tour → browser Back → Get started: real setup is not trapped in tour mode',
    async run() {
      const { page } = await L.open();
      await startTour(page);
      await page.goBack();
      await page.waitForURL(/#\/$/);
      await L.onboard(page, { lastStart: L.addDays(T, -10) });
      await page.getByRole('button', { name: /preview pass/ }).click();
      await page.waitForURL(/#\/app$/);
      assert.equal(await page.locator('.tour-banner').count(), 0, 'tour banner shown over real data');
      await page.getByRole('group', { name: 'Quick symptoms' }).getByRole('button').first().click();
      await L.settle(page);
      assert.ok((await L.readVault(page)).data.logs[T], 'log made after setup was not saved');
    },
  },
  {
    name: 'tour with an existing (unpaid) user restores their own data on exit',
    async run() {
      const { page } = await L.open();
      const d = L.emptyData(T, { logs: { [T]: { date: T, mood: 'low' } } });
      await L.seed(page, d, { entitled: false, route: '/plans' });
      await page.getByRole('button', { name: /tour/ }).count();
      await L.hashGo(page, '/');
      await page.getByRole('button', { name: 'Take the tour' }).click();
      await page.waitForURL(/#\/app$/);
      await page.getByRole('button', { name: 'Exit' }).click();
      await page.waitForURL(/#\/$/);
      assert.deepEqual((await L.readVault(page)).data.logs, { [T]: { date: T, mood: 'low' } });
      await L.hashGo(page, '/app');
      await page.waitForURL(/#\/plans$/);
    },
  },
];
