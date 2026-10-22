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
                                              /app/membership      Membership (plan, renewal, key)
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

## UX revisions (senior UX audit, 2026-10-22)

| Finding | Change |
|---|---|
| Paywall claimed a prediction it didn't show | Plans shows the user's own next-period window, ring and confidence; "not sure" users see "You're set up" |
| Price appeared only after setup | Price stated on onboarding step 1; restore-from-backup offered before purchase |
| Tour was a dead end | Tour banner has "Start with my own data"; Plans links to the tour |
| Fertility assumed conception intent | "Show estimated fertile days" choice, off unless the goal is conceiving |
| Quick log offered flow chips all cycle | Phase-aware quick log: flow near/during periods, top symptoms and mood otherwise |
| Saves were never confirmed | Shell-level toast |
| Passed fertile window kept showing | Today and Fertility show the next projected window |
| Calendar hid uncertainty | "Possible" days for the full expected window; ovulation in legend |
| Patterns empty for months | Progress card: cycles complete of 3, days logged, most-logged symptoms |
| Membership opened the sales page | In-app Membership screen |
| No backup prompts | Backup card after 30 logged days without a backup in 90 days |
| Accessibility | Faint text raised to ≥4.5:1, 44px targets for chips, toggles, summaries and checkboxes; visible step count |
