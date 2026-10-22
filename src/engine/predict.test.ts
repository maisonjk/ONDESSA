import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { derivePeriods } from './cycles';
import { classifyDay, confidenceFor, detectThermalShift, forecast } from './predict';
import { addLog, startsFromLengths, withPeriods } from './testkit';
import { emptyData } from './types';

describe('period detection', () => {
  it('ignores spotting and joins a one-day logging gap', () => {
    const data = emptyData('2026-01-01');
    data.logs['2026-01-01'] = { date: '2026-01-01', flow: 'spotting' };
    data.logs['2026-01-02'] = { date: '2026-01-02', flow: 'medium' };
    data.logs['2026-01-04'] = { date: '2026-01-04', flow: 'light' };
    data.logs['2026-01-10'] = { date: '2026-01-10', flow: 'light' };
    const periods = derivePeriods(data.logs);
    expect(periods.map((p) => [p.start, p.end])).toEqual([
      ['2026-01-02', '2026-01-04'],
      ['2026-01-10', '2026-01-10'],
    ]);
  });
});

describe('forecast', () => {
  it('has no prediction and says so when nothing is logged', () => {
    const f = forecast(emptyData('2026-10-01'), '2026-10-22');
    expect(f.nextPeriod).toBeUndefined();
    expect(f.confidence).toBe('limited');
    expect(f.explanation.join(' ')).toMatch(/Log the first day/);
  });

  it('uses the entered cycle length when only one period is logged', () => {
    const data = withPeriods(['2026-10-01']);
    data.settings.cycle.typicalCycleLength = 30;
    const f = forecast(data, '2026-10-10');
    expect(f.lengthSource).toBe('settings');
    expect(f.nextPeriod?.expected).toBe('2026-10-31');
    expect(f.confidence).toBe('limited');
    expect(f.cycleDay).toBe(10);
  });

  it('blends history with settings below three cycles', () => {
    const data = withPeriods(startsFromLengths('2026-07-01', [32, 32]));
    data.settings.cycle.typicalCycleLength = 28;
    const f = forecast(data, '2026-09-10');
    expect(f.lengthSource).toBe('blended');
    expect(f.predictedCycleLength).toBe(31); // (32+32+28)/3 = 30.67
    expect(f.confidence).toBe('limited');
  });

  it('reaches developing at 3 cycles and established at 6 regular cycles', () => {
    const three = withPeriods(startsFromLengths('2026-01-01', [28, 29, 27]));
    expect(forecast(three, '2026-04-01').confidence).toBe('developing');
    const six = withPeriods(startsFromLengths('2026-01-01', [28, 29, 27, 28, 30, 28]));
    const f = forecast(six, '2026-07-01');
    expect(f.confidence).toBe('established');
    expect(f.predictedCycleLength).toBe(28);
    expect(f.irregular).toBe(false);
  });

  it('never reaches established for irregular cycles and widens the window', () => {
    const data = withPeriods(startsFromLengths('2026-01-01', [24, 38, 27, 41, 25, 35]));
    const f = forecast(data, '2026-08-01');
    expect(f.irregular).toBe(true);
    expect(f.confidence).toBe('developing');
    const width = (Date.parse(f.nextPeriod!.latest) - Date.parse(f.nextPeriod!.earliest)) / 86400000;
    expect(width).toBeGreaterThanOrEqual(12);
  });

  it('excludes implausible cycles (e.g. a missed log) from predictions', () => {
    const data = withPeriods(startsFromLengths('2026-01-01', [28, 28, 120, 28, 28]));
    const f = forecast(data, '2026-10-01');
    expect(f.usedCycleLengths).not.toContain(120);
    expect(f.explanation.join(' ')).toMatch(/left out/);
  });

  it('reports days past the expected date without calling it a missed period', () => {
    const data = withPeriods(['2026-09-01']);
    const f = forecast(data, '2026-10-04');
    expect(f.nextPeriod?.expected).toBe('2026-09-29');
    expect(f.daysPastExpected).toBe(5);
  });

  it('estimates a calendar fertile window 14 days before the next period', () => {
    const data = withPeriods(startsFromLengths('2026-01-01', [28, 28, 28]));
    const f = forecast(data, '2026-03-30');
    expect(f.nextPeriod?.expected).toBe('2026-04-23');
    expect(f.ovulation?.expected).toBe('2026-04-09');
    expect(f.ovulation?.method).toBe('calendar');
    expect(f.fertile?.start).toBe('2026-04-04');
    expect(f.fertile?.end).toBe('2026-04-10');
  });

  it('never starts the fertile window before the current cycle', () => {
    const data = withPeriods(['2026-03-01']);
    data.settings.cycle.typicalCycleLength = 18;
    const f = forecast(data, '2026-03-03');
    expect(f.fertile!.start >= '2026-03-01').toBe(true);
    expect(f.ovulation!.earliest > f.lastPeriod!.end).toBe(true);
  });

  it('prefers a positive LH test over the calendar estimate', () => {
    let data = withPeriods(['2026-05-01']);
    data = addLog(data, { date: '2026-05-12', lh: 'negative' });
    data = addLog(data, { date: '2026-05-13', lh: 'positive' });
    const f = forecast(data, '2026-05-14');
    expect(f.ovulation?.method).toBe('lh');
    expect(f.ovulation?.expected).toBe('2026-05-14');
    expect(f.explanation.join(' ')).toMatch(/does not confirm ovulation/);
  });

  it('handles a period that crosses a leap day', () => {
    const data = withPeriods(['2028-01-31', '2028-02-28']);
    const f = forecast(data, '2028-03-05');
    expect(f.cycles[0]?.length).toBe(28);
    expect(f.lastPeriod?.end).toBe('2028-03-03');
  });

  it('ignores logs dated in the future', () => {
    const data = withPeriods(['2026-09-01', '2026-12-01']);
    const f = forecast(data, '2026-09-10');
    expect(f.lastPeriod?.start).toBe('2026-09-01');
  });
});

describe('confidence rules', () => {
  it('follows the documented thresholds', () => {
    expect(confidenceFor(0, undefined)).toBe('limited');
    expect(confidenceFor(2, 0)).toBe('limited');
    expect(confidenceFor(3, 2)).toBe('developing');
    expect(confidenceFor(6, 7)).toBe('established');
    expect(confidenceFor(6, 8)).toBe('developing');
    expect(confidenceFor(12, 3)).toBe('established');
  });
});

describe('basal body temperature', () => {
  const temps = (start: string, values: number[]) =>
    values.map((bbt, i) => ({ date: addDays(start, i), bbt }));

  it('detects a 3-over-6 thermal shift', () => {
    const logs = temps('2026-05-06', [36.3, 36.4, 36.3, 36.35, 36.4, 36.3, 36.65, 36.7, 36.6]);
    expect(detectThermalShift(logs)).toBe('2026-05-12');
  });

  it('does not report a shift from a single high reading', () => {
    const logs = temps('2026-05-06', [36.3, 36.4, 36.3, 36.35, 36.4, 36.3, 36.8, 36.4, 36.7]);
    expect(detectThermalShift(logs)).toBeUndefined();
  });
});

describe('calendar classification', () => {
  it('lets logged bleeding override predictions', () => {
    const data = withPeriods(startsFromLengths('2026-01-01', [28, 28, 28]));
    const f = forecast(data, '2026-03-30');
    expect(classifyDay(f, data.logs, '2026-03-26', true)).toBe('period');
    expect(classifyDay(f, data.logs, '2026-04-23', true)).toBe('predicted-period');
    expect(classifyDay(f, data.logs, '2026-04-09', true)).toBe('ovulation');
    expect(classifyDay(f, data.logs, '2026-04-09', false)).toBe('none');
  });
});
