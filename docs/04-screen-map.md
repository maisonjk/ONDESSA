# Screen Map

Hash routes carry screen names only. Selected dates and form state live in memory.

```
Public (no data, no purchase)                 Gated: data + active membership (or tour)
───────────────────────────────               ──────────────────────────────────────────
/            1  Landing                       /app              3  Home dashboard
/start       2  Privacy-first onboarding      /app/calendar     4  Interactive calendar
/plans      11  Subscription & purchase       /app/log          5  Daily logging
/library     9  Educational library           /app/fertility    6  Fertility & ovulation
/library/:s  9  Article                       /app/pregnancy    7  Pregnancy dashboard
/privacy    12  Privacy summary               /app/insights     8  Insights & history
/legal      13  Terms & disclaimers           /app/settings    10  Reminders & settings
/help       13  Help center                   /app/privacy     12  Privacy center & deletion
/deleted        Deletion confirmation         /app/more            Menu
                                              /app/library[/:s]  9  Library (in-app)
System states: Loading · Lock screen (passcode) · Storage unavailable (recovery)
```

## Core flows

**First run:** Landing → Start → privacy promise → goal → dates and lengths (or "not sure") → optional passcode and discreet notifications → saved locally → Plans ("Your first prediction is ready") → purchase or restore → Home.

**Tour:** Landing → Take the tour → synthetic data in memory → full app with banner → Exit tour → Landing. Nothing written to storage.

**Daily:** Home → quick flow chips, or Log (+) → optional sections → Done. Autosaves on every tap (debounced 250 ms).

**Pregnancy:** Settings life stage, or More → Pregnancy → clinician due date or LMP → Pregnancy mode. Cycle reminders pause and history is kept. End mode → archived to `pastPregnancies`.

**Delete:** Privacy center → type DELETE → database, keys and caches removed → re-check → `/deleted` with verified status.

## Navigation

Mobile: bottom tab bar (Today, Calendar, raised Log button, Patterns, More). At 960 px and wider it becomes a left sidebar with the same five items.
