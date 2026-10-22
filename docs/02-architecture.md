# Architecture Decision Records

## ADR-0001: Local-first PWA for launch

**Status:** accepted · 2026-10-22

**Context.** The brief requires on-device storage, deterministic local predictions, no mandatory account, near-zero infrastructure cost, and mobile priority.

**Decision.** Ship v1 as an installable PWA: Vite, React 19 and TypeScript (strict), static hosting behind a CDN. No backend for health data. All health data lives in one IndexedDB record per device.

**Why not Next.js?** Every screen renders on the client from local data. SSR adds a server runtime and a larger attack surface without benefit. Public SEO pages (library, landing) can be pre-rendered statically later with the same components.

**Consequences.**

| Gain | Cost |
|---|---|
| $0 server cost for health data, nothing to breach centrally | Data loss if device or browser storage is lost without a backup |
| One codebase for mobile web and desktop | Web cannot schedule background notifications. Reminders show in-app and as a notification on open |
| Instant updates, no store review for web | iOS may evict PWA storage after long inactivity. Mitigated with `navigator.storage.persist()` and backup prompts |

**Native path (Phase 6b).** Wrap the same app in Capacitor for iOS and Android when scheduled local notifications, store distribution and StoreKit/Play Billing are needed. Use SQLite or the platform keystore for storage, and native local-notifications APIs. The engine (`src/engine`) is pure TypeScript with no DOM dependencies, so it ports unchanged.

## ADR-0002: Calendar dates as strings, day-number arithmetic

**Decision.** Every health date is an ISO calendar date string (`YYYY-MM-DD`). Arithmetic converts to integer day numbers with `Date.UTC`. Device time enters the system in exactly one function (`localToday`).

**Why.** Timestamps shift across time zones and DST and produce off-by-one period dates. Tests run in UTC, America/Los_Angeles, Pacific/Auckland and Australia/Lord_Howe (30-minute DST) via `npm run test:tz`.

## ADR-0003: Privacy-preserving entitlements

**Decision.** A purchase produces a signed **membership key**: `base64url(payload).base64url(ECDSA-P256-SHA256 signature)`, with payload `{v, eid, plan, iat, exp}`. `eid` is random and unlinked to health data. The app verifies the key locally with an embedded public key (`VITE_ENTITLEMENT_PUBLIC_JWK`). A 3-day grace period covers renewals.

**Server (Phase 6, not built yet).** One serverless function (Cloudflare Workers or Vercel) with KV storage:

| Endpoint | Purpose | Abuse controls |
|---|---|---|
| `POST /checkout` | Create Stripe Checkout session | Rate limit by IP, idempotency key |
| `POST /webhook` | Stripe events, then issue or extend `eid` | Stripe signature verification, event-id dedupe |
| `POST /claim` | One-time claim code to membership key | Single use, 15-min expiry, rate limit |
| `POST /refresh` | Old key to renewed key | Checks subscription status; replay-safe because keys are idempotent per period |

The server stores `eid`, Stripe customer ID, plan and status, and never health data. **Double-charge prevention:** checkout looks up the active subscription for the email Stripe collects, and redirects to restore instead of charging. On iOS and Android, use StoreKit 2 and Play Billing, with their receipts verified by the same function. Platform rules on external payment links must be re-verified before release.

**Network allow-list.** `src/privacy.test.ts` fails the build if any file other than an allow-listed entitlement module makes network calls.

## ADR-0004: No generative AI on personal data

**Decision.** Predictions and insights are deterministic rules plus prewritten templates. No LLM calls in the product path. Any future AI feature (for example a library Q&A) must use public content only, run on-device or receive no personal data, and requires a new ADR plus privacy review.

## ADR-0005: Optional passcode encryption at rest

**Decision.** When a passcode is set, the stored record is an AES-256-GCM envelope with a key from PBKDF2-SHA256 (600k iterations, 16-byte salt, fresh 12-byte IV per save). Without a passcode, data is stored as plain JSON in IndexedDB, protected only by the OS and browser sandbox. The UI states this.

**Known limits.** A 4–8 digit PIN has low entropy. An attacker with the raw IndexedDB file can brute-force it offline (10^8 × 600k PBKDF2 is costly but feasible for a determined attacker with GPUs). The control deters casual access by someone holding an unlocked phone. It does not stop forensic attackers. Native builds should move key material into the Secure Enclave or Android Keystore with biometric gating.

## System diagram

```
┌──────────────────────── Device ────────────────────────┐
│  UI (React) ──► Store ──► Engine (pure TS, tested)     │
│                   │                                    │
│                   ▼                                    │
│        Vault (IndexedDB, optional AES-GCM)             │
│        Backup (file export/import, optional AES-GCM)   │
│        Entitlement key (localStorage, signed, no PHI)  │
└──────────────────────┬─────────────────────────────────┘
                       │ static files only (today)
              ┌────────▼────────┐        ┌──────────────────────┐
              │ CDN / static    │        │ Entitlement fn (P6)  │
              │ host + _headers │        │ Stripe / StoreKit    │
              └─────────────────┘        └──────────────────────┘
```
