# Privacy Threat Model (v1, local-first web)

**Assets:** period dates, fertility signs, intimacy logs, pregnancy status and dates, symptoms, notes, and the fact that a person uses a reproductive health app at all.

**Method:** STRIDE-lite per adversary, scoped to what v1 actually ships.

| # | Adversary | Scenario | Mitigation in v1 | Residual risk |
|---|---|---|---|---|
| T1 | Ondessa itself / subpoena | Legal demand for a user's reproductive data | No health data on any server. Nothing to produce | Billing records show a person subscribed. Server-side minimisation required in Phase 6 |
| T2 | Ad / analytics networks | SDK leakage of health events | No SDKs. CSP `connect-src 'self'`. Build-failing guard test | A future dependency could add network code. Guarded by CSP plus test |
| T3 | Network observer | Infers status from traffic | Only static file loads. No health-specific endpoints | Visiting the domain reveals app use. HSTS and no-referrer headers |
| T4 | Someone with the unlocked phone | Opens the app and reads data | Optional passcode with encryption. Discreet notifications on by default | No passcode means readable. Shown clearly in the Privacy center |
| T5 | Forensic access to device storage | Extracts IndexedDB | AES-GCM when locked | Short PINs are brute-forceable offline (see ADR-0005) |
| T6 | Notification snooping (lock screen, smartwatch) | Reads "Your period starts tomorrow" | Discreet wording default. Local-only notifications, no push payloads | Non-discreet mode is the user's choice |
| T7 | Malicious backup file | Import injects bad data or script | Strict schema sanitizer drops unknown fields. React escapes all text. Size cap | Low |
| T8 | Supply chain | Compromised npm dependency | 4 runtime deps (react, react-dom, 2 font packages). `npm audit` in CI. Lockfile pinned | Build-tool deps remain a risk. Add provenance checks |
| T9 | XSS | Script exfiltrates data | No `dangerouslySetInnerHTML`. Strict CSP with no inline script. `form-action 'none'` | Low |
| T10 | Shared links / history | URL reveals state | Routes carry screen names only. Guard test forbids query params | Low |
| T11 | Data loss | Browser evicts storage, device lost | `storage.persist()`, encrypted backup, onboarding warning | Real. Users must keep backups |
| T12 | Entitlement fraud | Forged or replayed keys | ECDSA signature, expiry, grace cap | A shared key works on many devices. Acceptable at launch; add soft device limits in P6 |

## Explicit non-claims

Ondessa does not claim to be breach-proof, anonymous, HIPAA-compliant, or certified. HIPAA generally does not apply to direct-to-consumer apps, but the FTC Health Breach Notification Rule and state laws (for example Washington's My Health My Data Act, California CMIA and CCPA/CPRA, Connecticut and Nevada consumer health data laws) likely do. **Counsel must confirm.**

## Logging policy

Application code never calls `console.*` (enforced by test). The static host keeps standard access logs with IP, path (screen names only, since hash routes never reach the server) and user agent. Retention should be set to the minimum the host allows.
