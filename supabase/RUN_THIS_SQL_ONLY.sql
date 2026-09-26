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

-- Bhavishya Gyani: atomic chat settlement + user confirmation fields
-- Safe to run repeatedly.
alter table public.conversations add column if not exists chat_started_at timestamptz;
alter table public.conversations add column if not exists chat_budget_seconds integer not null default 0;
alter table public.conversations add column if not exists billed_seconds integer not null default 0;
alter table public.conversations add column if not exists billed_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists gross_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists commission_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists net_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists paid_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists paid_minutes numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists conversation_id uuid references public.conversations(id) on delete set null;
create unique index if not exists uq_earnings_conversation on public.astrologer_earnings(conversation_id) where conversation_id is not null;

create or replace function public.settle_chat_billing(
  p_conversation_id uuid,
  p_user_id uuid,
  p_astrologer_id uuid,
  p_minutes integer,
  p_rate numeric,
  p_commission_percent numeric,
  p_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w wallets%rowtype;
  ua user_accounts%rowtype;
  existing astrologer_earnings%rowtype;
  v_minutes integer := greatest(0, coalesce(p_minutes,0));
  v_rate numeric(12,2) := greatest(0, coalesce(p_rate,0));
  v_comm numeric(7,2) := least(100,greatest(0,coalesce(p_commission_percent,20)));
  v_free integer := 0;
  v_free_used integer := 0;
  v_paid_minutes integer := 0;
  v_paid_amount numeric(12,2) := 0;
  v_gross numeric(12,2) := 0;
  v_commission numeric(12,2) := 0;
  v_net numeric(12,2) := 0;
  v_payment_id uuid;
  v_earning_id uuid;
begin
  if p_conversation_id is null or p_user_id is null or p_astrologer_id is null then
    raise exception 'Invalid chat billing identifiers';
  end if;

  select * into existing from public.astrologer_earnings
    where conversation_id = p_conversation_id limit 1;
  if found then
    return jsonb_build_object('charged',true,'existing',true,'earning_id',existing.id,
      'net',coalesce(existing.net_amount,existing.amount,0),'wallet_amount',coalesce(existing.paid_amount,0),
      'paid_minutes',coalesce(existing.paid_minutes,0));
  end if;

  select * into ua from public.user_accounts where id=p_user_id for update;
  if not found then raise exception 'User account not found'; end if;
  select * into w from public.wallets where user_id=p_user_id for update;
  if not found then
    insert into public.wallets(user_id,balance) values(p_user_id,0) returning * into w;
  end if;

  v_free := greatest(0, coalesce(ua.free_chat_minutes,0));
  v_free_used := least(v_minutes,v_free);
  v_paid_minutes := greatest(0,v_minutes-v_free_used);
  v_paid_amount := round((v_rate*v_paid_minutes)::numeric,2);
  v_gross := v_paid_amount;
  v_commission := round((v_gross*v_comm/100)::numeric,2);
  v_net := greatest(0,round((v_gross-v_commission)::numeric,2));

  if coalesce(w.balance,0) < v_paid_amount then
    raise exception 'INSUFFICIENT_WALLET:%:%',v_paid_amount,coalesce(w.balance,0);
  end if;

  if v_free_used > 0 then
    update public.user_accounts
      set free_chat_minutes=greatest(0,coalesce(free_chat_minutes,0)-v_free_used),
          free_chat_minutes_used=coalesce(free_chat_minutes_used,0)+v_free_used,
          updated_at=now()
      where id=p_user_id;
    begin
      insert into public.chat_free_minute_transactions(user_id,minutes,type,source,conversation_id,description)
      values(p_user_id,v_free_used,'debit','chat',p_conversation_id,
             'Free chat minutes used');
    exception when undefined_table then null; end;
  end if;

  if v_paid_amount > 0 then
    update public.wallets set balance=round((coalesce(balance,0)-v_paid_amount)::numeric,2),updated_at=now() where id=w.id;
    insert into public.payments(user_id,astrologer_id,conversation_id,amount,currency,method,purpose,status,reference)
      values(p_user_id,p_astrologer_id,p_conversation_id,v_paid_amount,'INR','wallet','chat_minutes','approved','CHAT-'||p_conversation_id)
      returning id into v_payment_id;
    insert into public.wallet_transactions(user_id,amount,type,source,payment_id,description)
      values(p_user_id,v_paid_amount,'debit','chat',v_payment_id,
             'Astrologer chat '||v_paid_minutes||' paid minute(s) @ ₹'||v_rate||'/min');
  end if;

  insert into public.astrologer_earnings(astrologer_id,amount,gross_amount,commission_amount,net_amount,paid_amount,paid_minutes,category,conversation_id,earned_at)
    values(p_astrologer_id,v_net,v_gross,v_commission,v_net,v_paid_amount,v_paid_minutes,'chat',p_conversation_id,now())
    returning id into v_earning_id;

  update public.conversations set billed_seconds=greatest(0,coalesce(p_seconds,0)),billed_amount=v_paid_amount where id=p_conversation_id;

  return jsonb_build_object('charged',true,'existing',false,'earning_id',v_earning_id,
    'payment_id',v_payment_id,'minutes',v_minutes,'seconds',greatest(0,coalesce(p_seconds,0)),
    'rate',v_rate,'gross',v_gross,'commission',v_commission,'net',v_net,
    'free_minutes_used',v_free_used,'paid_minutes',v_paid_minutes,'wallet_amount',v_paid_amount);
exception when unique_violation then
  select * into existing from public.astrologer_earnings where conversation_id=p_conversation_id limit 1;
  if found then
    return jsonb_build_object('charged',true,'existing',true,'earning_id',existing.id,
      'net',coalesce(existing.net_amount,existing.amount,0),'wallet_amount',coalesce(existing.paid_amount,0),
      'paid_minutes',coalesce(existing.paid_minutes,0));
  end if;
  raise;
end;
$$;

grant execute on function public.settle_chat_billing(uuid,uuid,uuid,integer,numeric,numeric,integer) to service_role;

-- One-time reconciliation: if a prior chat payment was recorded but its earning row
-- is missing, create the missing net earning without charging the wallet again.
do $$
declare
  r record;
  pct numeric := 20;
  comm numeric;
  net numeric;
begin
  begin
    select coalesce((value->>'commission_percent')::numeric,20) into pct
    from public.platform_settings where key='payment_settings' limit 1;
  exception when others then pct := 20;
  end;
  for r in
    select p.conversation_id,p.astrologer_id,p.amount,p.created_at
    from public.payments p
    left join public.astrologer_earnings e on e.conversation_id=p.conversation_id
    where p.purpose='chat_minutes' and p.status='approved' and p.conversation_id is not null
      and p.astrologer_id is not null and e.id is null
  loop
    comm := round((r.amount*least(100,greatest(0,pct))/100)::numeric,2);
    net := greatest(0,round((r.amount-comm)::numeric,2));
    insert into public.astrologer_earnings(astrologer_id,amount,gross_amount,commission_amount,net_amount,paid_amount,paid_minutes,category,conversation_id,earned_at)
    values(r.astrologer_id,net,r.amount,comm,net,r.amount,0,'chat',r.conversation_id,r.created_at)
    on conflict (conversation_id) do nothing;
  end loop;
end $$;
