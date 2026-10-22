import { addDays, emptyData, type AppData, type DayLog, type ISODate, type Symptom } from '../engine';

/**
 * Synthetic data for the public product tour. Deterministic, invented, and never saved.
 * Dates are generated relative to today so the tour always looks current.
 */
export function tourData(today: ISODate): AppData {
  const data = emptyData(addDays(today, -200));
  data.settings.goal = 'understand';
  data.settings.fertilitySigns = true;
  const lengths = [29, 27, 30, 28, 29, 28];
  const totalSpan = lengths.reduce((a, b) => a + b, 0);
  let start = addDays(today, -(totalSpan + 11));
  const starts: ISODate[] = [start];
  for (const len of lengths) {
    start = addDays(start, len);
    starts.push(start);
  }

  const logs: Record<ISODate, DayLog> = {};
  const put = (log: DayLog) => (logs[log.date] = { ...logs[log.date], ...log });
  const flows = ['medium', 'heavy', 'heavy', 'light', 'light'] as const;

  starts.forEach((s, ci) => {
    flows.forEach((flow, i) => put({ date: addDays(s, i), flow, ...(i < 2 ? { pain: 2, symptoms: ['cramps'] as Symptom[] } : {}) }));
    if (ci > 0) {
      // headaches before 4 of 6 periods, bloating before 5
      if (ci % 3 !== 0) put({ date: addDays(s, -2), symptoms: ['headache', 'bloating'], mood: 'irritable', energy: 2 });
      else put({ date: addDays(s, -3), symptoms: ['bloating'], energy: 3 });
    }
    put({ date: addDays(s, 9), mood: 'happy', energy: 5, sleep: 4 });
    put({ date: addDays(s, 13), mucus: 'eggwhite', mood: 'calm', energy: 4 });
  });
  put({ date: addDays(today, -1), mood: 'calm', energy: 4, sleep: 4, note: 'Sample note: long walk, slept well.' });
  data.logs = logs;
  return data;
}
