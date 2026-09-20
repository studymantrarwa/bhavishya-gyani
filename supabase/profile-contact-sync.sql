-- Bhavishya Gyani: Profile contact details sync patch
-- Safe to run after the existing schema.sql. Does not delete or replace existing tables/data.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;

-- Keep new Supabase Auth users synced into the public profile table.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', new.phone)
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = coalesce(excluded.email, public.profiles.email),
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Back-fill contact details for users who already registered.
update public.profiles p
set
  email = coalesce(u.email, p.email),
  phone = coalesce(u.raw_user_meta_data->>'phone', u.phone, p.phone),
  full_name = coalesce(u.raw_user_meta_data->>'full_name', p.full_name),
  updated_at = now()
from auth.users u
where p.id = u.id;
