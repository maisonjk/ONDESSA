import { describe, expect, it } from 'vitest';
import { bestMatch, detectCrisis, matchThought } from './matcher';
import { bestStreak, consistencyGrid, currentStreak, daysThisWeek, resurfaceTruth, topPatterns, weeklySummary } from './stats';
import { canSaveTruth, canStartRenewal } from './entitlements';
import { addDays, weekKey, weekStart } from './dates';
import { initialState } from './store';
import { msUntilNext } from './reminders';
import type { Renewal, SavedTruth } from './types';

const r = (date: string, category: Renewal['category'] = 'fear', verseId = 'isa-41-10'): Renewal => ({
  id: `${date}-${Math.random()}`, date, createdAt: `${date}T08:00:00.000Z`, category, lieId: null, lieText: 'x', verseId, reflection: '', action: '',
});

describe('matcher', () => {
  it('maps natural thoughts to the right pattern', () => {
    expect(bestMatch('I am just not good enough for this')?.id).toBe('id-not-enough');
    expect(bestMatch('I keep comparing myself to everyone on instagram')?.id).toBe('comp-behind');
    expect(bestMatch('Honestly it feels like God has forgotten me')?.id).toBe('lone-forgotten');
    expect(bestMatch('I can’t stop worrying about everything')?.categories).toContain('anxiety');
  });
  it('falls back to the chosen category when nothing matches', () => {
    expect(bestMatch('zzz qqq', 'control')?.categories[0]).toBe('control');
  });
  it('returns nothing for empty input', () => {
    expect(matchThought('')).toEqual([]);
  });
});

describe('crisis detection', () => {
  it('catches self-harm language', () => {
    for (const t of ['I want to die', 'thinking about suicide', 'everyone would be better off without me', 'I want to hurt myself', 'I don’t want to be alive']) {
      expect(detectCrisis(t), t).toBe(true);
    }
  });
  it('does not fire on ordinary struggle', () => {
    for (const t of ['I am anxious about work', 'I feel alone', 'my plans died with that job']) expect(detectCrisis(t), t).toBe(false);
  });
});

describe('stats', () => {
  const today = '2026-11-25'; // Wednesday
  it('counts a gentle streak that survives until the day is over', () => {
    const rs = [r('2026-11-22'), r('2026-11-23'), r('2026-11-24')];
    expect(currentStreak(rs, today)).toBe(3);
    expect(currentStreak([...rs, r(today)], today)).toBe(4);
    expect(currentStreak([r('2026-11-20')], today)).toBe(0);
  });
  it('computes best streak and weekly days', () => {
    const rs = [r('2026-11-01'), r('2026-11-02'), r('2026-11-03'), r('2026-11-10'), r('2026-11-24'), r('2026-11-25')];
    expect(bestStreak(rs)).toBe(3);
    expect(daysThisWeek(rs, today)).toBe(2);
    expect(weekStart(today)).toBe('2026-11-23');
  });
  it('builds a 12x7 grid with future days marked', () => {
    const g = consistencyGrid([r(today)], 12, today);
    expect(g).toHaveLength(12);
    expect(g.every((c) => c.length === 7)).toBe(true);
    expect(g[11].find((d) => d.date === today)?.count).toBe(1);
    expect(g[11][6].future).toBe(true);
  });
  it('summarizes the week positively, even an empty one', () => {
    expect(weeklySummary([], [], today).message).toMatch(/fresh start/);
    const s = weeklySummary([r('2026-11-23', 'anxiety'), r('2026-11-24', 'anxiety'), r(today, 'fear')], [], today);
    expect(s.days).toBe(3);
    expect(s.topCategory).toBe('Anxiety');
    expect(topPatterns([r(today, 'shame'), r(today, 'shame'), r(today, 'fear')])[0].category).toBe('shame');
  });
  it('resurfaces favorites first and never something saved today', () => {
    const t = (id: string, day: string, favorite = false): SavedTruth => ({ id, category: 'fear', lieText: '', truth: id, verseId: 'isa-41-10', reflection: '', savedAt: `${day}T10:00:00Z`, favorite, source: 'renewal' });
    expect(resurfaceTruth([t('a', today)], today)).toBeNull();
    expect(resurfaceTruth([t('a', '2026-11-01'), t('b', '2026-11-02', true)], today)?.id).toBe('b');
  });
});

describe('entitlements', () => {
  it('free users get one renewal per day and a 15-truth library', () => {
    const s = initialState();
    const today = '2026-11-25';
    expect(canStartRenewal(s, today)).toBe(true);
    s.renewals = [r(today)];
    expect(canStartRenewal(s, today)).toBe(false);
    expect(canStartRenewal({ ...s, plan: 'premium' }, today)).toBe(true);
    s.truths = Array.from({ length: 15 }, (_, i) => ({ id: String(i) }) as SavedTruth);
    expect(canSaveTruth(s)).toBe(false);
    expect(canSaveTruth({ ...s, plan: 'premium' })).toBe(true);
  });
});

describe('dates and reminders', () => {
  it('handles week keys and day math', () => {
    expect(weekKey(new Date(2026, 0, 1))).toBe('2026-W01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('schedules the next reminder and skips weekends for weekday mode', () => {
    const fri = new Date(2026, 10, 27, 9, 0); // Friday 09:00, after a 07:30 reminder
    const prefs = { enabled: true, time: '07:30', frequency: 'weekdays' as const, truthResurfacing: true, weeklySummary: true };
    const ms = msUntilNext(prefs, fri)!;
    expect(new Date(fri.getTime() + ms).getDay()).toBe(1); // Monday
    expect(msUntilNext({ ...prefs, enabled: false }, fri)).toBeNull();
  });
});
