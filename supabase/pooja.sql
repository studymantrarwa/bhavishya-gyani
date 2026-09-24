-- Bhavishya Gyani: Pooja catalog + booking migration
-- Run this ONCE in Supabase SQL Editor. Do not rerun the full setup.sql.

create table if not exists public.poojas(
 id uuid primary key default gen_random_uuid(),
 astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 name text not null,
 description text,
 price numeric(12,2) not null default 0 check(price>=0),
 image_url text,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.pooja_bookings(
 id uuid primary key default gen_random_uuid(),
 pooja_id uuid not null references public.poojas(id) on delete restrict,
 user_id uuid not null references public.user_accounts(id) on delete cascade,
 astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 pooja_name text not null,
 price numeric(12,2) not null default 0,
 booking_date date not null,
 booking_time time not null,
 note text,
 status text not null default 'pending' check(status in ('pending','accepted','rejected','completed','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.poojas enable row level security;
alter table public.pooja_bookings enable row level security;

create index if not exists idx_poojas_astro_active on public.poojas(astrologer_id,active,created_at desc);
create index if not exists idx_pooja_bookings_user on public.pooja_bookings(user_id,created_at desc);
create index if not exists idx_pooja_bookings_astro on public.pooja_bookings(astrologer_id,status,created_at desc);
