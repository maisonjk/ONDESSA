# Prediction Engine Specification

Code: `src/engine` (pure TypeScript, no I/O). Thresholds: `src/engine/rules.ts` (`RULES.version = 2026.10-provisional`). **All thresholds are pending clinical sign-off.** Changing one means a version bump, a changelog entry, and updated tests.

## 1. Periods and cycles

1. Bleeding days are logs with `flow` other than `spotting`. Spotting never starts or extends a period.
2. Consecutive bleeding days with at most a 1-day unlogged gap form one period.
3. A cycle runs from one period start to the next. Cycles under 15 or over 90 days are shown but **excluded** from prediction (usually a missed log). The user is told how many were excluded.
4. Logs dated after today are ignored.

## 2. Next period

| Usable cycles (n) | Predicted length | Source |
|---|---|---|
| 0 | user's typical length | settings |
| 1–2 | round((Σ recent + typical × (3−n)) / 3) | blended |
| 3 or more | round(median of last 6) | history |

Expected date = last period start + predicted length. Window = expected ± half-width. The window never starts before the day after the current period ends.

## 3. Confidence levels

| Level | Rule | Base half-width |
|---|---|---|
| Limited data | n < 3 | ±3 days |
| Developing pattern | n ≥ 3, and (n < 6 or range of last 6 > 7 days) | ±2 days |
| Established personal pattern | n ≥ 6 and range of last 6 ≤ 7 days | ±1 day |

**Irregular flag:** n ≥ 3 and range > 7 days. Half-width becomes max(base, min(7, ⌈range/2⌉)). Irregular users never reach "established", so the label never overstates certainty.

Rationale: FIGO 2018 (Munro et al.) defines normal frequency as 24–38 days and regularity as shortest-to-longest variation ≤7–9 days. We use the stricter 7.

Later projected cycles widen by 1 day per cycle ahead.

## 4. Ovulation and fertile window

Priority order:

1. **LH:** first positive test this cycle → ovulation ≈ LH + 1 (range LH to LH + 2). Copy states a positive test does not confirm ovulation.
2. **BBT:** "3-over-6" shift (three consecutive readings ≥ 0.2 °C above the highest of the previous six) → ovulation ≈ day before the shift (retrospective). Copy names confounders.
3. **Calendar:** ovulation ≈ next expected period − 14. Range uses a 12–16 day luteal phase against the period window.

Fertile window = ovulation − 5 to ovulation + 1 (Wilcox 1995), never before the current cycle's day 1. A "widest" window from the ranges is shown on the Fertility screen.

## 5. Late periods

`daysPastExpected` counts days past the expected date. Copy says "past the expected date" rather than "missed" or "late". In conceive mode it adds that a home test is most reliable from now. A 90-day gap produces a gentle care insight.

## 6. Pregnancy dating

EDD = LMP + 280 + (cycleLength − 28), adjusting only when the cycle length is 24–38. A clinician date always wins. Gestational age = 280 − (EDD − today). Trimesters start at weeks 0, 14 and 28.

## 7. Invariants (tested)

Deterministic: same input gives same output. Logged data always overrides predictions on the calendar. No insight without basis and limitation text. Discreet notification text never contains period, fertility, ovulation or pregnancy words. Leap days, year boundaries and DST in four time zones are all covered.

## 8. Tests

`src/engine/*.test.ts`: 35 engine tests covering empty history, single period, blended, developing, established, irregular, excluded outliers, late, fertile-window clamp, LH override, BBT positive/negative, leap-day period, future logs, confidence thresholds, calendar classification, patterns (positive, sub-threshold, trend, 90-day), pregnancy dating and boundaries, mode transition, and discreet reminders.
