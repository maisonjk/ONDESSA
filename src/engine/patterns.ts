import { addDays, diffDays, formatShort, type ISODate } from './dates';
import { mean } from './cycles';
import type { Forecast } from './predict';
import { RULES } from './rules';
import type { DayLog, Symptom } from './types';

/**
 * "My Cycle, My Patterns": template-based observations computed only from logged data.
 * No model, no generated text. Each insight carries the data it was computed from and an
 * explicit limitation, and none claims a cause.
 */
export interface Insight {
  id: string;
  kind: 'data' | 'trend' | 'symptom' | 'range' | 'variation' | 'care';
  title: string;
  body: string;
  basis: string;
  limitation: string;
}

const CORRELATION_NOTE =
  'This is a pattern in what you logged, not a cause. Days you did not log are not counted.';

export function findPatterns(f: Forecast, logs: Record<ISODate, DayLog>): Insight[] {
  const out: Insight[] = [];
  const usable = f.cycles.filter((c) => c.usable);
  const P = RULES.patterns;

  if (usable.length < RULES.confidence.developingMinCycles) {
    out.push({
      id: 'limited-history',
      kind: 'data',
      title: 'Your history is still short',
      body:
        usable.length === 0
          ? 'Your cycle history is still limited, so predictions use the cycle length you entered and may change.'
          : `You have ${usable.length} complete cycle${usable.length > 1 ? 's' : ''} logged. Your cycle history is still limited, so this prediction may change.`,
      basis: `${usable.length} complete cycle${usable.length === 1 ? '' : 's'} logged.`,
      limitation: 'Patterns appear after at least 3 complete cycles.',
    });
  }

  // Cycle-length trend: last 3 vs the cycles before them.
  if (usable.length >= P.trendMinCycles) {
    const last3 = usable.slice(-3).map((c) => c.length);
    const before = usable.slice(-9, -3).map((c) => c.length);
    const delta = mean(last3) - mean(before);
    if (Math.abs(delta) >= P.trendDeltaDays) {
      const dir = delta > 0 ? 'longer' : 'shorter';
      out.push({
        id: 'length-trend',
        kind: 'trend',
        title: `Your recent cycles have been ${dir}`,
        body: `Your last three cycles have been ${dir} than your earlier cycles: about ${Math.round(mean(last3))} days, compared with about ${Math.round(mean(before))} days before.`,
        basis: `Last 3 cycles: ${last3.join(', ')} days. Previous ${before.length}: ${before.join(', ')} days.`,
        limitation:
          'Stress, travel, illness, contraception changes and life stage can all shift cycle length. A few cycles is a small sample.',
      });
    }
  }

  // Pre-period symptoms.
  const recentCycles = usable.slice(-6);
  if (recentCycles.length >= P.minCyclesForSymptomPattern) {
    const counts = new Map<Symptom, number>();
    for (const c of recentCycles) {
      const seen = new Set<Symptom>();
      for (let d = 1; d <= P.preMenstrualDays; d++) {
        for (const s of logs[addDays(c.nextStart, -d)]?.symptoms ?? []) seen.add(s);
      }
      for (const s of seen) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const ranked = [...counts.entries()]
      .filter(([, n]) => n >= P.minCyclesForSymptomPattern && n / recentCycles.length >= P.symptomRatio)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    for (const [symptom, n] of ranked) {
      out.push({
        id: `pre-${symptom}`,
        kind: 'symptom',
        title: `${capitalize(symptom)} before your period`,
        body: `You logged ${pluralSymptom(symptom)} in the ${P.preMenstrualDays} days before your period in ${n} of your last ${recentCycles.length} cycles.`,
        basis: `Cycles starting ${formatShort(recentCycles[0]!.start)} to ${formatShort(recentCycles[recentCycles.length - 1]!.start)}.`,
        limitation: CORRELATION_NOTE,
      });
    }
  }

  if (f.variation !== undefined && f.usedCycleLengths.length >= RULES.confidence.developingMinCycles) {
    const lens = f.usedCycleLengths;
    out.push({
      id: 'variation',
      kind: 'variation',
      title: f.irregular ? 'Your cycles vary quite a bit' : 'Your cycles are fairly consistent',
      body: `Your recent cycles ranged from ${Math.min(...lens)} to ${Math.max(...lens)} days.${
        f.irregular ? ' Ondessa shows a wider prediction window to reflect that.' : ''
      }`,
      basis: `Last ${lens.length} complete cycles.`,
      limitation: 'Some variation is normal. Variation of more than 7–9 days can be worth mentioning to a clinician.',
    });
  }

  const { min, max } = RULES.typicalCycleRange;
  const outside = usable.slice(-3).filter((c) => c.length < min || c.length > max);
  if (outside.length >= 2) {
    out.push({
      id: 'outside-range',
      kind: 'range',
      title: 'Some recent cycles were outside the typical range',
      body: `${outside.length} of your last 3 cycles were shorter than ${min} or longer than ${max} days. If this continues, it may be worth discussing with a healthcare professional.`,
      basis: `Cycle lengths: ${outside.map((c) => c.length).join(', ')} days.`,
      limitation: 'Ondessa cannot diagnose why. Many things, including normal life-stage changes, affect cycle length.',
    });
  }

  if (f.lastPeriod) {
    const since = diffDays(f.lastPeriod.start, f.today);
    if (since >= P.missedPeriodDays) {
      out.push({
        id: 'no-period-90',
        kind: 'care',
        title: `No period logged in ${since} days`,
        body: 'If you have not had a period in 3 months and are not pregnant, breastfeeding or in menopause, consider checking in with a healthcare professional. If you have had a period and not logged it, you can add it from the calendar.',
        basis: `Last period logged ${formatShort(f.lastPeriod.start)}.`,
        limitation: 'This is based only on what you logged.',
      });
    }
  }

  return out;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pluralSymptom(s: Symptom): string {
  const plurals: Partial<Record<Symptom, string>> = {
    headache: 'headaches', cramps: 'cramps', 'hot flush': 'hot flushes', cravings: 'cravings',
  };
  return plurals[s] ?? s;
}
