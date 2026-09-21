-- Bhavishya Gyani Astrology V12 — Complete Supabase setup
create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('user','astrologer','admin'); exception when duplicate_object then null; end $$;

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
-- Bhavishya Gyani Astrology — FINAL unified setup (additive)
-- Run this after your existing schema.sql if already deployed.
-- It is designed to be safe with existing data: CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

create extension if not exists pgcrypto;

-- Core profile/application fields
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists blocked boolean not null default false;
alter table public.profiles add column if not exists blocked_reason text;
alter table public.profiles add column if not exists blocked_at timestamptz;

create table if not exists public.astrologer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  bio text default '',
  experience_years integer not null default 0,
  expertise text[] not null default '{}',
  languages text[] not null default '{}',
  requested_fee numeric(12,2) not null default 0,
  avatar_url text,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.astrologer_applications add column if not exists avatar_url text;
alter table public.astrologer_applications add column if not exists education text default '';
alter table public.astrologer_applications enable row level security;

-- Chat lifecycle
alter table public.conversations add column if not exists requested_at timestamptz not null default now();
alter table public.conversations add column if not exists astrologer_accepted_at timestamptz;
alter table public.conversations add column if not exists user_confirm_deadline timestamptz;
alter table public.conversations add column if not exists user_confirmed_at timestamptz;
alter table public.conversations add column if not exists accepted_at timestamptz;
alter table public.conversations add column if not exists missed_by text;
alter table public.conversations add column if not exists astrologer_response_seconds integer;
alter table public.conversations add column if not exists user_confirm_response_seconds integer;
alter table public.conversations add column if not exists last_message_at timestamptz;
alter table public.conversations add column if not exists fee_snapshot numeric(12,2) default 0;
alter table public.conversations add column if not exists discount_snapshot numeric(5,2) default 0;
alter table public.conversations add column if not exists channel text not null default 'chat';
alter table public.conversations add column if not exists retention_until timestamptz;

alter table public.astrologers add column if not exists rank_score numeric(6,2) not null default 0;
alter table public.astrologers add column if not exists rank_position integer;
alter table public.astrologers add column if not exists rating_avg numeric(4,2) not null default 0;
alter table public.astrologers add column if not exists completed_chats integer not null default 0;
alter table public.astrologers add column if not exists accepted_requests integer not null default 0;
alter table public.astrologers add column if not exists missed_requests integer not null default 0;
alter table public.astrologers add column if not exists response_seconds_avg numeric(10,2) not null default 0;
alter table public.astrologers add column if not exists call_enabled boolean not null default false;
alter table public.astrologers add column if not exists chat_enabled boolean not null default true;
alter table public.astrologers add column if not exists video_enabled boolean not null default false;
alter table public.astrologers add column if not exists boosted boolean not null default false;
alter table public.astrologers add column if not exists followers integer not null default 0;
alter table public.astrologers add column if not exists education text default '';

-- Astrologer follows
create table if not exists public.astrologer_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  astrologer_id uuid not null references public.astrologers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, astrologer_id)
);
alter table public.astrologer_follows enable row level security;
drop policy if exists "users manage own astrologer follows" on public.astrologer_follows;
create policy "users manage own astrologer follows" on public.astrologer_follows for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- Payments / admin audit / settings
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  astrologer_id uuid references public.astrologers(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  method text not null default 'manual',
  reference text,
  proof_url text,
  status text not null default 'pending' check(status in ('pending','approved','rejected','refunded')),
  admin_note text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.platform_settings(key text primary key,value jsonb not null default '{}'::jsonb,updated_by uuid references public.profiles(id) on delete set null,updated_at timestamptz not null default now());
create table if not exists public.admin_audit_logs(id uuid primary key default gen_random_uuid(),admin_id uuid not null references public.profiles(id) on delete cascade,action text not null,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());

-- Reviews moderation columns
alter table public.reviews add column if not exists moderation_status text not null default 'approved';
alter table public.reviews add column if not exists admin_note text;

-- RLS
alter table public.profiles enable row level security;
alter table public.astrologers enable row level security;
alter table public.astrologer_applications enable row level security;
alter table public.kundalis enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;
alter table public.platform_settings enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Application policies
drop policy if exists "applications own read" on public.astrologer_applications;
create policy "applications own read" on public.astrologer_applications for select using (user_id=auth.uid() or public.is_admin());
drop policy if exists "applications own insert" on public.astrologer_applications;
create policy "applications own insert" on public.astrologer_applications for insert with check (user_id=auth.uid() or public.is_admin());
drop policy if exists "applications own update" on public.astrologer_applications;
create policy "applications own update" on public.astrologer_applications for update using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());

-- Public verified astrologers only
drop policy if exists "astrologers public verified read" on public.astrologers;
create policy "astrologers public verified read" on public.astrologers for select using (verified=true or id=auth.uid() or public.is_admin());
drop policy if exists "astrologers own insert" on public.astrologers;
create policy "astrologers own insert" on public.astrologers for insert with check (id=auth.uid() or public.is_admin());
drop policy if exists "astrologers own update" on public.astrologers;
create policy "astrologers own update" on public.astrologers for update using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());

-- Conversation participant access
drop policy if exists "conversations participants" on public.conversations;
create policy "conversations participants" on public.conversations for select using (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin());
drop policy if exists "conversations user insert" on public.conversations;
create policy "conversations user insert" on public.conversations for insert with check (user_id=auth.uid() or public.is_admin());
drop policy if exists "conversations participant update" on public.conversations;
create policy "conversations participant update" on public.conversations for update using (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin());

-- Kundli sharing: owner always; astrologer only after both confirmations or closed chat
drop policy if exists "kundalis shared with astrologer" on public.kundalis;
create policy "kundalis shared with astrologer" on public.kundalis for select using (
 user_id=auth.uid() or public.is_admin() or exists(select 1 from public.conversations c where c.user_id=kundalis.user_id and c.astrologer_id=auth.uid() and c.status in ('accepted','closed'))
);

-- Messages
drop policy if exists "messages participants" on public.messages;
create policy "messages participants" on public.messages for select using (exists(select 1 from public.conversations c where c.id=conversation_id and (c.user_id=auth.uid() or c.astrologer_id=auth.uid())) or public.is_admin());
drop policy if exists "messages sender insert" on public.messages;
create policy "messages sender insert" on public.messages for insert with check (sender_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and c.status='accepted' and (c.user_id=auth.uid() or c.astrologer_id=auth.uid())));

-- Reviews
 drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews for select using (moderation_status='approved' or user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin());

-- Payments
 drop policy if exists "payments own or admin read" on public.payments;
create policy "payments own or admin read" on public.payments for select using (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin());
drop policy if exists "payments own insert" on public.payments;
create policy "payments own insert" on public.payments for insert with check (user_id=auth.uid());
drop policy if exists "payments admin update" on public.payments;
create policy "payments admin update" on public.payments for update using (public.is_admin()) with check (public.is_admin());

-- Admin audit/settings
drop policy if exists "settings admin" on public.platform_settings;
create policy "settings admin" on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin audit read" on public.admin_audit_logs;
create policy "admin audit read" on public.admin_audit_logs for select using (public.is_admin());
drop policy if exists "admin audit insert" on public.admin_audit_logs;
create policy "admin audit insert" on public.admin_audit_logs for insert with check (public.is_admin() and admin_id=auth.uid());

-- Realtime publication. Safe if already present.
alter table public.messages replica identity full;
alter table public.conversations replica identity full;
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.conversations; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

-- Storage is intentionally not referenced here. Supabase Storage is a managed schema and may not be exposed in every project/setup.
-- Astrologer registration uploads a photo when the managed bucket exists; if it does not, registration still succeeds and the UI uses the profile initials.
-- If you want photo uploads, create a public bucket named astrologer-photos from Supabase Dashboard -> Storage.

-- Helpful indexes
create index if not exists idx_conv_retention on public.conversations(retention_until);
create index if not exists idx_conv_astrologer_status on public.conversations(astrologer_id,status,created_at desc);
create index if not exists idx_conv_user_status on public.conversations(user_id,status,created_at desc);
create index if not exists idx_astrologers_rank on public.astrologers(rank_score desc,rating_avg desc);
create index if not exists idx_apps_status on public.astrologer_applications(status,created_at desc);
create index if not exists idx_payments_status on public.payments(status,created_at desc);

insert into public.platform_settings(key,value) values
('chat_rules','{"astrologer_accept_seconds":120,"user_confirm_seconds":120,"chat_retention_seconds":172800,"auto_miss":true}'::jsonb),
('rank_rules','{"rating_weight":35,"completion_weight":20,"acceptance_weight":20,"response_weight":15,"reliability_weight":10}'::jsonb)
on conflict (key) do update set value=excluded.value,updated_at=now();

-- Keep Auth -> profile data in sync and create a pending astrologer application
-- when the legacy signup flow sends account_type=astrologer.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
declare
 v_phone text := nullif(new.raw_user_meta_data->>'phone','');
 v_type text := coalesce(new.raw_user_meta_data->>'account_type','user');
begin
 insert into public.profiles(id,full_name,email,phone)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email,v_phone)
 on conflict(id) do update set full_name=excluded.full_name,email=excluded.email,phone=coalesce(excluded.phone,public.profiles.phone),updated_at=now();
 if v_type='astrologer' then
   insert into public.astrologer_applications(user_id) values(new.id) on conflict(user_id) do nothing;
 end if;
 return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Private Realtime chat channel authorization (chat:<conversation_uuid>)
drop policy if exists "chat participants realtime read" on realtime.messages;
create policy "chat participants realtime read" on realtime.messages for select to authenticated using (
  realtime.topic() like 'chat:%' and exists (select 1 from public.conversations c where c.id = (substring(realtime.topic() from 6))::uuid and (c.user_id = auth.uid() or c.astrologer_id = auth.uid() or public.is_admin()))
);
drop policy if exists "chat participants realtime write" on realtime.messages;
create policy "chat participants realtime write" on realtime.messages for insert to authenticated with check (
  realtime.topic() like 'chat:%' and exists (select 1 from public.conversations c where c.id = (substring(realtime.topic() from 6))::uuid and (c.user_id = auth.uid() or c.astrologer_id = auth.uid() or public.is_admin()))
);

-- V12 production presence / online heartbeat
alter table public.astrologers add column if not exists last_seen timestamptz;
create index if not exists idx_astrologers_presence on public.astrologers(online,last_seen desc);

-- V12: keep conversation changes available to realtime clients.
alter table public.conversations replica identity full;
alter table public.messages replica identity full;

-- V12 chat support compatibility: admin support conversations may not have an astrologer.
alter table public.conversations alter column astrologer_id drop not null;
alter table public.conversations add column if not exists admin_id uuid references public.profiles(id) on delete set null;
create index if not exists idx_conversations_admin_status on public.conversations(admin_id,status,created_at desc);

drop policy if exists "conversations participants" on public.conversations;
create policy "conversations participants" on public.conversations for select using (user_id=auth.uid() or astrologer_id=auth.uid() or admin_id=auth.uid() or public.is_admin());
drop policy if exists "conversations participant update" on public.conversations;
create policy "conversations participant update" on public.conversations for update using (user_id=auth.uid() or astrologer_id=auth.uid() or admin_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or astrologer_id=auth.uid() or admin_id=auth.uid() or public.is_admin());
drop policy if exists "messages participants" on public.messages;
create policy "messages participants" on public.messages for select using (exists(select 1 from public.conversations c where c.id=conversation_id and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid())) or public.is_admin());
drop policy if exists "messages sender insert" on public.messages;
create policy "messages sender insert" on public.messages for insert with check (sender_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and c.status='accepted' and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid())));
