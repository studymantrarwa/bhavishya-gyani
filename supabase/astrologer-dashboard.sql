-- Bhavishya Gyani Astrologer Dashboard migration
-- Safe additive migration: does not delete existing kundli/chat/numerology/panchang data.

alter table public.profiles add column if not exists email text;

create table if not exists public.astrologer_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  bio text default '',
  experience_years integer not null default 0,
  expertise text[] not null default '{}',
  languages text[] not null default '{}',
  requested_fee numeric(12,2) not null default 0,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.astrologer_applications enable row level security;
drop policy if exists "applications own read" on public.astrologer_applications;
create policy "applications own read" on public.astrologer_applications for select using (user_id=auth.uid() or public.is_admin());
drop policy if exists "applications own insert" on public.astrologer_applications;
create policy "applications own insert" on public.astrologer_applications for insert with check (user_id=auth.uid());
drop policy if exists "applications own update" on public.astrologer_applications;
create policy "applications own update" on public.astrologer_applications for update using (user_id=auth.uid() or public.is_admin());

-- Existing astrologers need a safe read of their own records.
drop policy if exists "astrologers own read" on public.astrologers;
create policy "astrologers own read" on public.astrologers for select using (verified=true or id=auth.uid() or public.is_admin());

drop policy if exists "astrologers own insert" on public.astrologers;
create policy "astrologers own insert" on public.astrologers for insert with check (id=auth.uid() or public.is_admin());

-- Astrologers may update conversation status only for their own conversations.
drop policy if exists "conversations participant update" on public.conversations;
create policy "conversations participant update" on public.conversations for update using (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin());

-- Astrologers may read a user's saved Kundli only after the user has an accepted/closed conversation with them.
drop policy if exists "kundalis shared with astrologer" on public.kundalis;
create policy "kundalis shared with astrologer" on public.kundalis for select using (
  user_id=auth.uid() or public.is_admin() or exists(
    select 1 from public.conversations c
    where c.user_id=kundalis.user_id and c.astrologer_id=auth.uid() and c.status in ('accepted','closed')
  )
);

-- Astrologers may mark/read messages through the existing participant policy.
-- Add profile email sync for future signups.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id, full_name, email, phone)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, nullif(new.raw_user_meta_data->>'phone',''))
  on conflict (id) do update set full_name=excluded.full_name, email=excluded.email, updated_at=now();
  return new;
end;
$$;

-- Backfill email from auth.users for existing profiles.
update public.profiles p set email=u.email, updated_at=now()
from auth.users u where u.id=p.id and (p.email is null or p.email='');

-- Keep profile email/phone synchronized when users update their auth account.
create or replace function public.sync_auth_profile()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  update public.profiles
  set email=new.email,
      full_name=coalesce(new.raw_user_meta_data->>'full_name', full_name),
      phone=coalesce(new.phone, phone),
      updated_at=now()
  where id=new.id;
  return new;
end;
$$;
drop trigger if exists on_auth_user_updated_profile on auth.users;
create trigger on_auth_user_updated_profile after update of email, phone, raw_user_meta_data on auth.users
for each row execute procedure public.sync_auth_profile();

-- Realtime for chat and request status.
alter table public.messages replica identity full;
alter table public.conversations replica identity full;

-- If signup selected Astrologer, create a pending application automatically.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
declare
  v_phone text := nullif(new.raw_user_meta_data->>'phone','');
  v_type text := coalesce(new.raw_user_meta_data->>'account_type','user');
begin
  insert into public.profiles(id, full_name, email, phone)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email, v_phone)
  on conflict (id) do update set full_name=excluded.full_name, email=excluded.email, phone=coalesce(excluded.phone,public.profiles.phone), updated_at=now();
  if v_type='astrologer' then
    insert into public.astrologer_applications(user_id) values(new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
