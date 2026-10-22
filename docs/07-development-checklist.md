# Development Checklist and Phase Report

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Spec, brand, threat model, architecture | ✅ Done (docs 01–06) |
| 2 | UI prototype on synthetic data | ✅ Done (product tour) |
| 3 | Local-first calendar, logging, deterministic engine | ✅ Done |
| 4 | Fertility, patterns, pregnancy mode, library | ✅ Done. Content is **draft, awaiting clinical review** |
| 5 | Privacy controls, export, delete, a11y basics, tests | ✅ Done. Formal a11y audit pending |
| 6 | Paid subscription and entitlement verification | 🟡 Client verification done. Checkout server not built |
| 7 | Security, medical, legal review, usability, launch | ⬜ Not started |

## What works today

All 13 screens, plus lock, recovery and tour states. On-device prediction with three confidence levels and explanations. LH and BBT refinement. Six insight templates. Pregnancy mode with appointments. Passcode encryption (AES-GCM). Plain and encrypted backup and restore. Verified deletion. Discreet reminders. Offline PWA. Strict CSP. 54 unit tests in 4 time zones. End-to-end browser run confirmed the full flow, ciphertext-only storage when locked, zero external requests and zero console errors.

## What's incomplete

1. **Checkout and entitlement server** (ADR-0003). Buttons are disabled in production builds. A preview pass exists only when `VITE_PREVIEW_PASS=true`.
2. **Scheduled notifications.** Web shows reminders in-app and on open. Native (Capacitor) is required for true scheduled local notifications.
3. **Clinical review** of every article, the pregnancy week notes, and every threshold in `rules.ts`.
4. **Accessibility audit** (WCAG 2.2 AA) with screen readers on iOS VoiceOver and Android TalkBack.
5. Pre-rendered SEO pages for the public library.
6. Localisation (copy is US English; dates are formatted in English).

## Estimated running cost

| Item | Now | At 10k subs |
|---|---|---|
| Static hosting and CDN (Cloudflare Pages / Netlify) | $0 | $0–20/mo |
| Entitlement function plus KV | n/a | $5–10/mo |
| Domain | ~$15/yr | ~$15/yr |
| AI / analytics / DB | $0 | $0 |
| Payment fees | n/a | ~3% web (Stripe) or 15–30% stores |

## Critical concerns before launch

1. **Legal:** FTC Health Breach Notification Rule, WA MHMDA, CA/CT/NV health-data laws, GDPR special-category data (EU), auto-renewal laws (CA ARL, FTC click-to-cancel), and app-store subscription rules. Counsel must approve terms, privacy policy, refund policy and all health claims.
2. **Regulatory:** keep claims wellness and education only. Fertility or contraception claims can turn the product into a medical device (FDA / EU MDR). Copy currently disclaims contraception everywhere.
3. **IP:** trademark clearance for "Ondessa". A freedom-to-operate review for cycle-prediction patents. OSS license inventory (`npm run licenses`).
4. **Security:** independent review of the crypto usage and entitlement server. PIN entropy limits (ADR-0005).
5. **Data loss:** the biggest user-harm risk of local-first. Consider a backup nudge after 30 days of logs.

## Definition of done tracker

- [x] Personalized tracking works without an account
- [x] Cycle calculations pass automated tests
- [x] Health data stays on-device by default
- [x] No third-party analytics or AI receives health data (enforced by test and CSP)
- [ ] Subscription purchase, restore, cancel and entitlement work end to end
- [x] Export and permanent deletion of local records
- [ ] Tested on supported devices (iOS Safari 17+, Android Chrome, desktop Chrome/Safari/Firefox)
- [ ] Clinician-reviewed educational content (drafts present, marked as such)
- [x] Privacy disclosures reflect the code (guard tests)
- [ ] Security review with critical issues resolved
- [ ] Legal and IP reviews complete
