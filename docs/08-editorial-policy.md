# Editorial and Clinical Review Policy

1. **Source standard.** Only primary guidance from national health bodies (NHS, CDC, NICHD), professional societies (ACOG, ASRM, FIGO, The Menopause Society, RCOG) or peer-reviewed research. Every article lists its sources in the app.
2. **Drafting.** Engineers or writers may draft. AI tools may assist drafting, but nothing is published unreviewed, and no content is generated at runtime.
3. **Review.** Each article and each threshold in `src/engine/rules.ts` needs sign-off from a licensed clinician in the relevant specialty (OB-GYN, reproductive endocrinology, or certified midwife for pregnancy content). The review records reviewer name, credentials and date in `src/content/library.ts` (`review.status = 'reviewed'`), and the UI displays it.
4. **Cadence.** Re-review every 12 months, or within 30 days of a guideline change.
5. **Scope.** General education only. No personalised advice, dosing or diagnosis. Every article ends with a "talk to a professional" note.
6. **Launch gate.** No article may ship to production with `awaiting-clinical-review` once the app leaves beta. Enforce this with a release-build check before Phase 7 sign-off.
