/**
 * Every threshold the engine uses, in one place, so they can be audited and changed without
 * reading algorithm code. Values are defaults chosen from the cited literature. Predictions
 * are estimates for general information, never medical advice. See
 * docs/06-prediction-engine.md for the rationale behind each value.
 */
export const RULES = {
  version: '2026.10',

  /** Unlogged days allowed inside one period before a new period is assumed.  */
  periodGapTolerance: 2,
  /**
   * Bleeding that starts within this many days of a period's first day belongs to that
   * period: a new cycle cannot plausibly begin that soon, so it is a missed log. 
   */
  periodMergeWindow: 10,

  /** Cycles outside this range are shown but excluded from predictions.  */
  plausibleCycle: { min: 15, max: 90 },

  /** FIGO 2018 normal frequency for adults, used only for gentle "talk to a doctor" notes. */
  typicalCycleRange: { min: 24, max: 38 },

  /** How many recent usable cycles feed the prediction. */
  predictionWindow: 6,

  /** Confidence levels. */
  confidence: {
    developingMinCycles: 3,
    establishedMinCycles: 6,
    /** FIGO 2018: shortest-to-longest variation of ≤7–9 days is "regular". Set at 7. */
    regularVariationDays: 7,
  },

  /** Half-width (days) of the expected-period window, by confidence.  */
  windowHalfWidth: { limited: 3, developing: 2, established: 1 },
  /** Irregular cycles widen the window by half their observed variation, capped. */
  irregularHalfWidthCap: 7,

  /** Luteal phase assumption used for calendar-based ovulation. Typical range 12–16. */
  lutealDays: 14,
  lutealRange: { min: 12, max: 16 },

  /** Fertile window = ovulation − 5 … ovulation + 1 (sperm survival + egg lifespan). */
  fertileBefore: 5,
  fertileAfter: 1,

  /** BBT thermal shift: 3 consecutive temps ≥ this much above the highest of the prior 6. */
  bbtShiftC: 0.2,
  bbtCoverline: 6,

  /** Pregnancy dating (Naegele): EDD = LMP + 280 days, adjusted for cycle length. */
  gestationDays: 280,
  trimesterStartWeeks: [0, 14, 28] as const,

  /** Patterns. */
  patterns: {
    preMenstrualDays: 5,
    minCyclesForSymptomPattern: 3,
    symptomRatio: 0.6,
    trendMinCycles: 6,
    trendDeltaDays: 3,
    missedPeriodDays: 90,
  },
} as const;
