-- Optional one-time migration for older Bhavishya Gyani Pooja tables.
-- The deployed API is already backward-compatible, so running this is not required for booking to work.

alter table if exists public.pooja_bookings add column if not exists user_name text not null default '';
alter table if exists public.pooja_bookings add column if not exists phone text not null default '';
alter table if exists public.pooja_bookings add column if not exists preferred_date date;
alter table if exists public.pooja_bookings add column if not exists preferred_time time;
alter table if exists public.pooja_bookings add column if not exists notes text not null default '';
alter table if exists public.pooja_bookings add column if not exists amount numeric(12,2) not null default 0;
alter table if exists public.pooja_bookings add column if not exists astrologer_note text not null default '';
alter table if exists public.pooja_bookings add column if not exists admin_note text not null default '';

update public.pooja_bookings set preferred_date=coalesce(preferred_date,booking_date) where preferred_date is null;
update public.pooja_bookings set preferred_time=coalesce(preferred_time,booking_time) where preferred_time is null;
update public.pooja_bookings set notes=coalesce(nullif(notes,''),note,'') where note is not null;
update public.pooja_bookings set amount=coalesce(nullif(amount,0),price,0);

-- After existing rows are backfilled, these can be made NOT NULL manually if desired.
