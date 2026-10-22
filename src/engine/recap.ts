import { addDays, diffDays, formatShort, type ISODate } from './dates';
import { forecast } from './predict';
import type { AppData, Mood, Symptom } from './types';

/**
 * Recap of the most recent complete cycle: its length, how much was logged, the most
 * logged symptoms and moods, and how close Ondessa's prediction was. The prediction is
 * recomputed exactly as it would have been the day before the period started, using
 * only the logs that existed up to then, so the accuracy figure is honest.
 */
export interface CycleRecap {
  start: ISODate;
  nextStart: ISODate;
  length: number;
  periodLength: number;
  daysLogged: number;
  topSymptoms: Symptom[];
  topMood?: Mood;
  predicted?: ISODate;
  /** Actual start minus predicted start: positive means the period came later. */
  offsetDays?: number;
}

export function lastCycleRecap(data: AppData, today: ISODate): CycleRecap | undefined {
  const f = forecast(data, today);
  const c = f.cycles[f.cycles.length - 1];
  if (!c) return undefined;

  const inCycle = Object.values(data.logs).filter((l) => l.date >= c.start && l.date < c.nextStart);
  const symptoms = new Map<Symptom, number>();
  const moods = new Map<Mood, number>();
  for (const l of inCycle) {
    for (const s of l.symptoms ?? []) symptoms.set(s, (symptoms.get(s) ?? 0) + 1);
    if (l.mood) moods.set(l.mood, (moods.get(l.mood) ?? 0) + 1);
  }
  const ranked = <T,>(m: Map<T, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const dayBefore = addDays(c.nextStart, -1);
  const earlier = Object.fromEntries(Object.entries(data.logs).filter(([d]) => d < c.nextStart));
  const then = forecast({ ...data, logs: earlier }, dayBefore);
  const predicted = then.nextPeriod?.expected;

  return {
    start: c.start,
    nextStart: c.nextStart,
    length: c.length,
    periodLength: c.periodLength,
    daysLogged: inCycle.length,
    topSymptoms: ranked(symptoms).slice(0, 3),
    topMood: ranked(moods)[0],
    predicted,
    offsetDays: predicted ? diffDays(predicted, c.nextStart) : undefined,
  };
}

export function accuracyHeadline(r: CycleRecap): string {
  if (r.offsetDays === undefined) return 'Your first full cycle is logged.';
  const off = Math.abs(r.offsetDays);
  if (off === 0) return 'Predicted to the day.';
  if (off === 1) return 'Called it within a day.';
  if (off <= 3) return `Within ${off} days of the prediction.`;
  return `${off} days ${r.offsetDays > 0 ? 'later' : 'earlier'} than predicted.`;
}

/** Plain-text recap for sharing. Symptoms and moods are included only when asked. */
export function recapText(r: CycleRecap, includeSymptoms: boolean): string {
  const lines = [
    `My cycle recap · ${formatShort(r.start)} to ${formatShort(addDays(r.nextStart, -1))}`,
    `Cycle: ${r.length} days · Period: ${r.periodLength} day${r.periodLength === 1 ? '' : 's'} · Days logged: ${r.daysLogged}`,
  ];
  if (r.predicted) lines.push(`${accuracyHeadline(r)} Predicted ${formatShort(r.predicted)}, started ${formatShort(r.nextStart)}.`);
  if (includeSymptoms && (r.topSymptoms.length || r.topMood)) {
    lines.push(`Most logged: ${[...r.topSymptoms, ...(r.topMood ? [r.topMood] : [])].join(', ')}`);
  }
  lines.push('Tracked privately with Ondessa.');
  return lines.join('\n');
}
