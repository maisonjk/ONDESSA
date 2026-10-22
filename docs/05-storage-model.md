# Storage Model

## Where things live

| Store | Key | Contents | Health data? |
|---|---|---|---|
| IndexedDB `ondessa` / `vault` | `data` | `{mode:'plain', data: AppData}` or `{mode:'locked', envelope}` | Yes |
| localStorage | `ondessa.entitlement` | Signed membership key or preview marker | No |
| localStorage | `ondessa.lastNotice` | Date of last on-open notification | No (date only) |
| Cache Storage | `ondessa-static-v1` | App's own static files | No |

## AppData (schemaVersion 1)

Source of truth: `src/engine/types.ts`. Validator: `src/engine/validate.ts`.

```ts
AppData {
  schemaVersion: 1
  createdOn: ISODate
  settings: {
    goal: 'understand' | 'conceive' | 'pregnant' | 'perimenopause'
    cycle: { typicalCycleLength 15–90, typicalPeriodLength 1–15 }
    showFertility, fertilitySigns, intercourseLogging: boolean   // intercourse default false
    temperatureUnit: 'C' | 'F'; weekStartsOn: 0 | 1
    reminders: { periodHeadsUp, periodHeadsUpDays 1–7, fertileWindow, dailyLog, discreet, pregnancyTestDate? }
  }
  logs: Record<ISODate, DayLog>            // sparse: only days with something logged
  pregnancy?: { startedOn, lmp?, clinicianDueDate? }
  pastPregnancies: Pregnancy[]
  appointments: { id, date, title ≤120, note? ≤2000 }[]
  lastBackupOn?: ISODate                   // drives the 30-day backup reminder
}

DayLog {
  date
  flow?: 'spotting' | 'unspecified' | 'light' | 'medium' | 'heavy'
  symptoms?: Symptom[]; mood?: Mood; energy?, sleep?: 1–5; pain?: 0–3
  mucus?: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite'
  bbt?: number (°C, 34–40, 2 dp); lh?: 'negative' | 'positive'
  intercourse?: true                        // stripped on save/import if logging is off
  note?: string ≤2000
}
```

**Derived, never stored:** periods, cycles, forecasts, insights, reminders. Recomputed on each change in under 1 ms for years of data.

**Size:** about 150 bytes per logged day, so roughly 55 KB per year of daily logging. One-record storage keeps encryption, export and delete atomic. Revisit if records exceed 5 MB.

## Migrations

`schemaVersion` gates the sanitizer. A new version adds `migrateV1toV2` before sanitizing, plus a round-trip test. Unknown versions show the recovery screen rather than overwriting.

## Backups

`{app:'ondessa', kind:'plain'|'encrypted', exportedOn, payload}`. Encrypted payloads use the same envelope as the vault, with a separate password of at least 8 characters. Import fully replaces data after confirmation (no merge in v1).
