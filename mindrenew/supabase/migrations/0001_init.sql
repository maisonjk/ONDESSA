-- MindRenew schema. Run with `supabase db push` or paste into the SQL editor.
-- Row Level Security on every table: users only ever touch their own rows.
-- subscriptions, ai_usage and ai_cache are written only by the server (service role).

create extension if not exists pgcrypto;

-- Profiles -------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  goals text[] not null default '{}',
  patterns text[] not null default '{}',
  minutes int not null default 5,
  reminder jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- Daily renewals -------------------------------------------------------------
create table public.renewals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  category text not null,
  lie_id text,
  lie_text text not null,
  verse_id text not null,
  reflection text,
  action text,
  journey_id text
);
create index renewals_user_date on public.renewals (user_id, date);

-- Truth Library --------------------------------------------------------------
create table public.truths (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  lie_text text not null,
  truth text not null,
  verse_id text not null,
  reflection text,
  saved_at timestamptz not null default now(),
  favorite boolean not null default false,
  source text not null default 'renewal'
);
create index truths_user on public.truths (user_id, saved_at desc);

-- Subscriptions (server-written from Stripe webhooks) ------------------------
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null,
  price_id text,
  interval text,
  amount_cents int,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

-- AI usage and cost (server-written) -----------------------------------------
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week text not null,
  model text,
  source text not null,        -- ai | cache | library
  cached boolean not null default false,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_user_week on public.ai_usage (user_id, week);

create table public.ai_cache (
  key text primary key,
  response jsonb not null,
  expires_at timestamptz not null
);

-- Analytics events -----------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  device_id text,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_name_time on public.events (name, created_at);
create index events_user on public.events (user_id, created_at);

-- RLS ------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.renewals enable row level security;
alter table public.truths enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_cache enable row level security;
alter table public.events enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own renewals" on public.renewals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own truths" on public.truths for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read own subscription" on public.subscriptions for select using (auth.uid() = user_id);
create policy "read own ai usage" on public.ai_usage for select using (auth.uid() = user_id);
-- events: anyone (incl. anonymous pre-signup) may insert; a signed-in user may only attribute events to themselves.
create policy "insert events" on public.events for insert with check (user_id is null or auth.uid() = user_id);
-- ai_cache: no policies, service role only.

-- Metrics views (query from the dashboard or a BI tool with the service role) --
create or replace view public.metrics_daily as
select
  d::date as day,
  (select count(distinct coalesce(user_id::text, device_id)) from public.events e where e.name = 'app_opened' and e.created_at::date = d::date) as dau,
  (select count(*) from public.events e where e.name = 'onboarding_completed' and e.created_at::date = d::date) as onboardings,
  (select count(*) from public.events e where e.name = 'first_renewal_completed' and e.created_at::date = d::date) as first_renewals,
  (select count(*) from public.events e where e.name = 'renewal_completed' and e.created_at::date = d::date) as renewals,
  (select count(*) from public.events e where e.name = 'truth_saved' and e.created_at::date = d::date) as truths_saved,
  (select count(*) from public.events e where e.name = 'subscription_activated' and e.created_at::date = d::date) as new_subscribers,
  (select count(*) from public.events e where e.name = 'subscription_churned' and e.created_at::date = d::date) as churned
from generate_series(now() - interval '60 days', now(), interval '1 day') d;

-- Day-1 retention: of devices that finished a first renewal on day X, how many renewed on X+1.
create or replace view public.metrics_d1_retention as
with firsts as (
  select coalesce(user_id::text, device_id) as who, min(created_at::date) as first_day
  from public.events where name = 'renewal_completed' group by 1
)
select f.first_day as cohort_day,
       count(*) as cohort,
       count(*) filter (where exists (
         select 1 from public.events e where e.name = 'renewal_completed'
           and coalesce(e.user_id::text, e.device_id) = f.who and e.created_at::date = f.first_day + 1)) as returned_d1
from firsts f group by 1 order by 1 desc;

-- Users with 3+ renewal days per ISO week (the core habit metric).
create or replace view public.metrics_weekly_habit as
select to_char(date, 'IYYY-"W"IW') as week,
       count(distinct user_id) as active_users,
       count(distinct user_id) filter (where days >= 3) as habit_users
from (select user_id, date, count(distinct date) over (partition by user_id, date_trunc('week', date)) as days from public.renewals) t
group by 1 order by 1 desc;

-- AI cost per active subscriber, by month.
create or replace view public.metrics_ai_cost as
select date_trunc('month', u.created_at)::date as month,
       sum(u.cost_usd) as ai_cost_usd,
       count(*) filter (where u.source = 'ai') as model_calls,
       count(*) filter (where u.source = 'cache') as cache_hits,
       (select count(*) from public.subscriptions s where s.status in ('active', 'trialing')) as active_subscribers,
       round(sum(u.cost_usd) filter (where exists (select 1 from public.subscriptions s where s.user_id = u.user_id and s.status in ('active','trialing')))
             / nullif((select count(*) from public.subscriptions s where s.status in ('active', 'trialing')), 0), 4) as ai_cost_per_subscriber
from public.ai_usage u group by 1 order by 1 desc;

-- Free-to-paid conversion.
create or replace view public.metrics_conversion as
select (select count(*) from auth.users) as accounts,
       (select count(*) from public.subscriptions where status in ('active', 'trialing')) as paying,
       round(100.0 * (select count(*) from public.subscriptions where status in ('active', 'trialing')) / nullif((select count(*) from auth.users), 0), 2) as conversion_pct;

revoke all on public.metrics_daily, public.metrics_d1_retention, public.metrics_weekly_habit, public.metrics_ai_cost, public.metrics_conversion from anon, authenticated;
