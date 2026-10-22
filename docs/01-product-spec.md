# Ondessa: Product Specification

> Working name **Ondessa** (from French *onde*, "wave"). It replaces the brief's placeholder "Luma Cycle". A web check on 2026-10-22 found no App Store app, brand or trademark using the name. **It still needs a formal trademark search (USPTO, EUIPO, WIPO), domain and handle checks, and App Store/Play Store name reservation before any spend.** Backup name: **Innerkin**.

## Positioning

**One line:** A private, paid cycle and pregnancy companion that explains every prediction and learns your own patterns, without uploading your body to anyone's server.

| | Typical incumbent | Ondessa |
|---|---|---|
| Business model | Freemium plus ads/data partnerships | Paid only, no free tier |
| Data location | Cloud account by default | On-device by default, no account |
| Predictions | Opaque, often presented as fact | Deterministic, explained, with 3 confidence levels |
| Content | Endless feed and daily push | Small reviewed library, a few useful reminders |
| AI | Chatbots fed with health data | None on personal data |

**Wedge customer:** US women aged 25–40 who stopped trusting free period apps after 2022 (Dobbs), are tracking to conceive or just understand their cycle, and already pay for premium wellness subscriptions.

## Product pillars

1. **Cycle Intelligence.** Calendar, predicted period window, fertile window, symptom/mood/energy/sleep/pain logging, history, explained predictions.
2. **Pregnancy Planning.** Optional mucus, BBT and LH logging (off unless the goal is conceiving). Intimacy logging is off by default. Test-date reminder. Explicit "cannot confirm" language on every fertility surface.
3. **Pregnancy Calendar.** Opt-in mode. Due date from LMP (Naegele, cycle-adjusted) or from a clinician date, which always wins. Week-by-week notes, appointments, journal, "when to call" guidance.
4. **Life-Stage Insights.** Perimenopause goal, irregular-cycle handling (wider windows, never "established"), and life stage the user can change at any time.

## Signature feature: My Cycle, My Patterns

Template-based observations computed only from logged data (`src/engine/patterns.ts`). Each insight carries **title, body, basis (the exact data used) and limitation**. No insight claims a cause. Current templates:

| Insight | Fires when |
|---|---|
| Limited history | Fewer than 3 usable cycles |
| Cycle-length trend | 6 or more cycles and the last 3 differ from earlier ones by at least 3 days on average |
| Pre-period symptom | Symptom logged in the 5 days before a period in at least 3 cycles and at least 60% of the last 6 |
| Variation | 3 or more cycles; flags "irregular" when range exceeds 7 days |
| Outside typical range | 2 of the last 3 cycles fall outside 24–38 days; gentle "consider discussing" copy |
| No period in 90 days | Gentle care note with the common exceptions listed |

## Non-goals for v1

No account or sync, no community, no AI chat, no video, no partner sharing, no wearables integration, no contraception claims, no clinical decision support.

## Monetization

| Plan | Price (hypothesis) | Notes |
|---|---|---|
| Monthly | $8.99 | |
| Annual | $59.99 | about $5.00/mo, 44% below monthly. Default selection |
| Lifetime | not offered | Revisit after 12-month retention data |

**Free surface (not a tier):** landing page, public library, and a product tour on synthetic data that saves nothing. Setup data is saved locally before the paywall so the "your first prediction is ready" moment is real, but personalized screens stay locked until a purchase.

**Unit economics target:** infrastructure under $50/mo up to about 50k subscribers (static hosting plus one small entitlement function). Margin is driven by store fees (15% under small-business programs) and payment processing, not by servers.

**Experiments to run before scale:** annual vs monthly default; a 7-day trial vs a 14-day refund guarantee (the MVP ships the refund guarantee, no trial); price points of $6.99/$7.99/$8.99 monthly.

## Success metrics (no vanity metrics)

| Metric | Target to validate |
|---|---|
| Tour to paid conversion | 4% or more |
| Day-30 logging retention (on-device, never reported) | Measured only through opt-in surveys |
| Month-2 subscription retention | 70% or more monthly, 85% or more annual cohort |
| Refund rate | Under 5% |
| Paid CAC payback | Under 3 months |

Because there is no analytics SDK, product metrics come from store/billing data (conversion, churn, refunds) and opt-in surveys. That is a deliberate trade-off.
