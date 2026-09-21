-- Bhavishya Gyani: FINAL CHAT / AUTH / REALTIME setup
-- Safe and additive. Existing users, astrologers, conversations and messages are preserved.
create extension if not exists pgcrypto;

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists blocked boolean not null default false;
alter table public.profiles add column if not exists blocked_reason text;
alter table public.profiles add column if not exists blocked_at timestamptz;

-- Existing schema originally made astrologer_id NOT NULL. Admin-support conversations need it nullable.
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='conversations' and column_name='astrologer_id' and is_nullable='NO') then
    execute 'alter table public.conversations alter column astrologer_id drop not null';
  end if;
end $$;

alter table public.conversations add column if not exists admin_id uuid;
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

alter table public.messages add column if not exists read_at timestamptz;

alter table public.astrologers add column if not exists online boolean not null default false;
alter table public.astrologers add column if not exists chat_enabled boolean not null default true;
alter table public.astrologers add column if not exists call_enabled boolean not null default false;
alter table public.astrologers add column if not exists video_enabled boolean not null default false;
alter table public.astrologers add column if not exists boosted boolean not null default false;
alter table public.astrologers add column if not exists education text default '';
alter table public.astrologers add column if not exists rating_avg numeric(4,2) not null default 0;
alter table public.astrologers add column if not exists completed_chats integer not null default 0;
alter table public.astrologers add column if not exists rank_score numeric(8,2) not null default 0;
alter table public.astrologers add column if not exists rank_position integer;

-- FK is added only when it does not already exist.
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.conversations'::regclass and conname='conversations_admin_id_fkey') then
   alter table public.conversations add constraint conversations_admin_id_fkey foreign key(admin_id) references public.profiles(id) on delete set null;
 end if;
end $$;

create index if not exists idx_bg_conv_user_created on public.conversations(user_id,created_at desc);
create index if not exists idx_bg_conv_astro_created on public.conversations(astrologer_id,created_at desc);
create index if not exists idx_bg_conv_admin_created on public.conversations(admin_id,created_at desc);
create index if not exists idx_bg_messages_conv_created on public.messages(conversation_id,created_at);
create index if not exists idx_bg_astro_availability on public.astrologers(verified,online,chat_enabled);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,full_name,email,phone)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email,coalesce(new.raw_user_meta_data->>'phone',new.phone))
 on conflict(id) do update set email=coalesce(excluded.email,public.profiles.email),full_name=case when coalesce(excluded.full_name,'')<>'' then excluded.full_name else public.profiles.full_name end,phone=coalesce(excluded.phone,public.profiles.phone),updated_at=now();
 return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

update public.profiles p set email=coalesce(u.email,p.email),full_name=coalesce(nullif(u.raw_user_meta_data->>'full_name',''),p.full_name),phone=coalesce(u.raw_user_meta_data->>'phone',u.phone,p.phone),updated_at=now() from auth.users u where p.id=u.id;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists bg_conv_select on public.conversations;
create policy bg_conv_select on public.conversations for select to authenticated using(user_id=auth.uid() or astrologer_id=auth.uid() or admin_id=auth.uid() or public.is_admin());
drop policy if exists bg_conv_insert on public.conversations;
create policy bg_conv_insert on public.conversations for insert to authenticated with check(user_id=auth.uid() or public.is_admin());
drop policy if exists bg_conv_update on public.conversations;
create policy bg_conv_update on public.conversations for update to authenticated using(user_id=auth.uid() or astrologer_id=auth.uid() or admin_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or astrologer_id=auth.uid() or admin_id=auth.uid() or public.is_admin());

drop policy if exists bg_msg_select on public.messages;
create policy bg_msg_select on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=messages.conversation_id and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid() or public.is_admin())));
drop policy if exists bg_msg_insert on public.messages;
create policy bg_msg_insert on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.conversations c where c.id=messages.conversation_id and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid() or public.is_admin())));
drop policy if exists bg_msg_update on public.messages;
create policy bg_msg_update on public.messages for update to authenticated using(exists(select 1 from public.conversations c where c.id=messages.conversation_id and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid() or public.is_admin()))) with check(exists(select 1 from public.conversations c where c.id=messages.conversation_id and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid() or public.is_admin())));

grant select,insert,update on public.conversations to authenticated;
grant select,insert,update on public.messages to authenticated;
grant select on public.profiles to authenticated;
grant select on public.astrologers to authenticated;

alter table public.conversations replica identity full;
alter table public.messages replica identity full;

do $$ begin
 begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; when undefined_object then null; end;
 begin alter publication supabase_realtime add table public.conversations; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

-- Private broadcast topics: chat:<conversation UUID>. Access is checked against conversation participants.
drop policy if exists bg_realtime_read on realtime.messages;
create policy bg_realtime_read on realtime.messages for select to authenticated using(realtime.topic() like 'chat:%' and exists(select 1 from public.conversations c where c.id=(substring(realtime.topic() from 6))::uuid and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid() or public.is_admin())));
drop policy if exists bg_realtime_write on realtime.messages;
create policy bg_realtime_write on realtime.messages for insert to authenticated with check(realtime.topic() like 'chat:%' and exists(select 1 from public.conversations c where c.id=(substring(realtime.topic() from 6))::uuid and (c.user_id=auth.uid() or c.astrologer_id=auth.uid() or c.admin_id=auth.uid() or public.is_admin())));

-- Finished. No existing chat/user data is deleted.
