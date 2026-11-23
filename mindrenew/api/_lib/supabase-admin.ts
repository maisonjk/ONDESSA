import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { env } from './http.js';

let admin: SupabaseClient | null | undefined;

/** Service-role client. Server only. Null when Supabase isn't configured (local mode). */
export function getAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  admin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return admin;
}

export async function userFromRequest(req: Request): Promise<User | null> {
  const sb = getAdmin();
  const auth = req.headers.get('authorization');
  if (!sb || !auth?.startsWith('Bearer ')) return null;
  const { data, error } = await sb.auth.getUser(auth.slice(7));
  return error ? null : data.user;
}

export async function isPremium(userId: string): Promise<boolean> {
  const sb = getAdmin();
  if (!sb) return false;
  const { data } = await sb.from('subscriptions').select('status').eq('user_id', userId).maybeSingle();
  return !!data && ['active', 'trialing'].includes(data.status);
}
