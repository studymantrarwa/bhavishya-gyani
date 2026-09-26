-- BHAVISHYA GYANI - FINAL CUMULATIVE MIGRATION
-- Existing project ke liye. Is file ko Supabase SQL Editor me ek baar run karein.
-- Ye destructive setup.sql nahi hai aur existing user/chat data ko drop nahi karta.

-- =========================
-- 1) POOJA CATALOG + BOOKING
-- =========================
create table if not exists public.poojas(
 id uuid primary key default gen_random_uuid(),
 astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 name text not null,
 description text not null default '',
 price numeric(12,2) not null default 0 check(price >= 0),
 image_url text,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.pooja_bookings(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_accounts(id) on delete cascade,
 astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 pooja_id uuid not null references public.poojas(id) on delete restrict,
 user_name text not null default '',
 phone text not null default '',
 preferred_date date,
 preferred_time time,
 notes text not null default '',
 amount numeric(12,2) not null default 0 check(amount >= 0),
 status text not null default 'pending' check(status in ('pending','confirmed','rejected','completed','cancelled')),
 astrologer_note text not null default '',
 admin_note text not null default '',
 wallet_debited boolean not null default false,
 wallet_refunded boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.pooja_bookings add column if not exists user_name text not null default '';
alter table public.pooja_bookings add column if not exists phone text not null default '';
alter table public.pooja_bookings add column if not exists preferred_date date;
alter table public.pooja_bookings add column if not exists preferred_time time;
alter table public.pooja_bookings add column if not exists notes text not null default '';
alter table public.pooja_bookings add column if not exists amount numeric(12,2) not null default 0;
alter table public.pooja_bookings add column if not exists astrologer_note text not null default '';
alter table public.pooja_bookings add column if not exists admin_note text not null default '';
alter table public.pooja_bookings add column if not exists wallet_debited boolean not null default false;
alter table public.pooja_bookings add column if not exists wallet_refunded boolean not null default false;

create index if not exists idx_poojas_astro_active on public.poojas(astrologer_id,active,created_at desc);
create index if not exists idx_pooja_bookings_user on public.pooja_bookings(user_id,created_at desc);
create index if not exists idx_pooja_bookings_astro on public.pooja_bookings(astrologer_id,status,created_at desc);
create index if not exists idx_pooja_bookings_status on public.pooja_bookings(status,created_at desc);
create index if not exists idx_pooja_bookings_user_status on public.pooja_bookings(user_id,status,created_at desc);
alter table public.poojas enable row level security;
alter table public.pooja_bookings enable row level security;

-- =========================
-- 2) WALLET + PAYMENT + PAYOUT
-- =========================
create table if not exists public.wallets(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.user_accounts(id) on delete cascade,
 balance numeric(12,2) not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_accounts(id) on delete cascade,
 amount numeric(12,2) not null,
 type text not null check(type in ('credit','debit')),
 source text not null default 'manual',
 payment_id uuid references public.payments(id) on delete set null,
 description text not null default '',
 created_at timestamptz not null default now()
);

create table if not exists public.payouts(
 id uuid primary key default gen_random_uuid(),
 astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 period_start date not null,
 period_end date not null,
 gross_amount numeric(12,2) not null default 0,
 commission_amount numeric(12,2) not null default 0,
 net_amount numeric(12,2) not null default 0,
 payout_date date,
 status text not null default 'pending' check(status in ('pending','processing','paid','held')),
 reference text,
 admin_note text,
 paid_at timestamptz,
 created_at timestamptz not null default now(),
 unique(astrologer_id,period_start,period_end)
);

alter table public.astrologers add column if not exists fee_per_minute numeric(12,2) not null default 0;
alter table public.payments add column if not exists gateway text;
alter table public.payments add column if not exists gateway_order_id text;
alter table public.payments add column if not exists gateway_payment_id text;
alter table public.payments add column if not exists purpose text not null default 'general';
alter table public.astrologer_earnings add column if not exists gross_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists commission_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists net_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists paid_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists paid_minutes numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists paid_out boolean not null default false;
alter table public.astrologer_earnings add column if not exists payout_id uuid;
alter table public.astrologer_earnings add column if not exists conversation_id uuid references public.conversations(id) on delete set null;
alter table public.conversations add column if not exists billed_seconds integer not null default 0;
alter table public.conversations add column if not exists billed_amount numeric(12,2) not null default 0;
alter table public.conversations add column if not exists chat_started_at timestamptz;
alter table public.conversations add column if not exists chat_budget_seconds integer not null default 0;
update public.astrologers set fee_per_minute=fee where fee_per_minute=0 and fee>0;

insert into public.platform_settings(key,value) values('payment_settings','{"commission_percent":20,"payout_start_day":1,"payout_end_day":10}'::jsonb) on conflict(key) do nothing;

drop index if exists uq_earnings_conversation;
create unique index if not exists uq_earnings_conversation on public.astrologer_earnings(conversation_id) where conversation_id is not null;
create index if not exists idx_wallet_tx_user on public.wallet_transactions(user_id,created_at desc);
create index if not exists idx_earnings_astro_day on public.astrologer_earnings(astrologer_id,earned_at desc);
create index if not exists idx_payouts_astro_period on public.payouts(astrologer_id,period_start,period_end);
create index if not exists idx_conversations_chat_started on public.conversations(status,chat_started_at);

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check(status in ('pending','approved','failed','rejected','refunded'));

-- =========================
-- 3) FREE CHAT MINUTES + FESTIVAL OFFERS
-- =========================
alter table public.user_accounts add column if not exists free_chat_minutes integer not null default 0;
alter table public.user_accounts add column if not exists free_chat_minutes_used integer not null default 0;

create table if not exists public.chat_free_minute_transactions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_accounts(id) on delete cascade,
 minutes integer not null check(minutes > 0),
 type text not null check(type in ('credit','debit')),
 source text not null default 'admin',
 conversation_id uuid references public.conversations(id) on delete set null,
 description text not null default '',
 created_at timestamptz not null default now()
);

create table if not exists public.chat_festival_offers(
 id uuid primary key default gen_random_uuid(),
 name text not null,
 minutes integer not null check(minutes > 0),
 target text not null default 'all' check(target in ('all','selected')),
 user_ids uuid[] not null default '{}',
 start_at timestamptz not null,
 end_at timestamptz not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.chat_offer_claims(
 id uuid primary key default gen_random_uuid(),
 offer_id uuid not null references public.chat_festival_offers(id) on delete cascade,
 user_id uuid not null references public.user_accounts(id) on delete cascade,
 minutes_granted integer not null check(minutes_granted > 0),
 claimed_at timestamptz not null default now(),
 unique(offer_id,user_id)
);

create index if not exists idx_chat_free_tx_user on public.chat_free_minute_transactions(user_id,created_at desc);
create index if not exists idx_chat_festival_offers_active on public.chat_festival_offers(active,start_at,end_at);
create index if not exists idx_chat_offer_claims_user on public.chat_offer_claims(user_id,claimed_at desc);

insert into public.platform_settings(key,value) values('chat_offer_settings','{"new_user_free_minutes":0}'::jsonb) on conflict(key) do nothing;
insert into public.platform_settings(key,value) values('recharge_offer_settings','{"active":false,"percent":0,"start_at":null,"end_at":null}'::jsonb) on conflict(key) do nothing;

-- =========================
-- 4) SECURITY / RLS
-- =========================
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY['wallets','wallet_transactions','payouts','chat_free_minute_transactions','chat_festival_offers','chat_offer_claims']) LOOP
    EXECUTE format('alter table public.%I enable row level security',t);
  END LOOP;
END $$;

-- API uses the service role, so existing application policies remain authoritative for client access.
