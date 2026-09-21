-- BHAVISHYA GYANI V20 — FRESH RESET DATABASE
-- WARNING: This intentionally removes the old application data and old test auth users.
-- Run this once in Supabase SQL Editor for a clean start.

create extension if not exists pgcrypto;

-- Remove old application objects first.
drop view if exists public.profiles cascade;
drop table if exists public.profiles cascade;
drop table if exists public.app_feedback cascade;
drop table if exists public.admin_audit_logs cascade;
drop table if exists public.platform_settings cascade;
drop table if exists public.notifications cascade;
drop table if exists public.reviews cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop table if exists public.payments cascade;
drop table if exists public.astrologer_follows cascade;
drop table if exists public.astrologer_earnings cascade;
drop table if exists public.astrologer_performance_daily cascade;
drop table if exists public.astrologer_leaves cascade;
drop table if exists public.support_tickets cascade;
drop table if exists public.astrologer_documents cascade;
drop table if exists public.astrologer_applications cascade;
drop table if exists public.kundalis cascade;
drop table if exists public.astrologers cascade;
drop table if exists public.user_profiles cascade;
drop table if exists public.admin_profiles cascade;
drop table if exists public.user_accounts cascade;
drop table if exists public.astrologer_accounts cascade;
drop table if exists public.admin_accounts cascade;
drop table if exists public.system_settings cascade;

-- Delete old Supabase Auth test users. This project version uses its own role-separated auth tables.
delete from auth.users;

-- =====================
-- THREE COMPLETELY SEPARATE ACCOUNT SYSTEMS
-- =====================
create table public.user_accounts(
 id uuid primary key,
 email text not null unique,
 phone text not null unique,
 password_hash text not null,
 password_salt text not null,
 full_name text not null default '',
 blocked boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.astrologer_accounts(
 id uuid primary key,
 email text not null unique,
 phone text not null unique,
 password_hash text not null,
 password_salt text not null,
 full_name text not null default '',
 approved boolean not null default false,
 blocked boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.admin_accounts(
 id uuid primary key,
 email text not null unique,
 phone text not null unique,
 password_hash text not null,
 password_salt text not null,
 full_name text not null default '',
 blocked boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.user_profiles(
 id uuid primary key references public.user_accounts(id) on delete cascade,
 full_name text not null default '',
 avatar_url text,
 referral_code text unique,
 referred_by uuid references public.user_accounts(id) on delete set null,
 reward_points integer not null default 0,
 blocked boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.admin_profiles(
 id uuid primary key references public.admin_accounts(id) on delete cascade,
 full_name text not null default '',
 avatar_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

-- Astrologer data is completely separate from User/Admin data.
create table public.astrologers(
 id uuid primary key references public.astrologer_accounts(id) on delete cascade,
 full_name text not null default '',
 avatar_url text,
 bio text default '',
 education text default '',
 experience_years integer not null default 0,
 expertise text[] not null default '{}',
 languages text[] not null default '{}',
 fee numeric(12,2) not null default 0,
 discount numeric(5,2) not null default 0,
 online boolean not null default false,
 last_seen timestamptz,
 verified boolean not null default false,
 approved_at timestamptz,
 call_enabled boolean not null default false,
 chat_enabled boolean not null default true,
 video_enabled boolean not null default false,
 boosted boolean not null default false,
 followers integer not null default 0,
 followers_count integer not null default 0,
 rating_avg numeric(4,2) not null default 0,
 rank_score numeric(8,2) not null default 0,
 rank_position integer,
 completed_chats integer not null default 0,
 accepted_requests integer not null default 0,
 missed_requests integer not null default 0,
 response_seconds_avg numeric(10,2) not null default 0,
 blocked boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.astrologer_applications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 education text default '', bio text default '', experience_years integer not null default 0,
 expertise text[] not null default '{}', languages text[] not null default '{}',
 requested_fee numeric(12,2) not null default 0, avatar_url text,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 admin_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index astrologer_application_pending_uidx on public.astrologer_applications(user_id) where status='pending';

create table public.kundalis(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_accounts(id) on delete cascade,
 name text not null, gender text, dob date not null, birth_time time not null, place text not null,
 latitude numeric(10,7) not null, longitude numeric(10,7) not null, timezone numeric(4,2) not null default 5.50,
 ayanamsa text not null default 'Lahiri', calculation_data jsonb not null default '{}', created_at timestamptz not null default now()
);

create table public.conversations(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.user_accounts(id) on delete cascade,
 astrologer_id uuid references public.astrologer_accounts(id) on delete set null,
 admin_id uuid references public.admin_accounts(id) on delete set null,
 status text not null default 'requested', channel text not null default 'chat',
 requested_at timestamptz not null default now(), astrologer_accepted_at timestamptz,
 user_confirm_deadline timestamptz, user_confirmed_at timestamptz, accepted_at timestamptz,
 closed_at timestamptz, missed_by text, astrologer_response_seconds integer, user_confirm_response_seconds integer,
 last_message_at timestamptz, fee_snapshot numeric(12,2) default 0, discount_snapshot numeric(5,2) default 0,
 retention_until timestamptz, created_at timestamptz not null default now()
);

create table public.messages(
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null, body text not null, kundali_id uuid references public.kundalis(id) on delete set null,
 read_at timestamptz, created_at timestamptz not null default now()
);

create table public.reviews(
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references public.user_accounts(id) on delete cascade,
 astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 rating integer not null check(rating between 1 and 5), review text,
 moderation_status text not null default 'approved', admin_note text, created_at timestamptz not null default now(),
 unique(conversation_id,user_id)
);

create table public.astrologer_follows(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.user_accounts(id) on delete cascade,
 astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 created_at timestamptz not null default now(), unique(user_id,astrologer_id)
);

create table public.notifications(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.user_accounts(id) on delete cascade,
 title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now()
);

create table public.payments(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.user_accounts(id) on delete cascade,
 astrologer_id uuid references public.astrologer_accounts(id) on delete set null,
 conversation_id uuid references public.conversations(id) on delete set null, amount numeric(12,2) not null default 0,
 currency text not null default 'INR', method text not null default 'manual', reference text, proof_url text,
 status text not null default 'pending' check(status in ('pending','approved','rejected','refunded')),
 admin_note text, approved_by uuid references public.admin_accounts(id) on delete set null, approved_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.astrologer_earnings(
 id uuid primary key default gen_random_uuid(), astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 amount numeric(12,2) not null default 0, category text not null default 'service', earned_at timestamptz not null default now()
);
create table public.astrologer_performance_daily(
 id uuid primary key default gen_random_uuid(), astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 day date not null, chat_quality numeric, live_hours numeric, call_pickup_rate numeric, chat_pickup_rate numeric,
 conversion_rate numeric, response_time_sec numeric, login_hours numeric, unique(astrologer_id,day)
);
create table public.astrologer_leaves(
 id uuid primary key default gen_random_uuid(), astrologer_id uuid not null references public.astrologer_accounts(id) on delete cascade,
 from_date date not null, to_date date not null, reason text, status text not null default 'pending', created_at timestamptz not null default now()
);
create table public.support_tickets(
 id uuid primary key default gen_random_uuid(), user_id uuid, subject text not null, message text, status text not null default 'open', created_at timestamptz not null default now()
);
create table public.app_feedback(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.user_accounts(id) on delete cascade,
 rating integer not null check(rating between 1 and 5), feedback text, created_at timestamptz not null default now()
);
create table public.platform_settings(
 key text primary key, value jsonb not null default '{}', updated_by uuid references public.admin_accounts(id) on delete set null, updated_at timestamptz not null default now()
);
create table public.admin_audit_logs(
 id uuid primary key default gen_random_uuid(), admin_id uuid not null references public.admin_accounts(id) on delete cascade,
 action text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.system_settings(
 key text primary key, value text not null, updated_at timestamptz not null default now()
);
insert into public.system_settings(key,value) values('admin_registration_code','1234') on conflict(key) do update set value='1234',updated_at=now();

-- Compatibility read view only. Source data remains in the three independent profile systems.
create view public.profiles as
select u.id,u.full_name,a.email,a.phone,p.avatar_url,p.blocked,'user'::text as role,p.referral_code,p.referred_by,p.reward_points,p.created_at,p.updated_at from public.user_accounts a join public.user_profiles p on p.id=a.id join public.user_accounts u on u.id=a.id
union all
select a.id,a.full_name,a.email,a.phone,a2.avatar_url,a2.blocked,'astrologer'::text,a2.full_name,null,0,a2.created_at,a2.updated_at from public.astrologer_accounts a join public.astrologers a2 on a2.id=a.id
union all
select a.id,a.full_name,a.email,a.phone,p.avatar_url,a.blocked,'admin'::text,null,null,0,p.created_at,p.updated_at from public.admin_accounts a join public.admin_profiles p on p.id=a.id;

-- The app server uses service-role access. RLS is enabled to prevent accidental browser-side access if tables are exposed.
DO $$ DECLARE t text; BEGIN FOR t IN SELECT unnest(ARRAY['user_accounts','user_profiles','astrologer_accounts','astrologers','astrologer_applications','admin_accounts','admin_profiles','kundalis','conversations','messages','reviews','astrologer_follows','notifications','payments','astrologer_earnings','astrologer_performance_daily','astrologer_leaves','support_tickets','app_feedback','platform_settings','admin_audit_logs','system_settings']) LOOP EXECUTE format('alter table public.%I enable row level security',t); END LOOP; END $$;

create index idx_user_accounts_email on public.user_accounts(email);
create index idx_user_accounts_phone on public.user_accounts(phone);
create index idx_astro_accounts_email on public.astrologer_accounts(email);
create index idx_astro_accounts_phone on public.astrologer_accounts(phone);
create index idx_admin_accounts_email on public.admin_accounts(email);
create index idx_admin_accounts_phone on public.admin_accounts(phone);
create index idx_astrologers_rank on public.astrologers(rank_score desc,rating_avg desc);
create index idx_astrologers_presence on public.astrologers(online,last_seen desc);
create index idx_apps_status on public.astrologer_applications(status,created_at desc);
create index idx_conv_user on public.conversations(user_id,status,created_at desc);
create index idx_conv_astro on public.conversations(astrologer_id,status,created_at desc);
create index idx_messages_conv on public.messages(conversation_id,created_at);

insert into public.platform_settings(key,value) values
('chat_rules','{"astrologer_accept_seconds":120,"user_confirm_seconds":120,"chat_retention_seconds":172800,"auto_miss":true}'::jsonb),
('rank_rules','{"rating_weight":35,"completion_weight":20,"acceptance_weight":20,"response_weight":15,"reliability_weight":10}'::jsonb)
on conflict(key) do nothing;

-- Never expose the compatibility profile view directly to browser clients.
revoke all on public.profiles from anon, authenticated;
