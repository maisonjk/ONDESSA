import { describe, expect, it } from 'vitest';
import {
  addDays, diffDays, formatRange, isISODate, localToday, monthGrid, toDayNumber, fromDayNumber,
} from './dates';

describe('calendar dates', () => {
  it('validates real calendar dates only', () => {
    expect(isISODate('2024-02-29')).toBe(true);
    expect(isISODate('2025-02-29')).toBe(false);
    expect(isISODate('2100-02-29')).toBe(false); // century, not leap
    expect(isISODate('2000-02-29')).toBe(true); // 400-year leap
    expect(isISODate('2025-13-01')).toBe(false);
    expect(isISODate('2025-1-01')).toBe(false);
    expect(isISODate('2025-04-31')).toBe(false);
    expect(isISODate(20250101)).toBe(false);
    expect(isISODate('2025-01-01T00:00:00Z')).toBe(false);
  });

  it('crosses leap days and year ends', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2025-01-01', -1)).toBe('2024-12-31');
    expect(diffDays('2024-02-01', '2024-03-01')).toBe(29);
    expect(diffDays('2025-02-01', '2025-03-01')).toBe(28);
  });

  it('is unaffected by daylight-saving transitions in any time zone', () => {
    // US spring forward / fall back, EU, and southern hemisphere transitions.
    for (const [a, b] of [
      ['2026-03-07', '2026-03-09'],
      ['2026-10-31', '2026-11-02'],
      ['2026-03-28', '2026-03-30'],
      ['2026-04-04', '2026-04-06'],
      ['2026-09-26', '2026-09-28'],
    ] as const) {
      expect(diffDays(a, b)).toBe(2);
      expect(addDays(a, 2)).toBe(b);
    }
  });

  it('round-trips day numbers across a long range', () => {
    let d = '1999-12-25';
    for (let i = 0; i < 12000; i += 37) {
      const next = addDays(d, 37);
      expect(fromDayNumber(toDayNumber(next))).toBe(next);
      expect(diffDays(d, next)).toBe(37);
      d = next;
    }
  });

  it('reads the local calendar date, not the UTC date', () => {
    const lateEvening = new Date(2026, 9, 21, 23, 30); // local time
    expect(localToday(lateEvening)).toBe('2026-10-21');
    const justAfterMidnight = new Date(2026, 9, 22, 0, 5);
    expect(localToday(justAfterMidnight)).toBe('2026-10-22');
  });

  it('builds full-week month grids', () => {
    const grid = monthGrid(2026, 2, 1);
    expect(grid.length % 7).toBe(0);
    expect(grid).toContain('2026-02-01');
    expect(grid).toContain('2026-02-28');
    expect(monthGrid(2024, 2, 0)).toContain('2024-02-29');
  });

  it('formats ranges compactly', () => {
    expect(formatRange('2026-11-03', '2026-11-07')).toBe('Nov 3–7');
    expect(formatRange('2026-10-30', '2026-11-02')).toBe('Oct 30 – Nov 2');
  });
});
