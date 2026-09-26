-- Bhavishya Gyani: Pooja catalogue + booking management
-- Run this ONCE in Supabase SQL Editor. It does not alter existing chat/Kundli/auth tables.

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
  preferred_date date not null,
  preferred_time time not null,
  notes text not null default '',
  amount numeric(12,2) not null default 0 check(amount >= 0),
  status text not null default 'pending' check(status in ('pending','confirmed','rejected','completed','cancelled')),
  astrologer_note text not null default '',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_poojas_astro_active on public.poojas(astrologer_id,active,created_at desc);
create index if not exists idx_pooja_bookings_user on public.pooja_bookings(user_id,created_at desc);
create index if not exists idx_pooja_bookings_astro on public.pooja_bookings(astrologer_id,status,created_at desc);
create index if not exists idx_pooja_bookings_status on public.pooja_bookings(status,created_at desc);

alter table public.poojas enable row level security;
alter table public.pooja_bookings enable row level security;
