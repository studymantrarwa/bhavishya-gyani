alter table public.astrologer_applications add column if not exists education text default '';
-- Bhavishya Gyani Astrology: production chat/ranking/admin additive migration
-- Run AFTER schema.sql, astrologer-dashboard.sql and admin-panel.sql.

alter table public.profiles add column if not exists blocked boolean not null default false;
alter table public.profiles add column if not exists blocked_reason text;
alter table public.profiles add column if not exists blocked_at timestamptz;

alter table public.astrologers add column if not exists rank_score numeric(6,2) not null default 0;
alter table public.astrologers add column if not exists rank_position integer;
alter table public.astrologers add column if not exists rating_avg numeric(4,2) not null default 0;
alter table public.astrologers add column if not exists completed_chats integer not null default 0;
alter table public.astrologers add column if not exists accepted_requests integer not null default 0;
alter table public.astrologers add column if not exists missed_requests integer not null default 0;
alter table public.astrologers add column if not exists response_seconds_avg numeric(10,2) not null default 0;

alter table public.conversations add column if not exists requested_at timestamptz not null default now();
alter table public.conversations add column if not exists astrologer_accepted_at timestamptz;
alter table public.conversations add column if not exists user_confirm_deadline timestamptz;
alter table public.conversations add column if not exists user_confirmed_at timestamptz;
alter table public.conversations add column if not exists accepted_at timestamptz;
alter table public.conversations add column if not exists missed_by text check (missed_by is null or missed_by in ('user','astrologer'));
alter table public.conversations add column if not exists astrologer_response_seconds integer;
alter table public.conversations add column if not exists user_confirm_response_seconds integer;
alter table public.conversations add column if not exists last_message_at timestamptz;
alter table public.conversations add column if not exists fee_snapshot numeric(12,2) default 0;
alter table public.conversations add column if not exists discount_snapshot numeric(5,2) default 0;

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

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;
alter table public.platform_settings enable row level security;
alter table public.admin_actions enable row level security;

drop policy if exists "payments own or admin read" on public.payments;
create policy "payments own or admin read" on public.payments for select using (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin());
drop policy if exists "payments own insert" on public.payments;
create policy "payments own insert" on public.payments for insert with check (user_id=auth.uid());
drop policy if exists "payments admin update" on public.payments;
create policy "payments admin update" on public.payments for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings admin" on public.platform_settings;
create policy "settings admin" on public.platform_settings for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin actions read" on public.admin_actions;
create policy "admin actions read" on public.admin_actions for select using (public.is_admin());
drop policy if exists "admin actions insert" on public.admin_actions;
create policy "admin actions insert" on public.admin_actions for insert with check (public.is_admin() and admin_id=auth.uid());

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update using (public.is_admin() or id=auth.uid()) with check (public.is_admin() or id=auth.uid());

drop policy if exists "conversations participant update" on public.conversations;
create policy "conversations participant update" on public.conversations for update using (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin());

drop policy if exists "conversations participant insert" on public.conversations;
create policy "conversations participant insert" on public.conversations for insert with check (user_id=auth.uid() or public.is_admin());

alter table public.messages replica identity full;
alter table public.conversations replica identity full;

create index if not exists idx_conversations_request_window on public.conversations(status, requested_at desc);
create index if not exists idx_conversations_astrologer on public.conversations(astrologer_id, status, created_at desc);
create index if not exists idx_conversations_user on public.conversations(user_id, status, created_at desc);
create index if not exists idx_payments_status on public.payments(status, created_at desc);
create index if not exists idx_profiles_blocked on public.profiles(blocked);
create index if not exists idx_astrologers_rank on public.astrologers(rank_score desc, rating_avg desc);

insert into public.platform_settings(key,value)
values
 ('chat_rules','{"astrologer_accept_seconds":120,"user_confirm_seconds":120,"auto_miss":true}'::jsonb),
 ('rank_rules','{"rating_weight":35,"completion_weight":20,"acceptance_weight":20,"response_weight":15,"reliability_weight":10}'::jsonb)
on conflict (key) do nothing;

-- Private Realtime chat channel authorization (chat:<conversation_uuid>)
drop policy if exists "chat participants realtime read" on realtime.messages;
create policy "chat participants realtime read" on realtime.messages for select to authenticated using (
  realtime.topic() like 'chat:%' and exists (select 1 from public.conversations c where c.id = (substring(realtime.topic() from 6))::uuid and (c.user_id = auth.uid() or c.astrologer_id = auth.uid() or public.is_admin()))
);
drop policy if exists "chat participants realtime write" on realtime.messages;
create policy "chat participants realtime write" on realtime.messages for insert to authenticated with check (
  realtime.topic() like 'chat:%' and exists (select 1 from public.conversations c where c.id = (substring(realtime.topic() from 6))::uuid and (c.user_id = auth.uid() or c.astrologer_id = auth.uid() or public.is_admin()))
);
