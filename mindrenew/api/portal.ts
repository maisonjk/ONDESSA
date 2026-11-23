import Stripe from 'stripe';
import { json, error, env } from './_lib/http.js';
import { getAdmin, userFromRequest } from './_lib/supabase-admin.js';

/** POST /api/portal -> { url } (Stripe customer portal to manage or cancel). */
export async function POST(req: Request): Promise<Response> {
  const secret = env('STRIPE_SECRET_KEY');
  const admin = getAdmin();
  if (!secret || !admin) return error(503, 'billing_unconfigured', 'Billing isn’t set up yet.');
  const user = await userFromRequest(req);
  if (!user) return error(401, 'auth_required', 'Sign in first.');
  const { data } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (!data?.stripe_customer_id) return error(404, 'no_subscription', 'No subscription found.');
  const stripe = new Stripe(secret);
  const session = await stripe.billingPortal.sessions.create({ customer: data.stripe_customer_id, return_url: env('APP_URL') ?? new URL(req.url).origin });
  return json({ url: session.url });
}
