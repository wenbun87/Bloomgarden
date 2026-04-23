-- Bloomgarden — custom habits + hideable defaults.
-- Users can add their own habits (daily / weekly / monthly) and hide any of
-- the 8 built-ins. Custom rewards are fixed small values to protect the
-- calibrated coin economy (see /plans for the 236/week target).

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════

create table public.user_habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  cadence     text not null check (cadence in ('daily','weekly','monthly')),
  created_at  timestamptz not null default now()
);
create index user_habits_user_idx on public.user_habits (user_id, created_at);

-- One row per habit per slot. Slot date depends on cadence:
--   daily   → today's date
--   weekly  → Monday of the ISO week
--   monthly → 1st of the calendar month
-- The unique (habit_id, date) pair makes re-tapping idempotent.
create table public.user_habit_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  habit_id       uuid not null references public.user_habits(id) on delete cascade,
  date           date not null,
  coins_awarded  integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (habit_id, date)
);
create index user_habit_logs_user_date_idx
  on public.user_habit_logs (user_id, date desc);

-- Tracks which built-in categories a user has chosen to hide from their
-- dashboard. Categories can be any of the 8 built-ins.
create table public.user_habit_hidden (
  user_id   uuid not null references auth.users(id) on delete cascade,
  category  text not null check (category in (
              'exercise','hobby','mental_health','sleep',
              'plants','social','savings','investment'
            )),
  primary key (user_id, category)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.user_habits        enable row level security;
alter table public.user_habit_logs    enable row level security;
alter table public.user_habit_hidden  enable row level security;

-- Owner CRUD on habits + hidden flags.
create policy user_habits_own on public.user_habits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_habit_hidden_own on public.user_habit_hidden
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Logs: read-own; writes go through log_custom_habit only.
create policy user_habit_logs_read_own on public.user_habit_logs
  for select using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- log_custom_habit — idempotent per slot, awards a fixed reward by cadence.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.log_custom_habit(habit_id_in uuid)
returns public.user_habit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.user_habits;
  today date := (now() at time zone 'UTC')::date;
  slot date;
  reward integer;
  existing public.user_habit_logs;
  row public.user_habit_logs;
begin
  select * into h from public.user_habits
   where id = habit_id_in and user_id = auth.uid();
  if h.id is null then raise exception 'habit not found'; end if;

  -- Compute slot + reward from cadence.
  if h.cadence = 'daily' then
    slot := today;
    reward := 2;
  elsif h.cadence = 'weekly' then
    slot := public.week_start_utc(today);
    reward := 5;
  else
    slot := date_trunc('month', today)::date;
    reward := 20;
  end if;

  -- Idempotent: if already logged in this slot, return the existing row.
  select * into existing from public.user_habit_logs
   where habit_id = habit_id_in and date = slot;
  if existing.id is not null then
    return existing;
  end if;

  insert into public.user_habit_logs (user_id, habit_id, date, coins_awarded)
  values (auth.uid(), habit_id_in, slot, reward)
  returning * into row;

  perform public.award_coins(
    auth.uid(),
    reward,
    'custom:' || h.cadence || ':' || habit_id_in::text,
    row.id,
    slot
  );

  return row;
end;
$$;

revoke all on function public.log_custom_habit(uuid) from public;
grant execute on function public.log_custom_habit(uuid) to authenticated;
