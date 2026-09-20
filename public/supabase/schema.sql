-- Bhavishya Gyani Astrology V6 — Supabase/Postgres foundation
create extension if not exists pgcrypto;

create type public.app_role as enum ('user','astrologer','admin');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.astrologers (
  id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  experience_years integer default 0,
  expertise text[] default '{}',
  languages text[] default '{}',
  fee numeric(12,2) not null default 0,
  discount numeric(5,2) not null default 0,
  online boolean not null default false,
  verified boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.astrologer_documents (
  id uuid primary key default gen_random_uuid(),
  astrologer_id uuid not null references public.astrologers(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.kundalis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  gender text,
  dob date not null,
  birth_time time not null,
  place text not null,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  timezone numeric(4,2) not null default 5.50,
  ayanamsa text not null default 'Lahiri',
  calculation_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  astrologer_id uuid not null references public.astrologers(id) on delete cascade,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  kundali_id uuid references public.kundalis(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  astrologer_id uuid not null references public.astrologers(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now(),
  unique(conversation_id,user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;

alter table public.profiles enable row level security;
alter table public.astrologers enable row level security;
alter table public.astrologer_documents enable row level security;
alter table public.kundalis enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select using (id=auth.uid() or public.is_admin());

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update using (id=auth.uid() or public.is_admin());

drop policy if exists "astrologers public verified read" on public.astrologers;
create policy "astrologers public verified read" on public.astrologers for select using (verified=true or id=auth.uid() or public.is_admin());

drop policy if exists "astrologers own update" on public.astrologers;
create policy "astrologers own update" on public.astrologers for update using (id=auth.uid() or public.is_admin());

drop policy if exists "kundalis owner read" on public.kundalis;
create policy "kundalis owner read" on public.kundalis for select using (user_id=auth.uid() or public.is_admin());

drop policy if exists "kundalis owner insert" on public.kundalis;
create policy "kundalis owner insert" on public.kundalis for insert with check (user_id=auth.uid());

drop policy if exists "kundalis owner update" on public.kundalis;
create policy "kundalis owner update" on public.kundalis for update using (user_id=auth.uid() or public.is_admin());

drop policy if exists "conversations participants" on public.conversations;
create policy "conversations participants" on public.conversations for select
using (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin());

drop policy if exists "conversations user insert" on public.conversations;
create policy "conversations user insert" on public.conversations for insert
with check (user_id=auth.uid());

drop policy if exists "messages participants" on public.messages;
create policy "messages participants" on public.messages for select
using (exists(select 1 from conversations c where c.id=conversation_id and (c.user_id=auth.uid() or c.astrologer_id=auth.uid())) or public.is_admin());

drop policy if exists "messages sender insert" on public.messages;
create policy "messages sender insert" on public.messages for insert
with check (sender_id=auth.uid() and exists(select 1 from conversations c where c.id=conversation_id and (c.user_id=auth.uid() or c.astrologer_id=auth.uid())));

drop policy if exists "reviews owner insert" on public.reviews;
create policy "reviews owner insert" on public.reviews for insert
with check (user_id=auth.uid());

drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews for select using (true);

drop policy if exists "notifications own" on public.notifications;
create policy "notifications own" on public.notifications for all using (user_id=auth.uid() or public.is_admin());

-- Auth profile bootstrap
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id, full_name) values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
