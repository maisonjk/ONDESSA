'use strict';
/**
 * Shared helpers for the Ondessa end-to-end suite.
 * Plain Node + globally installed Playwright (no @playwright/test).
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const GLOBAL_ROOT = execSync('npm root -g').toString().trim();
const pw = require(path.join(GLOBAL_ROOT, 'playwright'));

const BASE = process.env.ONDESSA_URL || 'http://localhost:4500';

/* ------------------------------------------------------------------ dates */

function iso(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return iso(new Date(Date.UTC(y, m - 1, d + n)));
}
function diffDays(a, b) {
  const t = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}
/** Local calendar date "today" for a given IANA zone at a given instant. */
function todayIn(timeZone, at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map((m) => m.slice(0, 3));
function formatLong(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
function formatShort(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${MON[m - 1]} ${d}`;
}

/* ------------------------------------------------------------------ data builders */

function emptyData(today, overrides = {}) {
  const base = {
    schemaVersion: 1,
    createdOn: today,
    settings: {
      goal: 'understand',
      cycle: { typicalCycleLength: 28, typicalPeriodLength: 5 },
      showFertility: true,
      fertilitySigns: false,
      intercourseLogging: false,
      temperatureUnit: 'C',
      weekStartsOn: 1,
      reminders: { periodHeadsUp: true, periodHeadsUpDays: 2, fertileWindow: false, dailyLog: false, discreet: true },
    },
    logs: {},
    pastPregnancies: [],
    appointments: [],
  };
  const out = { ...base, ...overrides, settings: { ...base.settings, ...(overrides.settings || {}) } };
  return out;
}

/** Add a period of `len` days starting at `start` to `logs`. */
function addPeriod(logs, start, len = 5, flow = 'medium') {
  for (let i = 0; i < len; i++) {
    const d = addDays(start, i);
    logs[d] = { ...(logs[d] || {}), date: d, flow };
  }
  return logs;
}

/** Periods whose starts are separated by `lengths`, the last one starting at `lastStart`. */
function cycleHistory(lastStart, lengths, periodLen = 5) {
  const logs = {};
  let s = lastStart;
  const starts = [s];
  for (let i = lengths.length - 1; i >= 0; i--) { s = addDays(s, -lengths[i]); starts.unshift(s); }
  for (const st of starts) addPeriod(logs, st, periodLen);
  return logs;
}

/* ------------------------------------------------------------------ browser */

let browser;
async function getBrowser() {
  if (!browser) browser = await pw.chromium.launch();
  return browser;
}
async function closeBrowser() {
  if (browser) await browser.close();
  browser = undefined;
}

/**
 * New isolated context + page with monitors for console errors, page errors and
 * any request that leaves localhost. Dialogs are auto-accepted unless overridden.
 */
async function open(opts = {}) {
  const b = await getBrowser();
  const ctx = await b.newContext({
    viewport: opts.viewport || { width: 390, height: 844 },
    timezoneId: opts.timezoneId,
    colorScheme: opts.colorScheme,
    acceptDownloads: true,
    serviceWorkers: opts.serviceWorkers || 'block',
    bypassCSP: !!opts.bypassCSP,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const mon = { consoleErrors: [], pageErrors: [], external: [], dialogs: [] };
  page.on('console', (m) => { if (m.type() === 'error') mon.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => mon.pageErrors.push(String(e)));
  ctx.on('request', (r) => {
    const u = r.url();
    if (!/^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/|data:|blob:|about:)/.test(u)) mon.external.push(u);
  });
  page.dialogAnswer = opts.dialogAnswer ?? true;
  page.on('dialog', async (d) => {
    mon.dialogs.push(d.message());
    if (page.dialogAnswer) await d.accept(); else await d.dismiss();
  });
  if (opts.clock) {
    await page.clock.install({ time: opts.clock });
  }
  page.mon = mon;
  return { ctx, page, mon };
}

async function goto(page, route = '/') {
  await page.goto(`${BASE}/#${route}`);
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && document.querySelector('#root')?.childElementCount > 0);
}

/** Navigate inside the already loaded app (hash change only, no reload). */
async function hashGo(page, route) {
  await page.evaluate((r) => { window.location.hash = r; }, route);
  await page.waitForTimeout(50);
}

/** Write AppData (plain) and optionally a preview entitlement, then reload into `route`. */
async function seed(page, data, { entitled = true, route = '/app' } = {}) {
  if (!page.url().startsWith(BASE)) await page.goto(`${BASE}/#/legal`);
  await page.evaluate(async ({ data, entitled }) => {
    await new Promise((res, rej) => {
      const req = indexedDB.open('ondessa', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('vault');
      req.onsuccess = () => {
        const db = req.result;
        const t = db.transaction('vault', 'readwrite');
        t.objectStore('vault').put({ mode: 'plain', data }, 'data');
        t.oncomplete = () => { db.close(); res(); };
        t.onerror = () => rej(t.error);
      };
      req.onerror = () => rej(req.error);
    });
    if (entitled) localStorage.setItem('ondessa.entitlement', `preview:${Math.floor(Date.now() / 1000) + 14 * 86400}`);
  }, { data, entitled });
  await page.goto(`${BASE}/#${route}`);
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && document.querySelector('#root')?.childElementCount > 0);
}

/** Read the raw IndexedDB record (or null) without creating the database. */
async function readVault(page) {
  return page.evaluate(async () => {
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    if (!dbs.some((d) => d.name === 'ondessa')) return null;
    return new Promise((res) => {
      const req = indexedDB.open('ondessa', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('vault');
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('vault')) { db.close(); return res(null); }
        const g = db.transaction('vault').objectStore('vault').get('data');
        g.onsuccess = () => { db.close(); res(g.result ?? null); };
        g.onerror = () => { db.close(); res(null); };
      };
      req.onerror = () => res(null);
    });
  });
}
async function idbNames(page) {
  return page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : []));
}
async function storageKeys(page) {
  return page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
}
/** Wait for the 250 ms debounced autosave. */
async function settle(page, ms = 450) {
  await page.waitForTimeout(ms);
}

/* ------------------------------------------------------------------ onboarding */

/**
 * Walk the first-run flow. opts: goal, lastStart, unsure, cycleLen, periodLen, dueDate,
 * lmp, pin, fertile (true/false/undefined), discreet.
 */
async function onboard(page, opts = {}) {
  await goto(page, '/start');
  await page.getByRole('button', { name: 'I understand, continue' }).click();
  const goalTitles = {
    understand: 'Understand my cycle', conceive: 'Plan a pregnancy', pregnant: 'I’m pregnant', perimenopause: 'My cycles are changing',
  };
  await page.getByRole('button', { name: goalTitles[opts.goal || 'understand'] }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  if (opts.goal === 'pregnant') {
    if (opts.dueDate) await page.fill('#due', opts.dueDate);
    if (opts.lmp) await page.fill('#lmp', opts.lmp);
  } else {
    if (opts.unsure) await page.getByLabel('I’m not sure. I’ll log my next period.').check();
    else if (opts.lastStart) await page.fill('#last', opts.lastStart);
    if (opts.cycleLen) await setStepper(page, 'Usual cycle length', 28, opts.cycleLen);
    if (opts.periodLen) await setStepper(page, 'Usual period length', 5, opts.periodLen);
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  if (opts.pin) {
    await page.getByRole('switch', { name: 'Lock and encrypt with a passcode' }).check();
    await page.getByLabel('New passcode').fill(opts.pin);
    await page.getByLabel('Repeat passcode').fill(opts.pin2 ?? opts.pin);
  }
  if (opts.fertile !== undefined && opts.goal !== 'pregnant') {
    const sw = page.getByRole('switch', { name: 'Show estimated fertile days' });
    if ((await sw.isChecked()) !== opts.fertile) await sw.click();
  }
  if (opts.discreet === false) await page.getByRole('switch', { name: 'Discreet notifications' }).click();
  if (opts.stopBeforeFinish) return;
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await page.waitForURL(/#\/(plans|app)/);
}

async function setStepper(page, label, from, to) {
  const name = to > from ? `Increase ${label}` : `Decrease ${label}`;
  const btn = page.getByRole('button', { name, exact: true });
  for (let i = 0; i < Math.abs(to - from); i++) await btn.click();
}

/* ------------------------------------------------------------------ checks */

async function noHorizontalScroll(page) {
  return page.evaluate(() => {
    const se = document.scrollingElement;
    return { scrollWidth: se.scrollWidth, innerWidth: window.innerWidth, ok: se.scrollWidth <= window.innerWidth };
  });
}

const AXE_SRC = (() => {
  const p = process.env.AXE_PATH || '/tmp/qa/node_modules/axe-core/axe.min.js';
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : undefined;
})();

async function axe(page, tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']) {
  if (!AXE_SRC) throw new Error('axe-core not found; run `npm i axe-core` in /tmp/qa or set AXE_PATH');
  const has = await page.evaluate(() => !!window.axe);
  if (!has) await page.evaluate(AXE_SRC);
  return page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8), count: v.nodes.length }));
  }, tags);
}

/** Interactive elements smaller than 44×44 CSS px (visible ones only). */
async function smallTargets(page, min = 44) {
  return page.evaluate((min) => {
    const els = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=switch]')];
    const out = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      // inline text links inside prose are exempt (WCAG 2.5.8 inline exception)
      if (el.tagName === 'A' && cs.display === 'inline') continue;
      let w = r.width, h = r.height;
      // checkbox/switch inputs are often visually wrapped; measure the wrapper label/span
      if (el.matches('input[type=checkbox]')) {
        const wrap = el.closest('label, .switch');
        if (wrap) { const rr = wrap.getBoundingClientRect(); w = Math.max(w, rr.width); h = Math.max(h, rr.height); }
      }
      if (w < min - 0.5 || h < min - 0.5) {
        out.push({ tag: el.tagName.toLowerCase(), text: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 40), w: Math.round(w), h: Math.round(h) });
      }
    }
    return out;
  }, min);
}

module.exports = {
  pw, BASE, iso, addDays, diffDays, todayIn, formatLong, formatShort, emptyData, addPeriod, cycleHistory,
  getBrowser, closeBrowser, open, goto, hashGo, seed, readVault, idbNames, storageKeys, settle, onboard, setStepper,
  noHorizontalScroll, axe, smallTargets,
};
