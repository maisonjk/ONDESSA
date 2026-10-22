// Generates the realistic, non-tour datasets used for store screenshots (npm run store:assets).
import { mkdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { tourData } from '../../src/app/tour';
import { addDays, forecast, localToday } from '../../src/engine';

it('writes screenshot datasets', () => {
  const today = localToday();
  const base = tourData(today);
  base.settings.showFertility = true;
  base.settings.fertilitySigns = true;
  base.settings.goal = 'conceive';
  base.lastBackupOn = today;
  const f = forecast(base, today);
  const start = f.lastPeriod!.start;
  // A realistic temperature curve and LH test in the current cycle.
  const temps = [36.32, 36.4, 36.35, 36.3, 36.38, 36.33, 36.36, 36.31, 36.37];
  temps.forEach((t, i) => {
    const date = addDays(start, 3 + i);
    if (date <= today) base.logs[date] = { ...base.logs[date], date, bbt: t };
  });
  const lh = addDays(today, -1);
  base.logs[lh] = { ...base.logs[lh], date: lh, lh: 'positive', mucus: 'eggwhite' };
  const preg = structuredClone(base);
  preg.settings.goal = 'pregnant';
  preg.pregnancy = { startedOn: addDays(today, -60), clinicianDueDate: addDays(today, 150) };
  preg.appointments = [
    { id: 'a1', date: addDays(today, 12), title: 'Anatomy scan' },
    { id: 'a2', date: addDays(today, 40), title: 'Midwife check-in' },
  ];
  const understand = tourData(today);
  understand.lastBackupOn = today;
  mkdirSync('store/.work', { recursive: true });
  writeFileSync('store/.work/data.json', JSON.stringify({ base, preg, understand }));
});
