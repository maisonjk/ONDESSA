import { isNative, platform } from './index';

/**
 * Subscriptions through Apple In-App Purchase and Google Play Billing (cordova-plugin-purchase).
 * Required for the store builds: digital subscriptions sold inside an iOS or Android app
 * must use the platform's billing. No account, email or health data is involved; the
 * stores identify the purchase by the device's store account.
 *
 * Before launch (see docs/09-app-store-readiness.md): enable the StoreKit 2 extension,
 * add server receipt validation so expiry and refunds are enforced, and test every path
 * in the App Store sandbox and Play test tracks.
 */
export type StorePlan = 'monthly' | 'annual';

export const PRODUCT_IDS: Record<StorePlan, string> = {
  annual: 'ondessa.membership.annual',
  monthly: 'ondessa.membership.monthly',
};

export interface StoreProduct {
  plan: StorePlan;
  /** Localised price string from the store, e.g. "$59.99". */
  price: string;
  /** Introductory free trial configured in App Store Connect / Play Console, if offered. */
  trial?: { days: number; label: string };
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'unavailable' | 'error';

// Minimal typing for the subset of the plugin's global API used here.
interface CdvPhase { paymentMode?: string; billingPeriod?: string }
interface CdvOffer { id: string; pricingPhases?: CdvPhase[] }
interface CdvProduct {
  id: string;
  pricing?: { price: string };
  offers?: CdvOffer[];
  getOffer(id?: string): CdvOffer | undefined;
}
interface CdvError { code: number; message: string }
interface CdvStore {
  register(p: { id: string; type: string; platform: string }[]): void;
  initialize(platforms: string[]): Promise<CdvError[]>;
  when(): { approved(cb: (t: { finish(): Promise<void> }) => void): unknown; productUpdated(cb: () => void): unknown };
  get(id: string, platform?: string): CdvProduct | undefined;
  owned(id: string): boolean;
  order(offer: CdvOffer): Promise<CdvError | undefined>;
  restorePurchases(): Promise<CdvError | undefined>;
  manageSubscriptions(platform?: string): Promise<CdvError | undefined>;
}
interface CdvGlobal {
  store: CdvStore;
  ProductType: { PAID_SUBSCRIPTION: string };
  Platform: { APPLE_APPSTORE: string; GOOGLE_PLAY: string };
  ErrorCode: { PAYMENT_CANCELLED: number };
}

declare global {
  interface Window {
    CdvPurchase?: CdvGlobal;
  }
}

let ready: Promise<CdvGlobal | undefined> | undefined;
const listeners = new Set<() => void>();

function deviceReady(): Promise<void> {
  return new Promise((resolve) => {
    if (window.CdvPurchase) return resolve();
    document.addEventListener('deviceready', () => resolve(), { once: true });
    setTimeout(resolve, 5000); // never hang the paywall
  });
}

function storePlatform(C: CdvGlobal): string {
  return platform === 'android' ? C.Platform.GOOGLE_PLAY : C.Platform.APPLE_APPSTORE;
}

async function api(): Promise<CdvGlobal | undefined> {
  if (!isNative) return undefined;
  ready ??= (async () => {
    await deviceReady();
    const C = window.CdvPurchase;
    if (!C) return undefined;
    const p = storePlatform(C);
    C.store.register(Object.values(PRODUCT_IDS).map((id) => ({ id, type: C.ProductType.PAID_SUBSCRIPTION, platform: p })));
    C.store.when().approved((t) => void t.finish());
    C.store.when().productUpdated(() => listeners.forEach((l) => l()));
    await C.store.initialize([p]);
    return C;
  })();
  return ready;
}

/** Products with store-localised prices. Empty when billing is unavailable. */
export async function loadProducts(): Promise<StoreProduct[]> {
  const C = await api();
  if (!C) return [];
  return (Object.keys(PRODUCT_IDS) as StorePlan[]).flatMap((plan) => {
    const p = C.store.get(PRODUCT_IDS[plan], storePlatform(C));
    if (!p?.pricing) return [];
    const phase = p.offers?.flatMap((o) => o.pricingPhases ?? []).find((ph) => ph.paymentMode === 'FreeTrial');
    const trial = phase?.billingPeriod ? parseTrial(phase.billingPeriod) : undefined;
    return [{ plan, price: p.pricing.price, ...(trial ? { trial } : {}) }];
  });
}

/** ISO 8601 period ("P14D", "P1W", "P1M") to a day count and a readable label. */
export function parseTrial(period: string): { days: number; label: string } | undefined {
  const m = /^P(\d+)([DWMY])$/.exec(period);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = m[2] as 'D' | 'W' | 'M' | 'Y';
  const days = n * { D: 1, W: 7, M: 30, Y: 365 }[unit];
  const word = { D: 'day', W: 'week', M: 'month', Y: 'year' }[unit];
  const label = unit === 'W' && n * 7 <= 28 ? `${n * 7} days` : `${n} ${word}${n === 1 ? '' : 's'}`;
  return days > 0 ? { days, label } : undefined;
}

/** The plan this device's store account currently owns, if any. */
export async function ownedPlan(): Promise<StorePlan | undefined> {
  const C = await api();
  if (!C) return undefined;
  return (Object.keys(PRODUCT_IDS) as StorePlan[]).find((plan) => C.store.owned(PRODUCT_IDS[plan]));
}

export function onStoreChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function purchase(plan: StorePlan): Promise<PurchaseResult> {
  const C = await api();
  if (!C) return 'unavailable';
  // Never charge twice for the same membership.
  if (await ownedPlan()) return 'purchased';
  const offer = C.store.get(PRODUCT_IDS[plan], storePlatform(C))?.getOffer();
  if (!offer) return 'unavailable';
  const err = await C.store.order(offer);
  if (!err) return 'purchased';
  return err.code === C.ErrorCode.PAYMENT_CANCELLED ? 'cancelled' : 'error';
}

export async function restorePurchases(): Promise<StorePlan | undefined> {
  const C = await api();
  if (!C) return undefined;
  await C.store.restorePurchases();
  return ownedPlan();
}

export async function manageSubscription(): Promise<void> {
  const C = await api();
  if (C) await C.store.manageSubscriptions(storePlatform(C));
}
