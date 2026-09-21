-- Bhavishya Gyani — Socket.IO + Supabase Chat FINAL FIX
-- Safe/idempotent migration for the existing project.
-- Does NOT delete existing users, conversations or messages.

create extension if not exists pgcrypto;

-- 1) Make sure profile contact columns exist.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;

-- 2) Allow User ↔ Admin conversations.
-- This block only removes NOT NULL if astrologer_id is currently NOT NULL.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='conversations'
      and column_name='astrologer_id'
      and is_nullable='NO'
  ) then
    execute 'alter table public.conversations alter column astrologer_id drop not null';
  end if;
end
$$;

-- 3) Add admin chat fields.
alter table public.conversations
  add column if not exists admin_id uuid;

alter table public.conversations
  add column if not exists channel text not null default 'chat';

-- Add the FK only when it is not already present.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.conversations'::regclass
      and conname='conversations_admin_id_fkey'
  ) then
    alter table public.conversations
      add constraint conversations_admin_id_fkey
      foreign key (admin_id) references public.profiles(id)
      on delete set null;
  end if;
end
$$;

-- 4) Message read receipt.
alter table public.messages
  add column if not exists read_at timestamptz;

-- 5) Useful indexes.
create index if not exists idx_conversations_user_created
  on public.conversations(user_id, created_at desc);

create index if not exists idx_conversations_astrologer_created
  on public.conversations(astrologer_id, created_at desc);

create index if not exists idx_conversations_admin_created
  on public.conversations(admin_id, created_at desc);

create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at);

-- 6) Ensure admin helper exists.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.profiles
    where id=auth.uid() and role='admin'
  );
$$;

-- 7) Keep Auth users linked to their existing profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.profiles(id, full_name, email, phone)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', new.phone)
  )
  on conflict(id) do update set
    email=coalesce(excluded.email, public.profiles.email),
    full_name=case
      when coalesce(excluded.full_name,'') <> ''
      then excluded.full_name
      else public.profiles.full_name
    end,
    phone=coalesce(excluded.phone, public.profiles.phone),
    updated_at=now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- 8) Backfill email for existing Auth users.
update public.profiles p
set
  email=coalesce(u.email,p.email),
  full_name=coalesce(nullif(u.raw_user_meta_data->>'full_name',''),p.full_name),
  phone=coalesce(u.raw_user_meta_data->>'phone',u.phone,p.phone),
  updated_at=now()
from auth.users u
where p.id=u.id;

-- 9) RLS.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "bg conversations select" on public.conversations;
create policy "bg conversations select"
on public.conversations
for select
to authenticated
using (
  user_id=auth.uid()
  or astrologer_id=auth.uid()
  or admin_id=auth.uid()
  or public.is_admin()
);

drop policy if exists "bg conversations insert" on public.conversations;
create policy "bg conversations insert"
on public.conversations
for insert
to authenticated
with check (
  user_id=auth.uid()
  or public.is_admin()
);

drop policy if exists "bg conversations update" on public.conversations;
create policy "bg conversations update"
on public.conversations
for update
to authenticated
using (
  user_id=auth.uid()
  or astrologer_id=auth.uid()
  or admin_id=auth.uid()
  or public.is_admin()
)
with check (
  user_id=auth.uid()
  or astrologer_id=auth.uid()
  or admin_id=auth.uid()
  or public.is_admin()
);

drop policy if exists "bg messages select" on public.messages;
create policy "bg messages select"
on public.messages
for select
to authenticated
using (
  exists(
    select 1
    from public.conversations c
    where c.id=messages.conversation_id
      and (
        c.user_id=auth.uid()
        or c.astrologer_id=auth.uid()
        or c.admin_id=auth.uid()
        or public.is_admin()
      )
  )
);

drop policy if exists "bg messages insert" on public.messages;
create policy "bg messages insert"
on public.messages
for insert
to authenticated
with check (
  sender_id=auth.uid()
  and exists(
    select 1
    from public.conversations c
    where c.id=messages.conversation_id
      and (
        c.user_id=auth.uid()
        or c.astrologer_id=auth.uid()
        or c.admin_id=auth.uid()
        or public.is_admin()
      )
  )
);

drop policy if exists "bg messages update read" on public.messages;
create policy "bg messages update read"
on public.messages
for update
to authenticated
using (
  exists(
    select 1
    from public.conversations c
    where c.id=messages.conversation_id
      and (
        c.user_id=auth.uid()
        or c.astrologer_id=auth.uid()
        or c.admin_id=auth.uid()
        or public.is_admin()
      )
  )
)
with check (
  exists(
    select 1
    from public.conversations c
    where c.id=messages.conversation_id
      and (
        c.user_id=auth.uid()
        or c.astrologer_id=auth.uid()
        or c.admin_id=auth.uid()
        or public.is_admin()
      )
  )
);

-- 10) Permissions. RLS remains the security boundary.
grant select, insert, update on public.conversations to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select on public.profiles to authenticated;
grant select on public.astrologers to authenticated;

-- 11) Keep existing Supabase Realtime setup usable.
alter table public.conversations replica identity full;
alter table public.messages replica identity full;

-- Finished.
