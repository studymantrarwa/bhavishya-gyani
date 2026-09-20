-- Bhavishya Gyani Astrologer Panel V2 - additive migration
alter table public.astrologers add column if not exists call_enabled boolean not null default false;
alter table public.astrologers add column if not exists chat_enabled boolean not null default false;
alter table public.astrologers add column if not exists video_enabled boolean not null default false;
alter table public.astrologers add column if not exists boost_enabled boolean not null default false;
alter table public.astrologers add column if not exists followers_count integer not null default 0;
alter table public.astrologers add column if not exists policy_violations integer not null default 0;
alter table public.astrologers add column if not exists avatar_url text;
create table if not exists public.astrologer_earnings(
 id uuid primary key default gen_random_uuid(), astrologer_id uuid not null references public.profiles(id) on delete cascade,
 amount numeric(12,2) not null default 0, category text not null default 'service', description text default '', earned_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index if not exists idx_astrologer_earnings_astrologer_date on public.astrologer_earnings(astrologer_id,earned_at);
create table if not exists public.astrologer_performance_daily(
 id uuid primary key default gen_random_uuid(), astrologer_id uuid not null references public.profiles(id) on delete cascade,
 day date not null, chat_quality numeric(8,2) default 0, live_hours numeric(8,2) default 0, call_pickup_rate numeric(8,2) default 0,
 chat_pickup_rate numeric(8,2) default 0, conversion_rate numeric(8,2) default 0, response_time_sec numeric(8,2) default 0, login_hours numeric(8,2) default 0,
 unique(astrologer_id,day)
);
create table if not exists public.astrologer_leaves(
 id uuid primary key default gen_random_uuid(), astrologer_id uuid not null references public.profiles(id) on delete cascade,
 from_date date not null, to_date date not null, reason text default '', status text not null default 'pending' check(status in ('pending','approved','rejected')), admin_note text default '', created_at timestamptz not null default now()
);
create table if not exists public.support_tickets(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 subject text not null, message text not null default '', status text not null default 'open' check(status in ('open','in_progress','resolved','closed')), admin_reply text default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.astrologer_earnings enable row level security;
alter table public.astrologer_performance_daily enable row level security;
alter table public.astrologer_leaves enable row level security;
alter table public.support_tickets enable row level security;
drop policy if exists "astrologer earnings own" on public.astrologer_earnings;
create policy "astrologer earnings own" on public.astrologer_earnings for select using(astrologer_id=auth.uid() or public.is_admin());
drop policy if exists "astrologer performance own" on public.astrologer_performance_daily;
create policy "astrologer performance own" on public.astrologer_performance_daily for select using(astrologer_id=auth.uid() or public.is_admin());
drop policy if exists "astrologer leaves own" on public.astrologer_leaves;
create policy "astrologer leaves own" on public.astrologer_leaves for select using(astrologer_id=auth.uid() or public.is_admin());
create policy "astrologer leaves insert own" on public.astrologer_leaves for insert with check(astrologer_id=auth.uid() or public.is_admin());
drop policy if exists "support tickets own" on public.support_tickets;
create policy "support tickets own" on public.support_tickets for select using(user_id=auth.uid() or public.is_admin());
create policy "support tickets insert own" on public.support_tickets for insert with check(user_id=auth.uid() or public.is_admin());
