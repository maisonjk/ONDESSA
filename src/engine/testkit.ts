import { addDays, type ISODate } from './dates';
import { emptyData, type AppData, type DayLog, type Flow } from './types';

/** Synthetic data builder for tests and the product tour. Never used with real data. */
export function withPeriods(
  starts: ISODate[],
  periodLength = 5,
  base: AppData = emptyData('2025-01-01'),
): AppData {
  const logs: Record<ISODate, DayLog> = { ...base.logs };
  for (const s of starts) {
    for (let i = 0; i < periodLength; i++) {
      const date = addDays(s, i);
      const flow: Flow = i === 0 ? 'medium' : i < 2 ? 'heavy' : 'light';
      logs[date] = { ...logs[date], date, flow };
    }
  }
  return { ...base, logs };
}

export function startsFromLengths(first: ISODate, lengths: number[]): ISODate[] {
  const out = [first];
  for (const len of lengths) out.push(addDays(out[out.length - 1]!, len));
  return out;
}

export function addLog(data: AppData, log: DayLog): AppData {
  return { ...data, logs: { ...data.logs, [log.date]: { ...data.logs[log.date], ...log } } };
}
