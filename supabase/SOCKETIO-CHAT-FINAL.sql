-- Bhavishya Gyani: Socket.IO + Supabase permanent chat migration
-- Run once AFTER the existing Supabase setup files.
-- Existing users, conversations and messages are preserved.

alter table public.conversations
  alter column astrologer_id drop not null;

alter table public.conversations
  add column if not exists admin_id uuid references public.profiles(id) on delete set null;

alter table public.conversations
  add column if not exists channel text not null default 'chat';

alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists idx_conversations_admin_status
  on public.conversations(admin_id,status,created_at desc);

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id,created_at);

-- Keep Supabase Auth -> profiles synchronized for existing/future Auth users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(id,full_name,email,phone)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.email,
    nullif(new.raw_user_meta_data->>'phone','')
  )
  on conflict(id) do update set
    email=coalesce(excluded.email,public.profiles.email),
    full_name=case when coalesce(excluded.full_name,'')<>'' then excluded.full_name else public.profiles.full_name end,
    phone=coalesce(excluded.phone,public.profiles.phone),
    updated_at=now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill profile email for Auth users that already exist.
update public.profiles p
set email=u.email, updated_at=now()
from auth.users u
where u.id=p.id and (p.email is null or p.email='');

-- RLS: a user sees only own conversations; an astrologer sees only assigned conversations;
-- an admin can manage/read all conversations and messages.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "bg conversations select" on public.conversations;
create policy "bg conversations select"
on public.conversations for select to authenticated
using (
  user_id=auth.uid()
  or astrologer_id=auth.uid()
  or admin_id=auth.uid()
  or public.is_admin()
);

drop policy if exists "bg conversations insert" on public.conversations;
create policy "bg conversations insert"
on public.conversations for insert to authenticated
with check (user_id=auth.uid() or public.is_admin());

drop policy if exists "bg conversations update" on public.conversations;
create policy "bg conversations update"
on public.conversations for update to authenticated
using (
  user_id=auth.uid() or astrologer_id=auth.uid() or admin_id=auth.uid() or public.is_admin()
)
with check (
  user_id=auth.uid() or astrologer_id=auth.uid() or admin_id=auth.uid() or public.is_admin()
);

drop policy if exists "bg messages select" on public.messages;
create policy "bg messages select"
on public.messages for select to authenticated
using (
  exists(
    select 1 from public.conversations c
    where c.id=conversation_id
      and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid() or public.is_admin())
  )
);

drop policy if exists "bg messages insert" on public.messages;
create policy "bg messages insert"
on public.messages for insert to authenticated
with check (
  sender_id=auth.uid()
  and exists(
    select 1 from public.conversations c
    where c.id=conversation_id
      and c.status='accepted'
      and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid() or public.is_admin())
  )
);

drop policy if exists "bg messages update read" on public.messages;
create policy "bg messages update read"
on public.messages for update to authenticated
using (
  exists(
    select 1 from public.conversations c
    where c.id=conversation_id
      and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid() or public.is_admin())
  )
)
with check (
  exists(
    select 1 from public.conversations c
    where c.id=conversation_id
      and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid() or public.is_admin())
  )
);

-- Data API grants; RLS remains the security boundary.
grant select,insert,update on public.conversations to authenticated;
grant select,insert,update on public.messages to authenticated;
grant select on public.profiles to authenticated;
grant select on public.astrologers to authenticated;

-- Socket.IO is the transport; Supabase remains the permanent database of record.
-- If you also use Supabase Realtime elsewhere, keep its publication unchanged.
