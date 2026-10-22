import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { findPatterns } from './patterns';
import { forecast } from './predict';
import { pregnancyStatus, dueDateFromLmp } from './pregnancy';
import { upcomingReminders } from './reminders';
import { addLog, startsFromLengths, withPeriods } from './testkit';
import { emptyData } from './types';

describe('My Cycle, My Patterns', () => {
  it('produces only a limited-data note when there is no history', () => {
    const data = emptyData('2026-10-01');
    const insights = findPatterns(forecast(data, '2026-10-22'), data.logs);
    expect(insights.map((i) => i.id)).toEqual(['limited-history']);
  });

  it('finds a pre-period symptom only when it is actually logged', () => {
    const starts = startsFromLengths('2026-01-01', [28, 28, 28, 28]);
    let data = withPeriods(starts);
    // headaches 2 days before 3 of the 4 period starts that close a cycle
    for (const s of starts.slice(1, 4)) data = addLog(data, { date: addDays(s, -2), symptoms: ['headache'] });
    const insights = findPatterns(forecast(data, '2026-05-01'), data.logs);
    const headache = insights.find((i) => i.id === 'pre-headache');
    expect(headache?.body).toBe(
      'You logged headaches in the 5 days before your period in 3 of your last 4 cycles.',
    );
    expect(headache?.limitation).toMatch(/not a cause/);
    expect(insights.some((i) => i.id === 'pre-cramps')).toBe(false);
  });

  it('does not report a symptom seen in under 60% of cycles', () => {
    const starts = startsFromLengths('2026-01-01', [28, 28, 28, 28, 28]);
    let data = withPeriods(starts);
    for (const s of starts.slice(1, 3)) data = addLog(data, { date: addDays(s, -1), symptoms: ['bloating'] });
    const insights = findPatterns(forecast(data, '2026-06-01'), data.logs);
    expect(insights.some((i) => i.id === 'pre-bloating')).toBe(false);
  });

  it('describes a lengthening trend with its basis', () => {
    const data = withPeriods(startsFromLengths('2025-06-01', [27, 28, 27, 28, 32, 33, 34]));
    const insights = findPatterns(forecast(data, '2026-01-20'), data.logs);
    const trend = insights.find((i) => i.id === 'length-trend');
    expect(trend?.body).toMatch(/Your last three cycles have been longer than your earlier cycles/);
    expect(trend?.basis).toMatch(/32, 33, 34/);
  });

  it('flags a long gap without a period gently', () => {
    const data = withPeriods(['2026-06-01']);
    const insights = findPatterns(forecast(data, '2026-09-15'), data.logs);
    expect(insights.find((i) => i.id === 'no-period-90')?.body).toMatch(/healthcare professional/);
  });
});

describe('pregnancy dating', () => {
  it('uses LMP + 280 days for a 28-day cycle', () => {
    expect(dueDateFromLmp('2026-01-01')).toBe('2026-10-08');
  });

  it('adjusts for cycle length inside the typical range only', () => {
    expect(dueDateFromLmp('2026-01-01', 32)).toBe('2026-10-12');
    expect(dueDateFromLmp('2026-01-01', 60)).toBe('2026-10-08');
  });

  it('lets a clinician-provided due date win over LMP', () => {
    const s = pregnancyStatus(
      { startedOn: '2026-02-20', lmp: '2026-01-01', clinicianDueDate: '2026-10-15' },
      '2026-04-09',
    );
    expect(s?.source).toBe('clinician');
    expect(s?.dueDate).toBe('2026-10-15');
    expect(s?.week).toBe(13);
    expect(s?.trimester).toBe(1);
  });

  it('computes weeks, days and trimesters at the boundaries', () => {
    const p = { startedOn: '2026-02-01', lmp: '2026-01-01' };
    expect(pregnancyStatus(p, '2026-01-01')?.week).toBe(0);
    expect(pregnancyStatus(p, '2026-04-09')).toMatchObject({ week: 14, day: 0, trimester: 2 });
    expect(pregnancyStatus(p, '2026-07-16')).toMatchObject({ week: 28, trimester: 3 });
    expect(pregnancyStatus(p, '2026-10-10')).toMatchObject({ pastDueDate: true, daysToGo: 0 });
    expect(pregnancyStatus(p, '2025-12-01')).toBeUndefined();
  });

  it('switching to pregnancy mode suspends cycle reminders', () => {
    const data = withPeriods(['2026-09-01']);
    data.settings.reminders.pregnancyTestDate = '2026-10-01';
    const today = '2026-09-20';
    expect(upcomingReminders(data, forecast(data, today), today).length).toBeGreaterThan(0);
    data.pregnancy = { startedOn: today, lmp: '2026-09-01' };
    expect(upcomingReminders(data, forecast(data, today), today)).toEqual([]);
  });
});

describe('reminders', () => {
  it('keep health words out of discreet notifications', () => {
    const data = withPeriods(['2026-10-01']);
    data.settings.reminders.fertileWindow = true;
    const r = upcomingReminders(data, forecast(data, '2026-10-05'), '2026-10-05');
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) expect(x.notification).not.toMatch(/period|fertil|ovulat|pregnan/i);
  });
});
