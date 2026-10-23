/**
 * RevenueCat public SDK keys (Project settings → API keys → App-specific keys).
 * These are public keys and safe to ship in the app. Never put a secret key (sk_...) here.
 * `npm run release:check` fails while the Apple key is empty.
 */
export const REVENUECAT_KEYS = {
  /** Starts with "appl_". */
  apple: '',
  /** Starts with "goog_". Leave empty until the Android app is set up. */
  google: '',
};

/** The RevenueCat entitlement both subscriptions unlock. Create it with exactly this identifier. */
export const ENTITLEMENT_ID = 'membership';
