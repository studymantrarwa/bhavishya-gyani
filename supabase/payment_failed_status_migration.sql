-- Adds a real failed state for Razorpay checkout failures.
-- Run this once in Supabase SQL Editor.
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check(status in ('pending','approved','failed','rejected','refunded'));
