-- Bhavishya Gyani: Chat + Storage + Data API stability fix
-- Run this AFTER your existing schema. This script deliberately does NOT create/alter the managed storage schema.

-- Chat columns
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

-- Required browser Data API grants. RLS still controls which rows are accessible.
grant select, insert, update on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.profiles to authenticated;
grant select on public.astrologers to authenticated;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations participants" on public.conversations;
create policy "conversations participants" on public.conversations
for select to authenticated
using (user_id = auth.uid() or astrologer_id = auth.uid());

drop policy if exists "conversations user insert" on public.conversations;
create policy "conversations user insert" on public.conversations
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "conversations participant update" on public.conversations;
create policy "conversations participant update" on public.conversations
for update to authenticated
using (user_id = auth.uid() or astrologer_id = auth.uid())
with check (user_id = auth.uid() or astrologer_id = auth.uid());

drop policy if exists "messages participants" on public.messages;
create policy "messages participants" on public.messages
for select to authenticated
using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.user_id = auth.uid() or c.astrologer_id = auth.uid())));

drop policy if exists "messages sender insert" on public.messages;
create policy "messages sender insert" on public.messages
for insert to authenticated
with check (sender_id = auth.uid() and exists (select 1 from public.conversations c where c.id = conversation_id and c.status = 'accepted' and (c.user_id = auth.uid() or c.astrologer_id = auth.uid())));

-- Realtime: manage policies on realtime.messages only. Never CREATE the realtime/storage schema.
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.conversations; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

-- If your project uses private Realtime channels, these policies authorize chat:<conversation_uuid> topics.
drop policy if exists "chat participants realtime read" on realtime.messages;
create policy "chat participants realtime read" on realtime.messages
for select to authenticated
using (
  realtime.topic() like 'chat:%' and exists (
    select 1 from public.conversations c
    where ('chat:' || c.id::text) = realtime.topic()
      and (c.user_id = auth.uid() or c.astrologer_id = auth.uid())
  )
);

drop policy if exists "chat participants realtime write" on realtime.messages;
create policy "chat participants realtime write" on realtime.messages
for insert to authenticated
with check (
  realtime.topic() like 'chat:%' and exists (
    select 1 from public.conversations c
    where ('chat:' || c.id::text) = realtime.topic()
      and (c.user_id = auth.uid() or c.astrologer_id = auth.uid())
  )
);

-- IMPORTANT: Storage is managed by Supabase. Create the bucket from Dashboard > Storage if you need photos.
-- Do NOT run INSERT INTO storage.buckets from this script.
