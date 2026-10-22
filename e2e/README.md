# Ondessa end-to-end suite

Plain Node scripts driving the globally installed Playwright (Chromium). No `@playwright/test`.

## Run

```sh
# 1. build a preview build (preview pass enabled) and serve it on :4500
VITE_PREVIEW_PASS=true npx vite build --outDir /tmp/qa-dist
npx vite preview --outDir /tmp/qa-dist --port 4500 --strictPort &

# 2. run everything (exit code 1 on any unexpected failure)
node e2e/run.cjs

# or let the runner build and serve for you
node e2e/run.cjs --serve

# only some tests: any word matched against "file > test name"
node e2e/run.cjs privacy tour
VERBOSE=1 node e2e/run.cjs 04-       # also print errors of known-bug tests
ONDESSA_URL=http://localhost:5173 node e2e/run.cjs
```

The axe tests use the `axe-core` dev dependency (or `AXE_PATH`). `npm run test:e2e` builds, serves and runs everything; CI runs it on every push.

## How it works

- `lib.cjs`: helpers. `open()` creates an isolated browser context that records console
  errors, uncaught errors and every request leaving localhost; `seed()` writes AppData to
  IndexedDB plus a preview entitlement and reloads; `onboard()` walks first-run setup;
  `readVault()` reads the raw IndexedDB record; `axe()`, `smallTargets()` and
  `noHorizontalScroll()` are the a11y and layout checks.
- `run.cjs`: runs `tests/*.cjs` in order. After every test it fails the test if any page
  logged a console error, threw, or requested a non-localhost URL, then closes its contexts.
- A test with `bug: 'BUG-xx'` documents a known defect. Its failure prints `KNOWN` and does
  not fail the run. If it starts passing it prints `FIXED?`: confirm, then remove the tag.

| File | Covers |
|---|---|
| 01-onboarding | 4 goals, "not sure", steppers, passcode on/off, fertile toggle, restore before purchase |
| 02-paywall | gating of every /app route, preview pass, expiry, Membership, garbage restore keys |
| 03-logging | every field, past/future days, clearing, notes, BBT °C/°F/invalid, LH, intimacy |
| 04-predictions | calendar classes vs engine rules, countdown, late, rollover, LH, pregnancy mode |
| 05-privacy | lock/unlock/change/off, lockout, auto-lock, export, import, delete + storage checks |
| 06-tour | sample data, nothing persisted, exit, "Start with my own data", Back-button leak |
| 07-edge | Auckland/LA, DST, midnight, leap day, 15/90-day cycles, 2 years of data, offline, history |
| 08-responsive | 320/390/768/1280 × light/dark: horizontal scroll, off-screen, tab bar overlap |
| 09-a11y | axe WCAG 2.1 AA on every screen, contrast, touch targets, switches, keyboard-only |
| 10-hygiene | full crawl for console errors and external requests, CSP, no dates in URLs |

## Bug history

The QA pass on 2026-10-22 found 13 bugs (BUG-01 to BUG-13) and 3 accessibility issues (A11Y-01 to A11Y-03). All were fixed in the app the same day. Their tests are now ordinary regression tests: if one fails, that bug has come back. New defects can again be tagged with `bug: 'BUG-xx'` while they are open.
