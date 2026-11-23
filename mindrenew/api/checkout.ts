import Stripe from 'stripe';
import { json, error, env } from './_lib/http.js';
import { getAdmin, userFromRequest } from './_lib/supabase-admin.js';

/** POST /api/checkout { interval: 'monthly' | 'annual' } -> { url } (Stripe Checkout). */
export async function POST(req: Request): Promise<Response> {
  const secret = env('STRIPE_SECRET_KEY');
  if (!secret || !getAdmin()) return error(503, 'billing_unconfigured', 'Billing isn’t set up yet. Add Stripe and Supabase keys to enable subscriptions.');
  const user = await userFromRequest(req);
  if (!user) return error(401, 'auth_required', 'Sign in to subscribe.');

  const { interval } = (await req.json().catch(() => ({}))) as { interval?: string };
  const price = interval === 'annual' ? env('STRIPE_PRICE_ANNUAL') : env('STRIPE_PRICE_MONTHLY');
  if (!price) return error(503, 'billing_unconfigured', 'Price not configured.');

  const stripe = new Stripe(secret);
  const admin = getAdmin()!;
  const { data: sub } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  const appUrl = env('APP_URL') ?? new URL(req.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    customer: sub?.stripe_customer_id ?? undefined,
    customer_email: sub?.stripe_customer_id ? undefined : user.email,
    subscription_data: { metadata: { user_id: user.id }, trial_period_days: 7 },
    allow_promotion_codes: true,
    success_url: `${appUrl}/?checkout=success`,
    cancel_url: `${appUrl}/?checkout=cancel`,
  });
  return json({ url: session.url });
}
