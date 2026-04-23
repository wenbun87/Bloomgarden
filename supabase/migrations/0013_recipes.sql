-- Bloomgarden — recipe book.
-- Users save AI-suggested or manually-authored recipes. Each recipe carries
-- per-serving macros so logging to the food tracker is one click.

create table public.recipes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 120),
  description       text check (description is null or char_length(description) <= 300),
  minutes           integer check (minutes is null or minutes >= 0),
  servings          integer not null default 1 check (servings > 0),
  calories          numeric(10,2) not null default 0,  -- per serving
  protein_g         numeric(10,2) not null default 0,
  carbs_g           numeric(10,2) not null default 0,
  fat_g             numeric(10,2) not null default 0,
  ingredients_json  jsonb not null default '[]'::jsonb,  -- [{name, amount}]
  steps_json        jsonb not null default '[]'::jsonb,  -- string[]
  health_notes      text check (health_notes is null or char_length(health_notes) <= 400),
  source            text not null default 'manual' check (source in ('ai','manual')),
  created_at        timestamptz not null default now()
);

create index recipes_user_idx on public.recipes (user_id, created_at desc);

alter table public.recipes enable row level security;

create policy recipes_own on public.recipes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
