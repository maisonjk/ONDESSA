import { addDays, diffDays, type ISODate } from './dates';
import type { DayLog } from './types';
import { RULES } from './rules';

export interface Period {
  start: ISODate;
  end: ISODate;
  length: number;
}

export interface Cycle {
  start: ISODate;
  /** Exclusive: the next period's start. */
  nextStart: ISODate;
  length: number;
  periodLength: number;
  /** Cycles outside RULES.plausibleCycle are shown but never used for prediction. */
  usable: boolean;
}

/**
 * Groups bleeding days into periods. Spotting never starts a period, and a gap of up to
 * RULES.periodGapTolerance unlogged days inside a period is treated as one period.
 */
export function derivePeriods(logs: Record<ISODate, DayLog>): Period[] {
  const bleedDays = Object.values(logs)
    .filter((l) => l.flow && l.flow !== 'spotting')
    .map((l) => l.date)
    .sort();

  const periods: Period[] = [];
  for (const day of bleedDays) {
    const last = periods[periods.length - 1];
    if (last && diffDays(last.end, day) <= RULES.periodGapTolerance + 1) {
      last.end = day;
      last.length = diffDays(last.start, day) + 1;
    } else {
      periods.push({ start: day, end: day, length: 1 });
    }
  }
  return periods;
}

export function deriveCycles(periods: Period[]): Cycle[] {
  const cycles: Cycle[] = [];
  for (let i = 0; i < periods.length - 1; i++) {
    const p = periods[i]!;
    const next = periods[i + 1]!;
    const length = diffDays(p.start, next.start);
    cycles.push({
      start: p.start,
      nextStart: next.start,
      length,
      periodLength: p.length,
      usable: length >= RULES.plausibleCycle.min && length <= RULES.plausibleCycle.max,
    });
  }
  return cycles;
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Cycle day (1-based) for a date given the period start it belongs to. */
export function cycleDay(periodStart: ISODate, date: ISODate): number {
  return diffDays(periodStart, date) + 1;
}

export function lastDayOfPeriod(p: Period): ISODate {
  return addDays(p.start, p.length - 1);
}
