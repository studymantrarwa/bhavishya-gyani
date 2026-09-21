-- Bhavishya Gyani — Fresh independent account system
-- IMPORTANT: This script resets the application's public tables only.
-- Supabase Auth (auth.users) is NOT used by Bhavishya Gyani login after this setup.
-- Same email/mobile can therefore exist once in EACH account type:
-- user + astrologer + admin. Within the same type email/mobile stays unique.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('user','astrologer','admin');
exception when duplicate_object then null; end $$;

-- Fresh application reset. This does not delete auth.users.
drop table if exists public.messages cascade;
drop table if exists public.reviews cascade;
drop table if exists public.notifications cascade;
drop table if exists public.kundalis cascade;
drop table if exists public.conversations cascade;
drop table if exists public.astrologer_documents cascade;
drop table if exists public.astrologer_follows cascade;
drop table if exists public.astrologer_applications cascade;
drop table if exists public.payments cascade;
drop table if exists public.admin_audit_logs cascade;
drop table if exists public.platform_settings cascade;
drop table if exists public.astrologers cascade;
drop table if exists public.account_credentials cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  email text not null,
  phone text,
  avatar_url text,
  role public.app_role not null,
  blocked boolean not null default false,
  blocked_reason text,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_credentials (
  id uuid primary key references public.profiles(id) on delete cascade,
  account_type public.app_role not null,
  email text not null,
  phone text,
  password_hash text not null,
  password_salt text not null,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(account_type,email),
  unique(account_type,phone)
);
create index idx_account_credentials_email on public.account_credentials(lower(email));

create table public.astrologers (
  id uuid primary key references public.profiles(id) on delete cascade,
  bio text default '',
  experience_years integer not null default 0,
  expertise text[] not null default '{}',
  languages text[] not null default '{}',
  fee numeric(12,2) not null default 0,
  discount numeric(5,2) not null default 0,
  online boolean not null default false,
  verified boolean not null default false,
  approved_at timestamptz,
  rank_score numeric(6,2) not null default 0,
  rank_position integer,
  rating_avg numeric(4,2) not null default 0,
  completed_chats integer not null default 0,
  accepted_requests integer not null default 0,
  missed_requests integer not null default 0,
  response_seconds_avg numeric(10,2) not null default 0,
  call_enabled boolean not null default false,
  chat_enabled boolean not null default true,
  video_enabled boolean not null default false,
  boosted boolean not null default false,
  followers integer not null default 0,
  education text default '',
  avatar_url text,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

create table public.astrologer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  bio text default '',
  education text default '',
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

create table public.astrologer_documents (
  id uuid primary key default gen_random_uuid(),
  astrologer_id uuid not null references public.astrologers(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.kundalis (
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

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  astrologer_id uuid references public.astrologers(id) on delete cascade,
  admin_id uuid references public.profiles(id) on delete set null,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  astrologer_accepted_at timestamptz,
  user_confirm_deadline timestamptz,
  user_confirmed_at timestamptz,
  accepted_at timestamptz,
  missed_by text,
  astrologer_response_seconds integer,
  user_confirm_response_seconds integer,
  last_message_at timestamptz,
  fee_snapshot numeric(12,2) default 0,
  discount_snapshot numeric(5,2) default 0,
  channel text not null default 'chat',
  retention_until timestamptz,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  kundali_id uuid references public.kundalis(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  astrologer_id uuid not null references public.astrologers(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review text,
  moderation_status text not null default 'approved',
  admin_note text,
  created_at timestamptz not null default now(),
  unique(conversation_id,user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.astrologer_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  astrologer_id uuid not null references public.astrologers(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id,astrologer_id)
);

create table public.payments (
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

create table public.platform_settings(
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.admin_audit_logs(
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Default admin registration code. Change it later from Admin Settings/SQL if needed.
insert into public.platform_settings(key,value)
values ('admin_registration_code','"1234"'::jsonb),
       ('chat_rules','{"astrologer_accept_seconds":120,"user_confirm_seconds":120,"chat_retention_seconds":172800,"auto_miss":true}'::jsonb),
       ('rank_rules','{"rating_weight":35,"completion_weight":20,"acceptance_weight":20,"response_weight":15,"reliability_weight":10}'::jsonb);

-- Server-side API is the only data access path. RLS is enabled with no public policies;
-- the service-role key used by Vercel Functions bypasses RLS.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','account_credentials','astrologers','astrologer_applications','astrologer_documents','kundalis','conversations','messages','reviews','notifications','astrologer_follows','payments','platform_settings','admin_audit_logs'] LOOP
    EXECUTE format('alter table public.%I enable row level security',t);
  END LOOP;
END $$;

create index idx_profiles_role on public.profiles(role,created_at desc);
create index idx_profiles_email on public.profiles(lower(email));
create index idx_apps_status on public.astrologer_applications(status,created_at desc);
create index idx_conv_astrologer_status on public.conversations(astrologer_id,status,created_at desc);
create index idx_conv_user_status on public.conversations(user_id,status,created_at desc);
create index idx_astrologers_rank on public.astrologers(rank_score desc,rating_avg desc);
create index idx_astrologers_presence on public.astrologers(online,last_seen desc);
create index idx_payments_status on public.payments(status,created_at desc);

alter table public.messages replica identity full;
alter table public.conversations replica identity full;
