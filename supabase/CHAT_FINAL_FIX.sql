-- Bhavishya Gyani chat final fix
-- Safe to run after the main wallet/payment migration.
alter table public.astrologer_earnings add column if not exists paid_amount numeric(12,2) not null default 0;
alter table public.astrologer_earnings add column if not exists paid_minutes numeric(12,2) not null default 0;
alter table public.conversations add column if not exists chat_started_at timestamptz;
alter table public.conversations add column if not exists chat_budget_seconds integer not null default 0;
alter table public.conversations add column if not exists billed_seconds integer not null default 0;
alter table public.conversations add column if not exists billed_amount numeric(12,2) not null default 0;
create unique index if not exists uq_earnings_conversation on public.astrologer_earnings(conversation_id) where conversation_id is not null;
create index if not exists idx_earnings_astro_day on public.astrologer_earnings(astrologer_id,earned_at desc);
