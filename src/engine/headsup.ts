import { addDays, diffDays, type ISODate } from './dates';
import type { Insight } from './patterns';
import type { Forecast } from './predict';
import type { DayLog, Symptom } from './types';

/**
 * "Heads up": turns a pre-period symptom pattern into a forward-looking note for the
 * days ahead, e.g. "Bloating usually starts in about 3 days." Computed only from the
 * user's own logged pattern and the current prediction. Never shown during a period,
 * when late, or more than a week before the symptom usually begins.
 */
export interface HeadsUp {
  symptom: Symptom;
  title: string;
  detail: string;
  hits: number;
  total: number;
}

const PLURAL: Partial<Record<Symptom, string>> = {
  headache: 'Headaches', cramps: 'Cramps', cravings: 'Cravings', 'hot flush': 'Hot flushes', 'night sweats': 'Night sweats',
};

export function headsUp(f: Forecast, insights: Insight[], today: ISODate): HeadsUp | undefined {
  if (!f.nextPeriod || f.inPeriod || f.daysPastExpected > 0) return undefined;
  const daysTo = diffDays(today, f.nextPeriod.expected);
  if (daysTo < 1) return undefined;
  const best = insights
    .filter((i) => i.kind === 'symptom' && i.symptom && i.leadDays && i.evidence)
    .sort((a, b) => b.evidence!.hits / b.evidence!.total - a.evidence!.hits / a.evidence!.total)[0];
  if (!best) return undefined;
  const lead = best.leadDays!;
  const startsIn = daysTo - lead;
  if (startsIn > 7) return undefined;
  const plural = PLURAL[best.symptom!];
  const name = plural ?? best.symptom!.charAt(0).toUpperCase() + best.symptom!.slice(1);
  const verb = plural ? 'start' : 'starts';
  const shows = plural ? 'show' : 'shows';
  const title =
    startsIn <= 0 ? `${name} often ${shows} up around now.`
      : startsIn === 1 ? `${name} usually ${verb} in about a day.`
        : `${name} usually ${verb} in about ${startsIn} days.`;
  const { hits, total } = best.evidence!;
  return {
    symptom: best.symptom!,
    title,
    detail: `In ${hits} of your last ${total} cycles it began about ${lead} day${lead === 1 ? '' : 's'} before your period. A pattern in your logs, not a prediction about your body.`,
    hits,
    total,
  };
}

/**
 * Symptoms this person has logged around the same point in earlier cycles (within a day
 * either side of today's cycle day, in at least two cycles), most frequent first. Used to
 * put the likeliest choices first on the log screen. Purely a reordering aid.
 */
export function commonAroundNow(f: Forecast, logs: Record<ISODate, DayLog>, date: ISODate): Symptom[] {
  if (!f.lastPeriod || date < f.lastPeriod.start) return [];
  const day = diffDays(f.lastPeriod.start, date);
  const counts = new Map<Symptom, number>();
  for (const c of f.cycles.slice(-6)) {
    const seen = new Set<Symptom>();
    for (let k = day - 1; k <= day + 1; k++) {
      if (k < 0 || k >= c.length) continue;
      for (const s of logs[addDays(c.start, k)]?.symptoms ?? []) seen.add(s);
    }
    for (const s of seen) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([s]) => s);
}
