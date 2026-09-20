-- Bhavishya Gyani Admin Panel — additive migration
-- Run after schema.sql and astrologer-dashboard.sql.

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;
drop policy if exists "admin audit read" on public.admin_audit_logs;
create policy "admin audit read" on public.admin_audit_logs for select using (public.is_admin());
drop policy if exists "admin audit insert" on public.admin_audit_logs;
create policy "admin audit insert" on public.admin_audit_logs for insert with check (public.is_admin() and admin_id=auth.uid());

alter table public.reviews add column if not exists moderation_status text not null default 'approved';
alter table public.reviews add column if not exists admin_note text;
alter table public.reviews drop constraint if exists reviews_moderation_status_check;
alter table public.reviews add constraint reviews_moderation_status_check check (moderation_status in ('pending','approved','hidden','flagged'));

-- Public users should see only approved reviews. Admins can see every status.
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews for select using (moderation_status='approved' or user_id=auth.uid() or astrologer_id=auth.uid() or public.is_admin());

create index if not exists idx_admin_audit_created_at on public.admin_audit_logs(created_at desc);
create index if not exists idx_reviews_moderation_status on public.reviews(moderation_status);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_applications_status on public.astrologer_applications(status);
