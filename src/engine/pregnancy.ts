import { addDays, diffDays, type ISODate } from './dates';
import { RULES } from './rules';
import type { Pregnancy } from './types';

export interface PregnancyStatus {
  dueDate: ISODate;
  source: 'clinician' | 'lmp';
  gestationalDays: number;
  week: number;
  day: number;
  trimester: 1 | 2 | 3;
  daysToGo: number;
  progress: number;
  pastDueDate: boolean;
}

/**
 * Naegele's rule (LMP + 280 days) with the common adjustment for cycle length.
 * The adjustment is only applied inside the typical cycle range; otherwise it is
 * unreliable and the user is told to rely on a clinician's dating.
 */
export function dueDateFromLmp(lmp: ISODate, cycleLength = 28): ISODate {
  const { min, max } = RULES.typicalCycleRange;
  const adjust = cycleLength >= min && cycleLength <= max ? cycleLength - 28 : 0;
  return addDays(lmp, RULES.gestationDays + adjust);
}

export function pregnancyStatus(
  p: Pregnancy,
  today: ISODate,
  cycleLength = 28,
): PregnancyStatus | undefined {
  let dueDate: ISODate;
  let source: PregnancyStatus['source'];
  if (p.clinicianDueDate) {
    dueDate = p.clinicianDueDate;
    source = 'clinician';
  } else if (p.lmp) {
    dueDate = dueDateFromLmp(p.lmp, cycleLength);
    source = 'lmp';
  } else {
    return undefined;
  }
  const gestationalDays = RULES.gestationDays - diffDays(today, dueDate);
  if (gestationalDays < 0) return undefined;
  const week = Math.floor(gestationalDays / 7);
  const [, t2, t3] = RULES.trimesterStartWeeks;
  return {
    dueDate,
    source,
    gestationalDays,
    week,
    day: gestationalDays % 7,
    trimester: week >= t3 ? 3 : week >= t2 ? 2 : 1,
    daysToGo: Math.max(0, diffDays(today, dueDate)),
    progress: Math.min(1, gestationalDays / RULES.gestationDays),
    pastDueDate: today > dueDate,
  };
}
