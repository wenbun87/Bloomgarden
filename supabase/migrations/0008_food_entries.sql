-- Bloomgarden — Batch 3: food tracking.
-- Per-user food log populated by the Food Search (Open Food Facts) widget.
-- Per-day view drives calories + macros totals on the Health page.

create table public.food_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null default (now() at time zone 'UTC')::date,
  name          text not null check (char_length(name) between 1 and 120),
  brand         text,
  barcode       text,                              -- Open Food Facts product code; null for manual entries
  grams         numeric(10,2) not null default 100 check (grams > 0),
  calories      numeric(10,2) not null default 0,
  protein_g     numeric(10,2) not null default 0,
  carbs_g       numeric(10,2) not null default 0,
  fat_g         numeric(10,2) not null default 0,
  nutriscore    text,                              -- a|b|c|d|e — from OFF
  nova_group    smallint,                          -- 1..4 — from OFF
  ecoscore      text,                              -- a|b|c|d|e — from OFF
  created_at    timestamptz not null default now()
);

create index food_entries_user_date_idx on public.food_entries (user_id, date desc);

alter table public.food_entries enable row level security;

create policy food_entries_own on public.food_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
