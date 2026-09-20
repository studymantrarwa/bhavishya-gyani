-- Bhavishya Gyani: Chat availability + realtime safety migration
-- Additive only. Does not delete users, astrologers, conversations or messages.

alter table public.astrologers add column if not exists online boolean not null default false;
alter table public.astrologers add column if not exists chat_enabled boolean not null default true;

create index if not exists idx_astrologers_chat_availability
on public.astrologers(verified, online, chat_enabled);

-- Participants can read their conversations; the server gateway performs writes with the service role.
drop policy if exists "conversations participants" on public.conversations;
create policy "conversations participants" on public.conversations
for select using (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin());

-- Participants can read their messages.
drop policy if exists "messages participants" on public.messages;
create policy "messages participants" on public.messages
for select using (
  exists (
    select 1 from public.conversations c
    where c.id=conversation_id
      and (c.user_id=auth.uid() or c.astrologer_id=auth.uid())
  ) or public.is_admin()
);

-- Realtime private chat authorization. Only participants of chat:<conversation_uuid> may join.
drop policy if exists "study mantra chat realtime read" on realtime.messages;
create policy "study mantra chat realtime read"
on realtime.messages for select to authenticated
using (
  realtime.topic() ~ '^chat:[0-9a-fA-F-]{36}$'
  and exists (
    select 1 from public.conversations c
    where c.id = substring(realtime.topic() from 6)::uuid
      and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or public.is_admin())
  )
);

drop policy if exists "study mantra chat realtime write" on realtime.messages;
create policy "study mantra chat realtime write"
on realtime.messages for insert to authenticated
with check (
  realtime.topic() ~ '^chat:[0-9a-fA-F-]{36}$'
  and exists (
    select 1 from public.conversations c
    where c.id = substring(realtime.topic() from 6)::uuid
      and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or public.is_admin())
  )
);
