-- Bhavishya Gyani: Admin astrologer approval hardening
-- Safe/additive. Run after FINAL_SETUP.sql if needed.
-- These columns are optional in the API; this migration makes the current UI fully aligned.

alter table public.astrologer_applications add column if not exists education text default '';
alter table public.astrologer_applications add column if not exists avatar_url text;
alter table public.astrologers add column if not exists education text default '';
alter table public.astrologers add column if not exists avatar_url text;
alter table public.profiles add column if not exists avatar_url text;

create index if not exists idx_astrologer_applications_status_created
on public.astrologer_applications(status, created_at desc);

-- Keep application status and astrologer approval data protected by the existing admin policies.
