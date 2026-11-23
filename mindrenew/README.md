# MindRenew

**Think Truth. Live Free.** A Bible-based mind renewal app: recognize the lie, find what God says, renew your mind, live it out. 3 to 5 minutes a day.

> Built on Romans 12:2, 2 Corinthians 10:5 and John 8:32.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, works fully in local mode with zero config
npm test           # 33 unit + handler tests
npm run build      # typecheck + production build
```

With no env vars the app runs in **local mode**: everything works, data lives in the browser, accounts and billing are off, and Truth Companion answers from the curated library. Add keys (below) to turn on the cloud.

## What's in the MVP

| Feature | Free | Premium |
| --- | --- | --- |
| Daily Renewal (5-step loop) | 1 per day | Unlimited |
| Daily Truth + weekly theme | ✓ | ✓ |
| Truth Library | 15 truths | Unlimited + browse all 39 lie/truth pairs |
| Truth Companion (AI) | 3 per week | 60 per week |
| Progress: streak, heatmap, patterns, weekly summary | ✓ | ✓ |
| Insights: truths you return to, focus shifts | | ✓ |
| Guided 7-day journeys (Identity, Anxiety, Shame) | | ✓ |

Pricing: **$7.99/mo** or **$59.99/yr** (37% off), both with a 7-day trial. God's Word is never paywalled.

## How the economics work

The standard daily experience makes **zero AI calls**. A curated database of 39 thought patterns maps each lie to a verse, reframe, reflection prompt and action. Free-text thoughts are matched on-device by keyword stems.

AI is only used when someone opens Truth Companion, and every call is squeezed:

1. Crisis language short-circuits to 988 resources before any model call.
2. Weekly limits are enforced server-side from the `ai_usage` table.
3. Identical inputs hit `ai_cache` (30 days) at $0.
4. One stateless call: frozen system prompt with 1h prompt caching, no history, effort `low`, structured JSON output.
5. Any failure (no key, bad output, API error) falls back to the free library answer and doesn't charge the user's quota.
6. Every call logs tokens and USD cost. `metrics_ai_cost` gives AI cost per active subscriber by month.

**Model choice is yours.** Default is `claude-opus-5-5` ($4/$20 per M tokens). Set `COMPANION_MODEL=claude-haiku-5-5` for ~40x cheaper calls; the task is narrow enough that it's worth an A/B. Server-side refusal fallback is enabled on Opus/Sonnet.

## Scripture integrity

The AI **never writes verse text**. It returns verse IDs from a 56-verse catalog; the server drops unknown IDs and renders text from `src/content/scripture.ts`. Scripture and AI reflection are labeled separately in the UI.

Translation is the **World English Bible** (public domain): no licensing fee, no API dependency.

⚠️ **Launch blocker:** verse text was entered by hand. Run `npm run verify:scripture` on a machine with internet access; it checks every verse against bible-api.com's WEB text and exits non-zero on any mismatch. Fix anything it flags before shipping.

## Turn on the cloud

1. **Supabase**: create a project, run `supabase/migrations/0001_init.sql`, enable Email (magic link) auth, set the Site URL.
2. **Stripe**: create two recurring prices ($7.99/mo, $59.99/yr), add a webhook to `/api/stripe-webhook` for `checkout.session.completed` and `customer.subscription.created|updated|deleted`.
3. **Anthropic**: create an API key.
4. Set env vars from `.env.example` in Vercel (server keys never get a `VITE_` prefix) and deploy from this folder (`vercel --cwd mindrenew` or set Root Directory to `mindrenew`).

Premium status is written **only** by the Stripe webhook, so it can't be granted from the client. RLS limits every table to its owner.

## Analytics

First-party events go to the `events` table (anonymous device id before signup, user id after). Views in the migration:

`metrics_daily` (DAU, onboardings, first renewals, saves, new subs, churn) · `metrics_d1_retention` · `metrics_weekly_habit` (users with 3+ renewal days/week, the north-star) · `metrics_conversion` · `metrics_ai_cost`.

## Layout

```
src/content/   Scripture (WEB), lie->truth map, daily truths, journeys
src/lib/       Store (local-first + Supabase sync), matcher, stats, entitlements, analytics
src/screens/   Onboarding, Home, Renewal, Library, Companion, Progress, Journeys, Settings
src/ui/        Design kit, paywall, auth, crisis card
api/           Vercel functions: companion, checkout, portal, stripe-webhook
supabase/      Schema, RLS, metrics views
scripts/       Scripture verifier, browser walkthrough (npm run shots)
```

## Known gaps (next sprint)

1. **Push reminders.** Web reminders fire while the app is open/installed; prefs are stored in `profiles.reminder`. Real background push needs a Capacitor wrapper or web push + a cron. The parent repo already has the Capacitor setup to copy.
2. **Weekly summary email.** Computed in-app today; needs a scheduled job + email provider.
3. **Content depth.** 39 patterns / 56 verses is enough to validate retention. Add a pastor or theologian review before launch.
4. **Legal.** Privacy policy, terms, and a trademark search on "MindRenew".

## Safety

Crisis language (self-harm, suicide) is detected on-device and server-side and routes to 988 before anything else. MindRenew is a spiritual growth tool, not mental health care, and says so in-app.
