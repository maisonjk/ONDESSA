'use strict';
const assert = require('node:assert/strict');
const L = require('../lib.cjs');

const T = L.today();
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Navigate the calendar to `date`'s month and return that day's class list. */
async function dayClass(page, date) {
  const target = `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
  for (let i = 0; i < 24; i++) {
    const cur = (await page.locator('main h2').first().textContent()).trim();
    if (cur === target) break;
    const [cm, cy] = cur.split(' ');
    const forward = Number(cy) * 12 + MONTHS.indexOf(cm) < Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
    await page.getByRole('button', { name: forward ? 'Next month' : 'Previous month' }).click();
  }
  const cls = await page.locator(`.cal .day[aria-label^="${L.formatLong(date)}"]`).first().getAttribute('class');
  return cls.split(/\s+/).filter(Boolean);
}
const kind = (cls) => ['period', 'spotting', 'predicted-period', 'possible-period', 'fertile', 'ovulation'].find((k) => cls.includes(k)) || 'none';

function heroLines(text) {
  return text.split('\n').map((s) => s.trim()).filter(Boolean);
}

module.exports = [
  {
    name: 'limited data: Today countdown and calendar classes match the engine rules (±3, fertile −5..+1)',
    async run() {
      const { page } = await L.open();
      const last = L.addDays(T, -10);
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, last, 5), settings: { showFertility: true } }));
      const expected = L.addDays(last, 28);
      const hero = heroLines(await page.locator('.phase-hero').innerText());
      assert.ok(hero.includes('18') && hero.includes('days until your period'), hero.join(' | '));
      assert.ok(/limited data/i.test(hero.join(' ')));
      await L.hashGo(page, '/app/calendar');
      const ov = L.addDays(expected, -14);
      const checks = [
        [last, 'period'], [L.addDays(last, 4), 'period'],
        [L.addDays(expected, -3), 'possible-period'], [L.addDays(expected, -1), 'possible-period'],
        [expected, 'predicted-period'], [L.addDays(expected, 4), 'predicted-period'],
        [L.addDays(expected, 5), 'possible-period'], [L.addDays(expected, 3 + 4), 'possible-period'], [L.addDays(expected, 3 + 5), 'none'],
        [ov, 'ovulation'], [L.addDays(ov, -5), 'fertile'], [L.addDays(ov, 1), 'fertile'], [L.addDays(ov, -6), 'none'],
      ];
      for (const [d, k] of checks) {
        const got = kind(await dayClass(page, d));
        // Days before today never show predictions.
        const want = d < T && !['period', 'spotting'].includes(k) ? (k === 'fertile' || k === 'ovulation' ? got : 'none') : k;
        assert.equal(got, want, `${d}: expected ${want}, got ${got}`);
      }
    },
  },
  {
    name: 'established pattern (6 regular cycles) narrows the window to ±1 day',
    async run() {
      const { page } = await L.open();
      const last = L.addDays(T, -5);
      await L.seed(page, L.emptyData(T, { logs: L.cycleHistory(last, [28, 29, 28, 27, 28, 28]) }));
      const text = await page.locator('.phase-hero').innerText();
      assert.ok(/Established personal pattern/i.test(text), text);
      const exp = L.addDays(last, 28);
      assert.ok(text.includes(`Expected ${L.formatShort(L.addDays(exp, -1))}`), text);
    },
  },
  {
    name: 'irregular cycles: wider window badge and explanation',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.cycleHistory(L.addDays(T, -5), [24, 36, 27, 40, 29, 33]) }));
      const text = await page.locator('.phase-hero').innerText();
      assert.ok(/wider window/i.test(text), text);
      assert.ok(!/Established/i.test(text), 'irregular user labelled established');
      await page.getByText('How is this calculated?').click();
      assert.ok((await page.locator('.phase-hero details').innerText()).includes('vary by 16 days'));
    },
  },
  {
    name: 'implausible cycles (<15, >90 days) are excluded and explained; Insights greys them',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.cycleHistory(L.addDays(T, -5), [30, 12, 95, 31, 29]) }));
      await page.getByText('How is this calculated?').click();
      const ex = await page.locator('.phase-hero details').innerText();
      assert.ok(ex.includes('2 logged cycles were shorter than 15 or longer than 90 days'), ex);
      assert.ok(ex.includes('(30, 31, 29 days)'), ex);
      await L.hashGo(page, '/app/insights');
      assert.equal(await page.locator('.bar .b.excluded').count(), 2);
    },
  },
  {
    name: 'spotting never starts a period',
    async run() {
      const { page } = await L.open();
      const logs = L.addPeriod({}, L.addDays(T, -20), 5);
      logs[L.addDays(T, -2)] = { date: L.addDays(T, -2), flow: 'spotting' };
      await L.seed(page, L.emptyData(T, { logs }));
      const ring = await page.locator('svg.ring').getAttribute('aria-label');
      assert.ok(ring.startsWith('Cycle day 21'), ring);
    },
  },
  {
    name: 'late period: "N days past the expected date", conceive copy mentions a test',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -31), 5), settings: { goal: 'conceive' } }));
      const hero = await page.locator('.phase-hero').innerText();
      assert.ok(/\b3\b/.test(hero) && hero.includes('days past the expected date'), hero);
      assert.ok(hero.includes('a home test is most reliable from now'));
      assert.ok(!/\b(missed|late)\b/i.test(hero), 'copy should avoid "missed"/"late"');
    },
  },
  {
    name: 'fertile window rolls over to the next cycle once passed (Home, Fertility, Calendar agree)',
    async run() {
      const { page } = await L.open();
      const last = L.addDays(T, -20);
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, last, 5), settings: { goal: 'conceive', showFertility: true } }));
      const nextOv = L.addDays(last, 28 + 14);
      const range = `${L.formatShort(L.addDays(nextOv, -5))}`;
      const card = await page.locator('a[href="#/app/fertility"]').innerText();
      assert.ok(/next fertile window/i.test(card), card);
      assert.ok(card.includes(range), `${card} should start ${range}`);
      await L.hashGo(page, '/app/fertility');
      assert.ok((await page.locator('main h1').first().textContent()).includes(range));
      await L.hashGo(page, '/app/calendar');
      assert.equal(kind(await dayClass(page, nextOv)), 'ovulation');
      assert.equal(kind(await dayClass(page, L.addDays(nextOv, -5))), 'fertile');
    },
  },
  {
    name: 'no fertile window shown in the past when the period is very overdue',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -48), 5), settings: { goal: 'conceive', showFertility: true } }));
      const card = page.locator('a[href="#/app/fertility"]');
      if (await card.count()) {
        const t = await card.innerText();
        assert.ok(!t.includes(L.formatShort(L.addDays(T, -6))), `past window advertised as next: ${t}`);
      }
    },
  },
  {
    name: 'LH positive refines ovulation (Fertility screen)',
    async run() {
      const { page } = await L.open();
      const last = L.addDays(T, -13);
      const logs = L.addPeriod({}, last, 5);
      logs[L.addDays(T, -1)] = { date: L.addDays(T, -1), lh: 'positive' };
      await L.seed(page, L.emptyData(T, { logs, settings: { goal: 'conceive', showFertility: true, fertilitySigns: true } }), { route: '/app/fertility' });
      const main = await page.locator('main').innerText();
      assert.ok(main.includes(`Ovulation estimated around ${L.formatShort(T)}`), main.slice(0, 300));
      assert.ok(main.includes('Refined by your positive LH test'));
      assert.ok(main.includes(`LH positives: ${L.formatShort(L.addDays(T, -1))}`));
    },
  },
  {
    name: 'fertility hidden when the user turned estimates off',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -10), 5), settings: { showFertility: false } }));
      assert.equal(await page.locator('a[href="#/app/fertility"]').count(), 0);
      await L.hashGo(page, '/app/calendar');
      assert.equal(await page.locator('.cal .day.fertile, .cal .day.ovulation').count(), 0);
      await L.hashGo(page, '/app/fertility');
      assert.equal(await page.locator('main h1').first().textContent(), 'Fertility estimates are off');
    },
  },
  {
    name: 'pregnancy mode: start from More, week-by-week, appointments add/remove, end archives',
    async run() {
      const { page, mon } = await L.open();
      await L.seed(page, L.emptyData(T, { logs: L.addPeriod({}, L.addDays(T, -60), 5) }), { route: '/app/more' });
      await page.getByRole('link', { name: /Pregnancy/ }).first().click();
      await page.fill('#plmp', L.addDays(T, -60));
      assert.ok((await page.locator('main').innerText()).includes(`Estimated due date: ${L.formatLong(L.addDays(T, 220))}`));
      await page.getByRole('button', { name: 'Start pregnancy mode' }).click();
      assert.equal(await page.locator('main h1').first().textContent(), 'Week 8 + 4');
      assert.ok((await page.locator('main').innerText()).includes('TRIMESTER 1') || (await page.locator('main').innerText()).includes('Trimester 1'));
      await page.getByLabel('Appointment title').fill('Dating scan');
      await page.getByLabel('Appointment date').fill(L.addDays(T, 14));
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByLabel('Appointment title').fill('Midwife');
      await page.getByLabel('Appointment date').fill(L.addDays(T, 3));
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      const titles = await page.locator('main .list-btn strong').allTextContents();
      assert.deepEqual(titles, ['Midwife', 'Dating scan'], 'appointments sorted by date');
      await page.getByRole('button', { name: 'Remove Midwife' }).click();
      await L.settle(page);
      let v = (await L.readVault(page)).data;
      assert.deepEqual(v.appointments.map((a) => a.title), ['Dating scan']);
      assert.equal(v.pregnancy.lmp, L.addDays(T, -60));
      await L.hashGo(page, '/app/settings');
      assert.ok((await page.locator('main').innerText()).includes('Dating scan'), 'appointment reminder listed in next 30 days');
      assert.ok(!(await page.locator('main').innerText()).includes('Your period may start'), 'period reminder while pregnant');
      await L.hashGo(page, '/app/pregnancy');
      await page.getByRole('button', { name: 'End pregnancy mode' }).click();
      await L.settle(page);
      v = (await L.readVault(page)).data;
      assert.equal(v.pregnancy, undefined);
      assert.equal(v.pastPregnancies.length, 1);
      assert.ok(mon.dialogs.some((m) => m.startsWith('End pregnancy mode?')));
      await L.hashGo(page, '/app');
      assert.equal(await page.locator('.phase-hero').count(), 1, 'cycle tracking resumes');
    },
  },
  {
    name: 'pregnancy: due date beyond the clinician-date maximum is not accepted from More > Pregnancy',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, {}), { route: '/app/pregnancy' });
      assert.equal(await page.locator('#pdue').getAttribute('max'), L.addDays(T, 280));
    },
  },
  {
    name: 'pregnancy mode pauses cycle predictions on the calendar',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { goal: 'pregnant', lmp: L.addDays(T, -20) });
      await page.getByRole('button', { name: /preview pass/ }).click();
      await page.waitForURL(/#\/app$/);
      await L.hashGo(page, '/app/calendar');
      let n = await page.locator('.cal .day.predicted-period, .cal .day.possible-period').count();
      await page.getByRole('button', { name: 'Next month' }).click();
      n += await page.locator('.cal .day.predicted-period, .cal .day.possible-period').count();
      assert.equal(n, 0, `${n} predicted/possible period days shown during pregnancy`);
    },
  },
  {
    name: 'changing life stage away from Pregnant ends pregnancy mode consistently',
    async run() {
      const { page } = await L.open();
      await L.onboard(page, { goal: 'pregnant', dueDate: L.addDays(T, 100) });
      await page.getByRole('button', { name: /preview pass/ }).click();
      await page.waitForURL(/#\/app$/);
      await L.hashGo(page, '/app/settings');
      await page.getByLabel('Life stage').selectOption('understand');
      await L.settle(page);
      const v = (await L.readVault(page)).data;
      const consistent = (v.settings.goal === 'pregnant') === !!v.pregnancy;
      assert.ok(consistent, `goal=${v.settings.goal} but pregnancy=${JSON.stringify(v.pregnancy)} (Home still shows pregnancy)`);
    },
  },
  {
    name: 'zero data: every app screen renders without errors',
    async run() {
      const { page } = await L.open();
      await L.seed(page, L.emptyData(T, {}));
      const expect = {
        '/app': 'Log your period to begin', '/app/calendar': 'October', '/app/fertility': 'No estimate yet',
        '/app/insights': 'What your logs show', '/app/pregnancy': 'Switch to pregnancy mode', '/app/settings': 'Reminders & settings',
        '/app/privacy': 'Your data, your rules', '/app/log': L.formatLong(T),
      };
      expect['/app/calendar'] = MONTHS[Number(T.slice(5, 7)) - 1];
      for (const [r, txt] of Object.entries(expect)) {
        await L.hashGo(page, r);
        assert.ok((await page.locator('main').innerText()).includes(txt), `${r} missing "${txt}"`);
      }
    },
  },
];
