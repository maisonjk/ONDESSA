import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { commonAroundNow, headsUp } from './headsup';
import { findPatterns } from './patterns';
import { forecast } from './predict';
import { accuracyHeadline, lastCycleRecap, recapText } from './recap';
import { partnerMessage, predictedPeriodsIcs } from './share';
import { addLog, startsFromLengths, withPeriods } from './testkit';
import { emptyData } from './types';
import { upcomingReminders } from './reminders';

/** Six 28-day cycles with bloating logged 3 and 2 days before each period start. */
function bloatingHistory() {
  const starts = startsFromLengths('2026-03-02', [28, 28, 28, 28, 28, 28]);
  let data = withPeriods(starts);
  for (const s of starts.slice(1)) {
    data = addLog(data, { date: addDays(s, -3), symptoms: ['bloating'] });
    data = addLog(data, { date: addDays(s, -2), symptoms: ['bloating'] });
  }
  return { data, last: starts[starts.length - 1]! };
}

describe('pattern evidence', () => {
  it('records how many cycles showed a symptom and when it usually starts', () => {
    const { data, last } = bloatingHistory();
    const f = forecast(data, addDays(last, 10));
    const bloat = findPatterns(f, data.logs).find((i) => i.id === 'pre-bloating')!;
    expect(bloat.evidence).toEqual({ hits: 6, total: 6, label: '6 of your last 6 cycles' });
    expect(bloat.leadDays).toBe(3);
    expect(bloat.symptom).toBe('bloating');
  });
});

describe('heads up', () => {
  it('counts down to a usual pre-period symptom within a week', () => {
    const { data, last } = bloatingHistory();
    const today = addDays(last, 20); // period expected on day 29 → 8 days away, bloating 3 days before
    const f = forecast(data, today);
    const h = headsUp(f, findPatterns(f, data.logs), today);
    expect(h?.title).toBe('Bloating usually starts in about 5 days.');
    expect(h?.detail).toMatch(/^In 6 of your last 6 cycles it began about 3 days before your period\./);
  });

  it('says "around now" once inside the usual lead time, and stays quiet when too early or during a period', () => {
    const { data, last } = bloatingHistory();
    const now = addDays(last, 26);
    let f = forecast(data, now);
    expect(headsUp(f, findPatterns(f, data.logs), now)?.title).toBe('Bloating often shows up around now.');
    const early = addDays(last, 8);
    f = forecast(data, early);
    expect(headsUp(f, findPatterns(f, data.logs), early)).toBeUndefined();
    const during = addDays(last, 1);
    f = forecast(data, during);
    expect(headsUp(f, findPatterns(f, data.logs), during)).toBeUndefined();
  });

  it('uses plural grammar for plural symptoms', () => {
    const starts = startsFromLengths('2026-03-02', [28, 28, 28, 28]);
    let data = withPeriods(starts);
    for (const s of starts.slice(1)) data = addLog(data, { date: addDays(s, -2), symptoms: ['headache'] });
    const today = addDays(starts[starts.length - 1]!, 22);
    const f = forecast(data, today);
    expect(headsUp(f, findPatterns(f, data.logs), today)?.title).toBe('Headaches usually start in about 4 days.');
  });

  it('is never shown without a pattern', () => {
    const data = withPeriods(startsFromLengths('2026-03-02', [28, 28, 28, 28]));
    const today = '2026-06-20';
    const f = forecast(data, today);
    expect(headsUp(f, findPatterns(f, data.logs), today)).toBeUndefined();
  });
});

describe('cycle recap', () => {
  it('summarises the last complete cycle and scores the prediction made the day before', () => {
    const starts = startsFromLengths('2026-03-02', [28, 28, 28, 28, 29]);
    let data = withPeriods(starts);
    const last = starts[starts.length - 2]!;
    data = addLog(data, { date: addDays(last, 7), symptoms: ['fatigue'], mood: 'calm' });
    data = addLog(data, { date: addDays(last, 8), symptoms: ['fatigue', 'acne'], mood: 'calm' });
    const r = lastCycleRecap(data, addDays(starts[starts.length - 1]!, 3))!;
    expect(r.start).toBe(last);
    expect(r.length).toBe(29);
    expect(r.periodLength).toBe(5);
    expect(r.daysLogged).toBe(7);
    expect(r.topSymptoms[0]).toBe('fatigue');
    expect(r.topMood).toBe('calm');
    expect(r.predicted).toBe(addDays(last, 28));
    expect(r.offsetDays).toBe(1);
    expect(accuracyHeadline(r)).toBe('Called it within a day.');
  });

  it('leaves symptoms out of the shared text unless asked', () => {
    const starts = startsFromLengths('2026-03-02', [28, 28]);
    let data = withPeriods(starts);
    data = addLog(data, { date: addDays(starts[1]!, 4), symptoms: ['cramps'] });
    const r = lastCycleRecap(data, addDays(starts[2]!, 1))!;
    expect(recapText(r, false)).not.toMatch(/cramps/);
    expect(recapText(r, true)).toMatch(/Most logged: cramps/);
  });

  it('has nothing to recap before a cycle is complete', () => {
    const data = withPeriods(['2026-10-01']);
    expect(lastCycleRecap(data, '2026-10-20')).toBeUndefined();
    expect(lastCycleRecap(emptyData('2026-10-01'), '2026-10-20')).toBeUndefined();
  });
});

describe('partner sharing', () => {
  const data = withPeriods(startsFromLengths('2026-07-13', [28, 28, 28]));
  const today = '2026-10-17'; // cycle day 12 of the cycle that began Oct 5
  const f = forecast(data, today);

  it('includes only the items switched on', () => {
    const msg = partnerMessage(f, today, { countdown: true, phase: false, fertile: false }, true);
    expect(msg).toMatch(/Period expected in about 16 days \(most likely Nov 2\)\./);
    expect(msg).not.toMatch(/phase|fertile/i);
    expect(partnerMessage(f, today, { countdown: false, phase: false, fertile: false }, true)).toBe('');
  });

  it('never mentions the fertile window when fertility estimates are hidden', () => {
    const msg = partnerMessage(f, today, { countdown: false, phase: true, fertile: true }, false);
    expect(msg).not.toMatch(/fertile/i);
  });

  it('builds a calendar file with discreet titles by default', () => {
    const ics = predictedPeriodsIcs(f, today, true);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toMatch(/SUMMARY:Ondessa\r\n/);
    expect(ics).not.toMatch(/Period/);
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBeGreaterThanOrEqual(2);
    expect(predictedPeriodsIcs(f, today, false)).toMatch(/SUMMARY:Period expected \(estimate\)/);
  });
});

describe('common around now', () => {
  it('surfaces symptoms logged at the same cycle point in at least two earlier cycles', () => {
    const { data, last } = bloatingHistory();
    const today = addDays(last, 25);
    const f = forecast(data, today);
    expect(commonAroundNow(f, data.logs, today)).toEqual(['bloating']);
    expect(commonAroundNow(f, data.logs, addDays(last, 10))).toEqual([]);
  });
});

describe('period check-in reminder', () => {
  it('asks on the expected day with quick replies, and stops once late', () => {
    const data = withPeriods(startsFromLengths('2026-07-13', [28, 28, 28]));
    let today = '2026-10-17';
    let f = forecast(data, today);
    const check = upcomingReminders(data, f, today).find((r) => r.id === 'period-check');
    expect(check).toMatchObject({ date: f.nextPeriod!.expected, actions: 'period-check' });
    expect(check!.notification).not.toMatch(/period/i);
    data.settings.reminders.discreet = false;
    expect(upcomingReminders(data, f, today).find((r) => r.id === 'period-check')!.notification).toMatch(/period/);
    today = addDays(f.nextPeriod!.expected, 2);
    f = forecast(data, today);
    expect(upcomingReminders(data, f, today).some((r) => r.id === 'period-check')).toBe(false);
  });
});
