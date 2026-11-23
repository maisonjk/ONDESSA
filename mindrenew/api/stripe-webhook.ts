import Stripe from 'stripe';
import { json, error, env } from './_lib/http.js';
import { getAdmin } from './_lib/supabase-admin.js';

/**
 * Stripe -> subscriptions table. This is the ONLY writer of subscription status,
 * so premium can't be granted from the client. Also logs conversion/churn events.
 * Subscribe in Stripe to: checkout.session.completed, customer.subscription.created/updated/deleted.
 */
export async function POST(req: Request): Promise<Response> {
  const secret = env('STRIPE_SECRET_KEY');
  const whsec = env('STRIPE_WEBHOOK_SECRET');
  const admin = getAdmin();
  if (!secret || !whsec || !admin) return error(503, 'billing_unconfigured', 'Not configured.');

  const stripe = new Stripe(secret);
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, req.headers.get('stripe-signature') ?? '', whsec);
  } catch {
    return error(400, 'bad_signature', 'Invalid signature.');
  }

  const upsertFromSubscription = async (sub: Stripe.Subscription, fallbackUserId?: string | null) => {
    const userId = sub.metadata?.user_id || fallbackUserId;
    if (!userId) return;
    const item = sub.items.data[0];
    const { data: prev } = await admin.from('subscriptions').select('status').eq('user_id', userId).maybeSingle();
    await admin.from('subscriptions').upsert({
      user_id: userId,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      status: sub.status,
      price_id: item?.price.id ?? null,
      interval: item?.price.recurring?.interval ?? null,
      amount_cents: item?.price.unit_amount ?? null,
      current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    });
    const wasPaid = prev && ['active', 'trialing'].includes(prev.status);
    const isPaid = ['active', 'trialing'].includes(sub.status);
    const name = !wasPaid && isPaid ? 'subscription_activated' : wasPaid && !isPaid ? 'subscription_churned' : null;
    if (name) await admin.from('events').insert({ name, user_id: userId, props: { status: sub.status, interval: item?.price.recurring?.interval } });
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      if (s.subscription) {
        const sub = await stripe.subscriptions.retrieve(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
        await upsertFromSubscription(sub, s.client_reference_id);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await upsertFromSubscription(event.data.object);
      break;
  }
  return json({ received: true });
}
