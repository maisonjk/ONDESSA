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
/deleted        Deletion confirmation         /app/you             You (membership, privacy status, menu; /app/more is an alias)
                                              /app/share           Partner sharing (message + calendar file)
                                              /app/recap           Last-cycle recap and prediction accuracy
                                              /app/history         Add past periods
                                              /app/membership      Membership (plan, renewal, key)
                                              /app/library[/:s]  9  Library (in-app)
System states: Loading · Lock screen (passcode) · Storage unavailable (recovery)
```

## Core flows

**First run:** Landing → Start → privacy promise → goal → dates and lengths (or "not sure") → optional passcode and discreet notifications → saved locally → Plans ("Your first prediction is ready") → purchase or restore → Home.

**Tour:** Landing → Take the tour → synthetic data in memory → full app with banner → Exit tour → Landing. Nothing written to storage.

**Daily:** Home → log tiles (Period, Symptoms, Mood, Sleep open that section of Log) or quick chips, or Log (+) → optional sections → Done. The saved bar counts today's entries. Autosaves on every tap (debounced 250 ms).

**Heads up:** when a pre-period symptom pattern exists (≥3 cycles, ≥60%), Today shows "Bloating usually starts in about N days" from the pattern's median lead time, with its evidence strip. Hidden during a period, when late, or more than a week early.

**Check-in:** on the expected day, a reminder asks whether the period started. On iOS and Android it carries quick replies (Yes, today · Spotting · Not yet) that log today directly, after unlock if a passcode is set. Discreet wording by default.

**History:** onboarding offers up to two earlier period starts; You → Add past periods takes up to three more. Starts within 15 days of a known one are ignored.

**Sharing:** You → Partner sharing → choose countdown, phase and (if fertility estimates are on) fertile window → share sheet or clipboard. Calendar file (.ics) of upcoming windows, titled only "Ondessa" when discreet wording is on. Nothing is sent by Ondessa.

**Recap:** Insights → Last cycle recap: length, period, days logged and the prediction recomputed as of the day before the period, scored against the actual start. Symptoms are off by default.

**Pregnancy:** Settings life stage, or You → Pregnancy → clinician due date or LMP → Pregnancy mode. Cycle reminders pause and history is kept. End mode → archived to `pastPregnancies`.

**Delete:** Privacy center → type DELETE → database, keys and caches removed → re-check → `/deleted` with verified status.

## Navigation

Mobile: bottom tab bar (Today, Calendar, raised Log button, Insights, You). At 960 px and wider it becomes a left sidebar with the same five items. Screens opened from You (settings, privacy, membership, sharing, recap, history, pregnancy, fertility, library) keep the You tab selected.

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

## v2 core-loop revisions (2026-10-22)

| Finding | Change |
|---|---|
| Logging was one card among many on Today | Four log tiles open the matching Log section and show what's done today |
| Patterns only looked backwards | Heads-up card turns a pre-period pattern into a countdown, with its evidence |
| Pattern cards were paragraphs | Evidence strips (hits of cycles), stats row (typical cycle, period, spread), details behind a tap |
| New users waited 3 cycles for value | Earlier period dates in onboarding and an Add past periods screen; Insights says how many cycles remain |
| Symptom chips in fixed order | Symptoms logged at this cycle point in ≥2 earlier cycles come first, marked; then most-logged |
| No saved confirmation on Log | Sticky saved bar with today's entry count |
| "More" was a junk drawer | You tab: membership and privacy status up top, grouped menu |
| No reason to come back each cycle | Cycle recap with an honest accuracy score (prediction recomputed from the logs that existed then) |
| No growth loop that fits a no-server app | Partner sharing via the share sheet and a discreet calendar file |
| Dark mode only followed the OS | Appearance: Auto, Light, Dark |
| Paywall didn't explain a store trial | When the store offers an introductory free trial, Plans shows the trial timeline and Ondessa schedules a local reminder 2 days before it ends |
