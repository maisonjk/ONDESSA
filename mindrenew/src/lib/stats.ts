import type { CategoryId } from '../content/lies';
import { CATEGORY_BY_ID } from '../content/lies';
import type { Renewal, SavedTruth } from './types';
import { addDays, isoDate, weekStart } from './dates';

export function uniqueDays(renewals: Renewal[]): string[] {
  return [...new Set(renewals.map((r) => r.date))].sort();
}

/**
 * Gentle streak: consecutive days with a renewal, ending today or yesterday
 * (so the streak isn't shown as "broken" before you've had a chance today).
 */
export function currentStreak(renewals: Renewal[], today = isoDate()): number {
  const days = new Set(uniqueDays(renewals));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function bestStreak(renewals: Renewal[]): number {
  const days = uniqueDays(renewals);
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function daysThisWeek(renewals: Renewal[], today = isoDate()): number {
  const start = weekStart(today);
  return uniqueDays(renewals).filter((d) => d >= start && d <= today).length;
}

/** Last N weeks x 7 days grid, oldest first, for the consistency heatmap. */
export function consistencyGrid(renewals: Renewal[], weeks = 12, today = isoDate()): { date: string; count: number; future: boolean }[][] {
  const counts = new Map<string, number>();
  for (const r of renewals) counts.set(r.date, (counts.get(r.date) ?? 0) + 1);
  const firstMonday = addDays(weekStart(today), -7 * (weeks - 1));
  const grid = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstMonday, w * 7 + d);
      col.push({ date, count: counts.get(date) ?? 0, future: date > today });
    }
    grid.push(col);
  }
  return grid;
}

export function topPatterns(renewals: Renewal[], limit = 3): { category: CategoryId; label: string; count: number }[] {
  const counts = new Map<CategoryId, number>();
  for (const r of renewals) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category, count]) => ({ category, label: CATEGORY_BY_ID[category]?.label ?? category, count }));
}

export interface WeeklySummary {
  days: number;
  renewals: number;
  saved: number;
  topCategory: string | null;
  message: string;
}

/** Positive framing only. Never shame a quiet week. */
export function weeklySummary(renewals: Renewal[], truths: SavedTruth[], today = isoDate()): WeeklySummary {
  const start = weekStart(today);
  const week = renewals.filter((r) => r.date >= start && r.date <= today);
  const saved = truths.filter((t) => t.savedAt.slice(0, 10) >= start).length;
  const days = new Set(week.map((r) => r.date)).size;
  const top = topPatterns(week, 1)[0];
  let message: string;
  if (days === 0) message = 'A new week is a fresh start. One renewal is all it takes to begin.';
  else if (days === 1) message = 'You showed up this week. That first step matters more than you think.';
  else if (days < 4) message = `You met with God’s truth on ${days} days this week. Keep building.`;
  else message = `${days} days of renewal this week. Truth is becoming a rhythm.`;
  if (top) message += ` Your focus has been ${top.label.toLowerCase()}.`;
  return { days, renewals: week.length, saved, topCategory: top?.label ?? null, message };
}

/** Pick a saved truth to resurface: favorites first, then oldest-seen, rotating daily. */
export function resurfaceTruth(truths: SavedTruth[], today = isoDate()): SavedTruth | null {
  const pool = truths.filter((t) => t.savedAt.slice(0, 10) < today);
  if (!pool.length) return null;
  const favs = pool.filter((t) => t.favorite);
  const list = favs.length ? favs : pool;
  const seed = today.split('-').reduce((a, n) => a + Number(n), 0);
  return list[seed % list.length];
}
