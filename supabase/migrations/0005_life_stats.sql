-- Bloomgarden — Phase C: life stats (net worth + to-do).
-- Accounts are the most sensitive rows — owner-only, friends never read them.
-- Net worth is snapshotted automatically via trigger so the chart has history
-- without per-client work.

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════

create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  type        text not null check (type in ('cash','investment','retirement','other')),
  balance     numeric(14,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index accounts_user_idx on public.accounts (user_id);

create table public.net_worth_snapshots (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  total        numeric(14,2) not null,
  captured_at  timestamptz not null default now()
);
create index nws_user_time_idx on public.net_worth_snapshots (user_id, captured_at);

create table public.todos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 240),
  completed     boolean not null default false,
  due_date      date,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index todos_user_idx on public.todos (user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — everything owner-only
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.accounts            enable row level security;
alter table public.net_worth_snapshots enable row level security;
alter table public.todos               enable row level security;

create policy accounts_own on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy nws_read_own on public.net_worth_snapshots
  for select using (user_id = auth.uid());
-- Inserts happen via trigger (SECURITY DEFINER).

create policy todos_own on public.todos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-update accounts.updated_at on every UPDATE.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger accounts_touch
  before update on public.accounts
  for each row execute function public.touch_updated_at();

-- Snapshot net worth after any balance change. Runs as SECURITY DEFINER so it
-- bypasses the nws_read_own policy for inserts (the policy only covers reads).
create or replace function public.capture_net_worth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
  t numeric;
begin
  u := coalesce(new.user_id, old.user_id);
  -- Skip snapshotting if the owning user is already gone (cascade delete).
  if not exists (select 1 from auth.users where id = u) then
    return coalesce(new, old);
  end if;
  select coalesce(sum(balance), 0) into t
    from public.accounts where user_id = u;
  insert into public.net_worth_snapshots (user_id, total) values (u, t);
  return coalesce(new, old);
end;
$$;

create trigger accounts_snapshot_ins
  after insert on public.accounts
  for each row execute function public.capture_net_worth();

create trigger accounts_snapshot_upd
  after update of balance on public.accounts
  for each row execute function public.capture_net_worth();

create trigger accounts_snapshot_del
  after delete on public.accounts
  for each row execute function public.capture_net_worth();
