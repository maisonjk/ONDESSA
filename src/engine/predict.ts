import {
  addDays, diffDays, formatShort, maxDate, type ISODate,
} from './dates';
import { deriveCycles, derivePeriods, median, type Cycle, type Period } from './cycles';
import { RULES } from './rules';
import type { AppData, DayLog } from './types';

export type Confidence = 'limited' | 'developing' | 'established';
export type OvulationMethod = 'calendar' | 'lh' | 'bbt';

export interface DateWindow {
  expected: ISODate;
  earliest: ISODate;
  latest: ISODate;
}

export interface Forecast {
  today: ISODate;
  periods: Period[];
  cycles: Cycle[];
  lastPeriod?: Period;
  /** 1-based day of the current cycle, if a period has been logged. */
  cycleDay?: number;
  inPeriod: boolean;
  predictedCycleLength: number;
  predictedPeriodLength: number;
  lengthSource: 'settings' | 'blended' | 'history';
  usedCycleLengths: number[];
  usableCycleCount: number;
  variation?: number;
  confidence: Confidence;
  irregular: boolean;
  nextPeriod?: DateWindow;
  /** Whole days past the expected date with no new period logged (0 if not late). */
  daysPastExpected: number;
  ovulation?: DateWindow & { method: OvulationMethod; bbtShiftOn?: ISODate };
  fertile?: { start: ISODate; end: ISODate; widestStart: ISODate; widestEnd: ISODate };
  /** Projected future period windows after the next one, for the calendar. */
  laterPeriods: DateWindow[];
  explanation: string[];
}

export function confidenceFor(usableCount: number, variation: number | undefined): Confidence {
  const c = RULES.confidence;
  if (usableCount < c.developingMinCycles) return 'limited';
  if (usableCount >= c.establishedMinCycles && (variation ?? 0) <= c.regularVariationDays) {
    return 'established';
  }
  return 'developing';
}

export const CONFIDENCE_COPY: Record<Confidence, { label: string; detail: string }> = {
  limited: {
    label: 'Limited data',
    detail: 'Fewer than 3 complete cycles logged. Predictions lean on the cycle length you entered and may change.',
  },
  developing: {
    label: 'Developing pattern',
    detail: '3 or more complete cycles logged, but not yet enough history or consistency to call it an established pattern.',
  },
  established: {
    label: 'Established personal pattern',
    detail: '6 or more recent cycles that vary by 7 days or less. Still an estimate: bodies change.',
  },
};

export function forecast(data: AppData, today: ISODate): Forecast {
  const { typicalCycleLength, typicalPeriodLength } = data.settings.cycle;
  const periods = derivePeriods(data.logs).filter((p) => p.start <= today);
  const cycles = deriveCycles(periods);
  const usable = cycles.filter((c) => c.usable);
  const recent = usable.slice(-RULES.predictionWindow).map((c) => c.length);
  const n = usable.length;
  const explanation: string[] = [];

  let predictedCycleLength: number;
  let lengthSource: Forecast['lengthSource'];
  if (recent.length === 0) {
    predictedCycleLength = typicalCycleLength;
    lengthSource = 'settings';
    explanation.push(
      `No complete cycles are logged yet, so predictions use the ${typicalCycleLength}-day cycle length you entered.`,
    );
  } else if (recent.length < RULES.confidence.developingMinCycles) {
    const missing = RULES.confidence.developingMinCycles - recent.length;
    predictedCycleLength = Math.round(
      (recent.reduce((a, b) => a + b, 0) + typicalCycleLength * missing) / RULES.confidence.developingMinCycles,
    );
    lengthSource = 'blended';
    explanation.push(
      `Based on ${recent.length} complete cycle${recent.length > 1 ? 's' : ''} (${recent.join(', ')} days) blended with the ${typicalCycleLength}-day length you entered.`,
    );
  } else {
    predictedCycleLength = Math.round(median(recent));
    lengthSource = 'history';
    explanation.push(
      `Based on the median of your last ${recent.length} complete cycles (${recent.join(', ')} days): ${predictedCycleLength} days.`,
    );
  }
  const excluded = cycles.length - usable.length;
  if (excluded > 0) {
    explanation.push(
      `${excluded} logged cycle${excluded > 1 ? 's were' : ' was'} shorter than ${RULES.plausibleCycle.min} or longer than ${RULES.plausibleCycle.max} days and ${excluded > 1 ? 'were' : 'was'} left out of the prediction.`,
    );
  }

  const variation = recent.length >= 2 ? Math.max(...recent) - Math.min(...recent) : undefined;
  const confidence = confidenceFor(n, variation);
  const irregular =
    recent.length >= RULES.confidence.developingMinCycles &&
    (variation ?? 0) > RULES.confidence.regularVariationDays;

  const measuredPeriods = periods.slice(0, -1).filter((p) => p.length >= 2).map((p) => p.length);
  const predictedPeriodLength =
    measuredPeriods.length >= 2 ? Math.round(median(measuredPeriods.slice(-6))) : typicalPeriodLength;

  const lastPeriod = periods[periods.length - 1];
  const base: Forecast = {
    today, periods, cycles, lastPeriod,
    inPeriod: false,
    predictedCycleLength, predictedPeriodLength, lengthSource,
    usedCycleLengths: recent, usableCycleCount: n, variation,
    confidence, irregular,
    daysPastExpected: 0,
    laterPeriods: [],
    explanation,
  };

  if (!lastPeriod) {
    explanation.push('Log the first day of your period to see predictions.');
    return base;
  }

  const cycleDay = diffDays(lastPeriod.start, today) + 1;
  const inPeriod = today >= lastPeriod.start && today <= lastPeriod.end;

  let halfWidth: number = RULES.windowHalfWidth[confidence];
  if (irregular && variation !== undefined) {
    halfWidth = Math.max(halfWidth, Math.min(RULES.irregularHalfWidthCap, Math.ceil(variation / 2)));
    explanation.push(
      `Your recent cycles vary by ${variation} days, so the expected window is wider (±${halfWidth} days).`,
    );
  } else {
    explanation.push(
      `The expected window is ±${halfWidth} day${halfWidth > 1 ? 's' : ''} around the projected date, reflecting ${CONFIDENCE_COPY[confidence].label.toLowerCase()}.`,
    );
  }

  const expected = addDays(lastPeriod.start, predictedCycleLength);
  const nextPeriod: DateWindow = {
    expected,
    earliest: maxDate(addDays(expected, -halfWidth), addDays(lastPeriod.end, 1)),
    latest: addDays(expected, halfWidth),
  };
  const daysPastExpected = Math.max(0, diffDays(expected, today));
  explanation.unshift(
    `Your next period is projected for ${formatShort(expected)}, ${predictedCycleLength} days after your last period started on ${formatShort(lastPeriod.start)}.`,
  );

  const laterPeriods: DateWindow[] = [];
  for (let k = 1; k <= 3; k++) {
    const e = addDays(expected, predictedCycleLength * k);
    const hw = Math.min(halfWidth + k, RULES.irregularHalfWidthCap + 2);
    laterPeriods.push({ expected: e, earliest: addDays(e, -hw), latest: addDays(e, hw) });
  }

  const ovulation = estimateOvulation(data.logs, lastPeriod, nextPeriod, explanation);
  const fertile = {
    start: maxDate(addDays(ovulation.expected, -RULES.fertileBefore), lastPeriod.start),
    end: addDays(ovulation.expected, RULES.fertileAfter),
    widestStart: maxDate(addDays(ovulation.earliest, -RULES.fertileBefore), lastPeriod.start),
    widestEnd: addDays(ovulation.latest, RULES.fertileAfter),
  };

  return {
    ...base,
    cycleDay, inPeriod, nextPeriod, daysPastExpected, ovulation, fertile, laterPeriods,
  };
}

function estimateOvulation(
  logs: Record<ISODate, DayLog>,
  lastPeriod: Period,
  next: DateWindow,
  explanation: string[],
): NonNullable<Forecast['ovulation']> {
  const cycleLogs = Object.values(logs)
    .filter((l) => l.date > lastPeriod.end && l.date < next.latest)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const bbtShiftOn = detectThermalShift(cycleLogs);
  const firstLh = cycleLogs.find((l) => l.lh === 'positive');

  if (firstLh) {
    const expected = addDays(firstLh.date, 1);
    explanation.push(
      `You logged a positive LH test on ${formatShort(firstLh.date)}. Ovulation often follows within about 12–36 hours, so it is estimated around ${formatShort(expected)}. A positive test does not confirm ovulation.`,
    );
    return { expected, earliest: firstLh.date, latest: addDays(firstLh.date, 2), method: 'lh', bbtShiftOn };
  }
  if (bbtShiftOn) {
    const expected = addDays(bbtShiftOn, -1);
    explanation.push(
      `Your temperatures rose and stayed higher from ${formatShort(bbtShiftOn)}. That pattern suggests ovulation likely already happened around ${formatShort(expected)}. Illness, alcohol and poor sleep can also raise temperature.`,
    );
    return { expected, earliest: addDays(bbtShiftOn, -2), latest: bbtShiftOn, method: 'bbt', bbtShiftOn };
  }

  const expected = addDays(next.expected, -RULES.lutealDays);
  explanation.push(
    `Ovulation is estimated ${RULES.lutealDays} days before your next expected period. The phase after ovulation usually lasts ${RULES.lutealRange.min}–${RULES.lutealRange.max} days, so this is an estimate, not a confirmation.`,
  );
  return {
    expected,
    earliest: maxDate(addDays(next.earliest, -RULES.lutealRange.max), addDays(lastPeriod.end, 1)),
    latest: addDays(next.latest, -RULES.lutealRange.min),
    method: 'calendar',
  };
}

/**
 * "3 over 6" rule: the first of three consecutive readings that are each at least
 * RULES.bbtShiftC above the highest of the six readings before them.
 */
export function detectThermalShift(logs: DayLog[]): ISODate | undefined {
  const temps = logs.filter((l) => typeof l.bbt === 'number') as (DayLog & { bbt: number })[];
  const k = RULES.bbtCoverline;
  for (let i = k; i + 2 < temps.length; i++) {
    const coverline = Math.max(...temps.slice(i - k, i).map((t) => t.bbt));
    const threshold = coverline + RULES.bbtShiftC - 1e-9;
    if (temps[i]!.bbt >= threshold && temps[i + 1]!.bbt >= threshold && temps[i + 2]!.bbt >= threshold) {
      return temps[i]!.date;
    }
  }
  return undefined;
}

export type DayKind =
  | 'period' | 'spotting' | 'predicted-period' | 'possible-period' | 'fertile' | 'ovulation' | 'none';

/** Visual classification of a calendar day. Logged data always wins over predictions. */
export function classifyDay(
  f: Forecast,
  logs: Record<ISODate, DayLog>,
  date: ISODate,
  showFertility: boolean,
): DayKind {
  if (logs[date]?.flow === 'spotting') return 'spotting';
  if (f.periods.some((p) => date >= p.start && date <= p.end)) return 'period';

  const windows = f.nextPeriod ? [f.nextPeriod, ...f.laterPeriods] : [];
  const afterLastPeriod = date > (f.lastPeriod?.end ?? '');
  for (const w of windows) {
    const end = addDays(w.expected, f.predictedPeriodLength - 1);
    if (afterLastPeriod && date >= w.expected && date <= end) return 'predicted-period';
  }
  // The rest of each expected window: the period could start or run on these days.
  for (const w of windows) {
    const end = addDays(w.latest, f.predictedPeriodLength - 1);
    if (afterLastPeriod && date >= w.earliest && date <= end) return 'possible-period';
  }

  if (showFertility && f.ovulation && f.fertile) {
    if (date === f.ovulation.expected) return 'ovulation';
    if (date >= f.fertile.start && date <= f.fertile.end) return 'fertile';
    // Later cycles: calendar projection only.
    for (const w of windows.slice(0, 2)) {
      const ov = addDays(w.expected, f.predictedCycleLength - RULES.lutealDays);
      if (date === ov) return 'ovulation';
      if (date >= addDays(ov, -RULES.fertileBefore) && date <= addDays(ov, RULES.fertileAfter)) return 'fertile';
    }
  }
  return 'none';
}

export type Phase = 'menstrual' | 'follicular' | 'fertile' | 'luteal';

export const PHASE_COPY: Record<Phase, { label: string; short: string }> = {
  menstrual: { label: 'Period', short: 'Period' },
  follicular: { label: 'Follicular phase', short: 'Follicular' },
  fertile: { label: 'Fertile window (estimate)', short: 'Fertile' },
  luteal: { label: 'Luteal phase (estimate)', short: 'Luteal' },
};

/**
 * Estimated cycle phase for a date in the current cycle, used for colour and labels only.
 * Phases after the period are estimates derived from the fertile-window estimate. When
 * fertility estimates are hidden, the fertile window folds into the neighbouring phases.
 */
export function phaseOn(f: Forecast, date: ISODate, showFertility = true): Phase | undefined {
  if (!f.lastPeriod || !f.fertile || !f.ovulation || !f.nextPeriod) return undefined;
  if (date < f.lastPeriod.start) return undefined;
  // With only a start date logged (e.g. from setup), assume the usual period length.
  const periodEnd = f.lastPeriod.length > 1 ? f.lastPeriod.end : addDays(f.lastPeriod.start, f.predictedPeriodLength - 1);
  if (date <= periodEnd) return 'menstrual';
  if (date >= f.nextPeriod.expected) {
    return date < addDays(f.nextPeriod.expected, f.predictedPeriodLength) ? 'menstrual' : undefined;
  }
  if (date < f.fertile.start) return 'follicular';
  if (date <= f.fertile.end) {
    if (showFertility) return 'fertile';
    return date <= f.ovulation.expected ? 'follicular' : 'luteal';
  }
  return 'luteal';
}

/**
 * The fertile window worth showing now: the current cycle's while it is still ahead or
 * under way, otherwise a calendar projection for the next cycle.
 */
export function upcomingFertileWindow(
  f: Forecast,
): { start: ISODate; end: ISODate; ovulation: ISODate; projected: boolean } | undefined {
  if (!f.fertile || !f.ovulation || !f.nextPeriod) return undefined;
  if (f.today <= f.fertile.end) {
    return { start: f.fertile.start, end: f.fertile.end, ovulation: f.ovulation.expected, projected: false };
  }
  const ovulation = addDays(f.nextPeriod.expected, f.predictedCycleLength - RULES.lutealDays);
  return {
    start: addDays(ovulation, -RULES.fertileBefore),
    end: addDays(ovulation, RULES.fertileAfter),
    ovulation,
    projected: true,
  };
}
