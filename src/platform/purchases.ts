import { isNative, platform } from './index';
import { REVENUECAT_KEYS, ENTITLEMENT_ID } from './billing-config';

/**
 * Subscriptions through Apple In-App Purchase and Google Play Billing, via RevenueCat.
 * RevenueCat validates every receipt with Apple or Google on its servers, so expiry,
 * refunds and family sharing are enforced without a server of our own.
 *
 * Privacy: RevenueCat receives purchase records tied to an anonymous, random app user ID.
 * No name, email or health data is ever sent. Attribution and ad-network integrations
 * stay off, and we never set subscriber attributes.
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
  /** Store price in millionths of the local currency, for comparing plans. */
  priceMicros?: number;
  /** Introductory free trial, shown only when this store account is still eligible. */
  trial?: { days: number; label: string };
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'unavailable' | 'error';

type RC = typeof import('@revenuecat/purchases-capacitor').Purchases;
type RCProduct = import('@revenuecat/purchases-capacitor').PurchasesStoreProduct;
type RCCustomerInfo = import('@revenuecat/purchases-capacitor').CustomerInfo;

const INELIGIBLE = 1; // INTRO_ELIGIBILITY_STATUS_INELIGIBLE
const CANCELLED = '1'; // PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR

let ready: Promise<RC | undefined> | undefined;
const listeners = new Set<() => void>();
const products = new Map<StorePlan, RCProduct>();

function apiKey(): string {
  return platform === 'android' ? REVENUECAT_KEYS.google : REVENUECAT_KEYS.apple;
}

async function api(): Promise<RC | undefined> {
  if (!isNative || !apiKey()) return undefined;
  ready ??= (async () => {
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      await Purchases.configure({ apiKey: apiKey() });
      // Not awaited: this is a callback-style call, and on iOS its promise does not settle
      // until the first update arrives. Awaiting it left the app on a blank loading screen.
      void Purchases.addCustomerInfoUpdateListener(() => listeners.forEach((l) => l())).catch(() => {});
      return Purchases;
    } catch {
      ready = undefined; // allow a retry, e.g. after the network comes back
      return undefined;
    }
  })();
  return ready;
}

function planFor(productId: string): StorePlan | undefined {
  // Google returns "productId:basePlanId"; compare the product part only.
  const id = productId.split(':')[0];
  return (Object.keys(PRODUCT_IDS) as StorePlan[]).find((p) => PRODUCT_IDS[p] === id);
}

function activePlan(info: RCCustomerInfo): StorePlan | undefined {
  const ent = info.entitlements.active[ENTITLEMENT_ID];
  if (ent?.isActive) return planFor(ent.productIdentifier) ?? 'annual';
  return undefined;
}

/** Products with store-localised prices. Empty when billing is unavailable. */
export async function loadProducts(): Promise<StoreProduct[]> {
  const P = await api();
  if (!P) return [];
  try {
    const ids = Object.values(PRODUCT_IDS);
    const { products: list } = await P.getProducts({ productIdentifiers: ids });
    const eligibility = await P.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: ids }).catch(() => ({}) as Record<string, { status: number }>);
    return list.flatMap((p) => {
      const plan = planFor(p.identifier);
      if (!plan) return [];
      products.set(plan, p);
      const intro = p.introPrice;
      const eligible = eligibility[p.identifier]?.status !== INELIGIBLE;
      const trial = intro && intro.price === 0 && eligible ? parseTrial(intro.period) : undefined;
      return [{ plan, price: p.priceString, priceMicros: Math.round(p.price * 1_000_000), ...(trial ? { trial } : {}) }];
    });
  } catch {
    return [];
  }
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

/** The plan this store account currently has an active, validated membership for, if any. */
export async function ownedPlan(): Promise<StorePlan | undefined> {
  const P = await withTimeout(api(), 8000);
  if (!P) return undefined;
  // Never let a slow network or store keep the app on a loading screen.
  const info = await withTimeout(P.getCustomerInfo().then((r) => r.customerInfo), 8000);
  return info ? activePlan(info) : undefined;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);
}

export function onStoreChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function purchase(plan: StorePlan): Promise<PurchaseResult> {
  const P = await api();
  if (!P) return 'unavailable';
  // Never charge twice for the same membership.
  if (await ownedPlan().catch(() => undefined)) return 'purchased';
  if (!products.has(plan)) await loadProducts();
  const product = products.get(plan);
  if (!product) return 'unavailable';
  try {
    const { customerInfo } = await P.purchaseStoreProduct({ product });
    return activePlan(customerInfo) ? 'purchased' : 'error';
  } catch (e) {
    const err = e as { code?: string; userCancelled?: boolean | null };
    return err.userCancelled || err.code === CANCELLED ? 'cancelled' : 'error';
  }
}

export async function restorePurchases(): Promise<StorePlan | undefined> {
  const P = await api();
  if (!P) return undefined;
  try {
    const { customerInfo } = await P.restorePurchases();
    return activePlan(customerInfo);
  } catch {
    return undefined;
  }
}

const MANAGE_URL = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
};

export async function manageSubscription(): Promise<void> {
  const P = await api();
  const info = P ? await P.getCustomerInfo().then((r) => r.customerInfo).catch(() => undefined) : undefined;
  const url = info?.managementURL ?? (platform === 'android' ? MANAGE_URL.android : MANAGE_URL.ios);
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url });
}
