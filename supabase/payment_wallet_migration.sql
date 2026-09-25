-- BHAVISHYA GYANI — PAYMENT / WALLET / COMMISSION / PAYOUT MIGRATION
-- Run once in Supabase SQL Editor on an existing project.
create table if not exists public.wallets(
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.user_accounts(id) on delete cascade,
 balance numeric(12,2) not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.wallet_transactions(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.user_accounts(id) on delete cascade,
 amount numeric(12,2) not null, type text not null check(type in ('credit','debit')), source text not null default 'manual', payment_id uuid references public.payments(id) on delete set null, description text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.payouts(
 id uuid primary key default gen_random_uuid(), astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 period_start date not null, period_end date not null, gross_amount numeric(12,2) not null default 0, commission_amount numeric(12,2) not null default 0, net_amount numeric(12,2) not null default 0, payout_date date, status text not null default 'pending' check(status in ('pending','processing','paid','held')), reference text, admin_note text, paid_at timestamptz, created_at timestamptz not null default now(), unique(astrologer_id,period_start,period_end)
);
alter table public.astrologers add column if not exists fee_per_minute numeric(12,2) not null default 0;
alter table public.payments add column if not exists gateway text;
alter table public.payments add column if not exists gateway_order_id text;
alter table public.payments add column if not exists gateway_payment_id text;
alter table public.payments add column if not exists purpose text not null default 'general';
alter table public.astrologer_earnings add column if not exists gross_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists commission_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists net_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists paid_out boolean not null default false;
alter table public.astrologer_earnings add column if not exists payout_id uuid;
update public.astrologers set fee_per_minute=fee where fee_per_minute=0 and fee>0;
insert into public.platform_settings(key,value) values('payment_settings','{"commission_percent":20,"payout_start_day":1,"payout_end_day":10}'::jsonb) on conflict(key) do nothing;
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY['wallets','wallet_transactions','payouts']) LOOP EXECUTE format('alter table public.%I enable row level security',t); END LOOP;
END $$;
create index if not exists idx_wallet_tx_user on public.wallet_transactions(user_id,created_at desc);
create index if not exists idx_earnings_astro_day on public.astrologer_earnings(astrologer_id,earned_at desc);
create index if not exists idx_payouts_astro_period on public.payouts(astrologer_id,period_start,period_end);
alter table public.astrologer_earnings add column if not exists conversation_id uuid references public.conversations(id) on delete set null;
create unique index if not exists uq_earnings_conversation on public.astrologer_earnings(conversation_id) where conversation_id is not null;
alter table public.conversations add column if not exists billed_seconds integer not null default 0;
alter table public.conversations add column if not exists billed_amount numeric(12,2) not null default 0;
