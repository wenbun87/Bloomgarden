-- Bloomgarden — Phase B: habits + coin engine.
-- Tables for habit tracking + the server-authoritative coin ledger.
-- Coin changes only ever flow through SECURITY DEFINER functions below —
-- the client cannot mutate coin_balance, lifetime_coins, or coin_ledger directly.

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── habit_logs ──────────────────────────────────────────────────────────────
-- One row per (user, category, date). Weekly categories (social) use the
-- Monday of the week as the date so they uniquely slot per week.
create table public.habit_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  category       text not null check (category in (
                   'exercise','hobby','mental_health','sleep','social')),
  date           date not null,
  minutes        integer,                   -- exercise / hobby / mental_health
  value_json     jsonb,                     -- e.g. {"hours": 7} for sleep
  coins_awarded  integer not null default 0 check (coins_awarded >= 0),
  created_at     timestamptz not null default now(),
  unique (user_id, category, date)
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, date desc);

-- ─── plant_logs ──────────────────────────────────────────────────────────────
-- One row per (user, date, plant_name). Weekly rollup counts DISTINCT plant_name
-- per week and awards 25 coins at ≥30 unique species.
create table public.plant_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  plant_name  text not null check (char_length(plant_name) between 1 and 60),
  created_at  timestamptz not null default now(),
  unique (user_id, date, plant_name)
);

create index plant_logs_user_date_idx on public.plant_logs (user_id, date desc);

-- ─── savings / investment goals + deposits ───────────────────────────────────
create table public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  name           text not null default 'Weekly savings',
  target_amount  numeric(14,2) not null check (target_amount > 0),
  cadence        text not null default 'weekly' check (cadence in ('weekly','monthly')),
  created_at     timestamptz not null default now()
);

create table public.savings_deposits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      numeric(14,2) not null check (amount > 0),
  date        date not null default (now() at time zone 'UTC')::date,
  created_at  timestamptz not null default now()
);
create index savings_deposits_user_date_idx
  on public.savings_deposits (user_id, date desc);

create table public.investment_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  name           text not null default 'Weekly investing',
  target_amount  numeric(14,2) not null check (target_amount > 0),
  cadence        text not null default 'weekly' check (cadence in ('weekly','monthly')),
  created_at     timestamptz not null default now()
);

create table public.investment_deposits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      numeric(14,2) not null check (amount > 0),
  date        date not null default (now() at time zone 'UTC')::date,
  created_at  timestamptz not null default now()
);
create index investment_deposits_user_date_idx
  on public.investment_deposits (user_id, date desc);

-- ─── weekly_scores ───────────────────────────────────────────────────────────
-- One row per (user, ISO-week-start). Powers the friends-only leaderboard.
create table public.weekly_scores (
  user_id         uuid not null references auth.users(id) on delete cascade,
  week_start      date not null,                     -- Monday of the ISO week (UTC)
  total_coins     integer not null default 0 check (total_coins >= 0),
  breakdown_json  jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  primary key (user_id, week_start)
);

-- ─── coin_ledger ─────────────────────────────────────────────────────────────
-- Append-only. Every coin change (earn/spend/gift) is a row.
-- Positive-only in v1 per the design principle.
create table public.coin_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta       integer not null check (delta >= 0),
  reason      text not null,
  ref_id      uuid,
  created_at  timestamptz not null default now()
);

create index coin_ledger_user_idx on public.coin_ledger (user_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════
-- Principle: all habit/deposit/ledger rows are owner-only (read + write).
-- Exception: weekly_scores is readable by self + accepted friends (leaderboard).
-- Coin-mutating tables (weekly_scores, coin_ledger) have NO client-side insert
-- or update policy — the RPC functions below are the only write path.

alter table public.habit_logs          enable row level security;
alter table public.plant_logs          enable row level security;
alter table public.savings_goals       enable row level security;
alter table public.savings_deposits    enable row level security;
alter table public.investment_goals    enable row level security;
alter table public.investment_deposits enable row level security;
alter table public.weekly_scores       enable row level security;
alter table public.coin_ledger         enable row level security;

-- ─── helper for friend checks ────────────────────────────────────────────────
create or replace function public.is_friend_of(target uuid)
returns boolean
language sql stable security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where user_id = auth.uid()
      and friend_id = target
      and status = 'accepted'
  );
$$;

-- ─── habit_logs ──────────────────────────────────────────────────────────────
create policy habit_logs_read_own on public.habit_logs
  for select using (user_id = auth.uid());
-- INSERTs go via log_habit(); no client insert/update/delete policy.

-- ─── plant_logs ──────────────────────────────────────────────────────────────
create policy plant_logs_read_own on public.plant_logs
  for select using (user_id = auth.uid());
-- INSERTs go via log_plant(); clients may delete their own (undo last-added).
create policy plant_logs_delete_own on public.plant_logs
  for delete using (user_id = auth.uid());

-- ─── savings / investment goals: owner CRUD ──────────────────────────────────
create policy savings_goals_own on public.savings_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy investment_goals_own on public.investment_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── deposits: read-own + delete-own; inserts go via log_deposit() ───────────
create policy savings_deposits_read_own on public.savings_deposits
  for select using (user_id = auth.uid());
create policy savings_deposits_delete_own on public.savings_deposits
  for delete using (user_id = auth.uid());

create policy investment_deposits_read_own on public.investment_deposits
  for select using (user_id = auth.uid());
create policy investment_deposits_delete_own on public.investment_deposits
  for delete using (user_id = auth.uid());

-- ─── weekly_scores: readable by self + accepted friends (LEADERBOARD) ────────
create policy weekly_scores_read_self_or_friend on public.weekly_scores
  for select using (
    user_id = auth.uid() or public.is_friend_of(user_id)
  );
-- writes only via award_coins / weekly_rollup (SECURITY DEFINER).

-- ─── coin_ledger: read-own only; writes only via SECURITY DEFINER functions ──
create policy coin_ledger_read_own on public.coin_ledger
  for select using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPERS
-- ═══════════════════════════════════════════════════════════════════════════

-- ISO week start (Monday) for a date, in UTC.
create or replace function public.week_start_utc(d date)
returns date
language sql immutable
as $$ select date_trunc('week', d::timestamp)::date $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COIN ENGINE — all SECURITY DEFINER so they bypass RLS and write the ledger.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── award_coins (internal) ──────────────────────────────────────────────────
-- Inserts a ledger row, increments profiles.coin_balance + lifetime_coins,
-- upserts the weekly_scores row. Single transaction.
-- Callers: log_habit, log_plant (weekly), weekly_rollup, etc.
-- Not directly exposed to clients.
create or replace function public.award_coins(
  target_user uuid,
  delta_in    integer,
  reason_in   text,
  ref         uuid default null,
  occurred_on date default (now() at time zone 'UTC')::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wk date := public.week_start_utc(occurred_on);
begin
  if delta_in <= 0 then
    return;  -- positive-only; no-op instead of erroring so callers stay simple
  end if;

  insert into public.coin_ledger (user_id, delta, reason, ref_id)
  values (target_user, delta_in, reason_in, ref);

  update public.profiles
     set coin_balance   = coin_balance   + delta_in,
         lifetime_coins = lifetime_coins + delta_in
   where id = target_user;

  insert into public.weekly_scores (user_id, week_start, total_coins, breakdown_json, updated_at)
  values (
    target_user,
    wk,
    delta_in,
    jsonb_build_object(reason_in, delta_in),
    now()
  )
  on conflict (user_id, week_start) do update
    set total_coins    = weekly_scores.total_coins + delta_in,
        breakdown_json = weekly_scores.breakdown_json
                         || jsonb_build_object(
                              reason_in,
                              coalesce((weekly_scores.breakdown_json->>reason_in)::int, 0) + delta_in
                            ),
        updated_at     = now();
end;
$$;

revoke all on function public.award_coins(uuid, integer, text, uuid, date) from public;
-- Not granted to authenticated — only other SECURITY DEFINER fns call it.

-- ─── log_habit ───────────────────────────────────────────────────────────────
-- Daily habit check-in. Idempotent per (user, category, date):
-- - Inserts or updates today's row with the new minutes/value.
-- - Awards the *delta* between what was previously earned and what's now earned
--   so you can't earn +5 twice by re-tapping.
-- Categories + qualifying rules:
--   exercise      — minutes ≥ 30  → +5
--   hobby         — minutes ≥ 30  → +5
--   mental_health — minutes ≥ 30  → +5
--   sleep         — value_json->>'hours' ≥ 6 → +5
create or replace function public.log_habit(
  category_in text,
  minutes_in  integer default null,
  value_in    jsonb   default null,
  date_in     date    default (now() at time zone 'UTC')::date
)
returns public.habit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  qualifies boolean := false;
  target_award integer := 0;
  existing public.habit_logs;
  row public.habit_logs;
  delta integer;
begin
  if category_in not in ('exercise','hobby','mental_health','sleep') then
    raise exception 'log_habit: unsupported category %', category_in;
  end if;

  if category_in in ('exercise','hobby','mental_health') then
    qualifies := coalesce(minutes_in, 0) >= 30;
  elsif category_in = 'sleep' then
    qualifies := coalesce((value_in->>'hours')::numeric, 0) >= 6;
  end if;

  if qualifies then target_award := 5; end if;

  select * into existing from public.habit_logs
   where user_id = auth.uid()
     and category = category_in
     and date = date_in;

  if existing.id is null then
    insert into public.habit_logs (user_id, category, date, minutes, value_json, coins_awarded)
    values (auth.uid(), category_in, date_in, minutes_in, value_in, target_award)
    returning * into row;
    delta := target_award;
  else
    update public.habit_logs
       set minutes      = coalesce(minutes_in, minutes),
           value_json   = coalesce(value_in, value_json),
           coins_awarded = greatest(existing.coins_awarded, target_award)
     where id = existing.id
    returning * into row;
    delta := greatest(0, target_award - existing.coins_awarded);
  end if;

  if delta > 0 then
    perform public.award_coins(
      auth.uid(), delta, 'habit:' || category_in, row.id, date_in
    );
  end if;

  return row;
end;
$$;

revoke all on function public.log_habit(text, integer, jsonb, date) from public;
grant execute on function public.log_habit(text, integer, jsonb, date) to authenticated;

-- ─── set_social_this_week ────────────────────────────────────────────────────
-- Toggle for the weekly social habit. Writes a habit_log row on the Monday of
-- this week; the weekly rollup checks for its presence and awards +10.
-- (No coins awarded on toggle — the rollup is the source of truth.)
create or replace function public.set_social_this_week(on_flag boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wk date := public.week_start_utc((now() at time zone 'UTC')::date);
begin
  if on_flag then
    insert into public.habit_logs (user_id, category, date, coins_awarded)
    values (auth.uid(), 'social', wk, 0)
    on conflict (user_id, category, date) do nothing;
  else
    delete from public.habit_logs
     where user_id = auth.uid()
       and category = 'social'
       and date = wk
       and coins_awarded = 0;   -- refuse to delete if already paid out
  end if;
end;
$$;

revoke all on function public.set_social_this_week(boolean) from public;
grant execute on function public.set_social_this_week(boolean) to authenticated;

-- ─── log_plant ───────────────────────────────────────────────────────────────
-- Idempotent per (user, date, plant_name) via the unique index. No coin award
-- on insert — the weekly rollup checks DISTINCT plant_name count and awards.
create or replace function public.log_plant(plant_name_in text)
returns public.plant_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'UTC')::date;
  row public.plant_logs;
begin
  if length(trim(plant_name_in)) = 0 then
    raise exception 'plant_name required';
  end if;

  insert into public.plant_logs (user_id, date, plant_name)
  values (auth.uid(), today, lower(trim(plant_name_in)))
  on conflict (user_id, date, plant_name) do update
    set plant_name = excluded.plant_name  -- no-op to return the row
  returning * into row;

  return row;
end;
$$;

revoke all on function public.log_plant(text) from public;
grant execute on function public.log_plant(text) to authenticated;

-- ─── log_deposit ─────────────────────────────────────────────────────────────
-- Logs a savings or investment deposit. No coin award on insert — the weekly
-- rollup sums this week's deposits and awards if ≥ target_amount.
create or replace function public.log_deposit(
  kind_in   text,       -- 'savings' | 'investment'
  amount_in numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
begin
  if amount_in <= 0 then
    raise exception 'amount must be positive';
  end if;

  if kind_in = 'savings' then
    insert into public.savings_deposits (user_id, amount)
    values (auth.uid(), amount_in)
    returning id into row_id;
  elsif kind_in = 'investment' then
    insert into public.investment_deposits (user_id, amount)
    values (auth.uid(), amount_in)
    returning id into row_id;
  else
    raise exception 'unknown kind %', kind_in;
  end if;

  return row_id;
end;
$$;

revoke all on function public.log_deposit(text, numeric) from public;
grant execute on function public.log_deposit(text, numeric) to authenticated;

-- ─── weekly_rollup ───────────────────────────────────────────────────────────
-- Runs for a given week_start (default: last complete week). Awards:
--   • +25  if plants_unique   >= 30
--   • +25  if savings_sum     >= savings_goal.target_amount
--   • +25  if investing_sum   >= investment_goal.target_amount
--   • +10  if social log exists for the week
-- Then: for each daily category (exercise/hobby/mental_health/sleep), if the
-- user has a 3-week consecutive streak of ANY qualifying day that week,
-- award a bonus equal to that week's earnings in that category (2x effect).
--
-- Idempotent: a per-week awarded set is tracked in weekly_scores.breakdown_json
-- keyed by reason (e.g. "weekly:plants"). Re-running does nothing.
-- Loops over ALL users so it's safe to invoke manually or via cron.
create or replace function public.weekly_rollup(week_in date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_week date := coalesce(
    week_in,
    public.week_start_utc(((now() at time zone 'UTC')::date) - 7)
  );
  wk_end date := target_week + 7;
  u record;
  plants_unique int;
  savings_sum numeric;
  investing_sum numeric;
  s_target numeric;
  i_target numeric;
  social_logged boolean;
  cat text;
  cat_days int;
  cat_coins int;
  prior_rows int;
  existing_score jsonb;
begin
  for u in select id from public.profiles loop
    -- already-awarded-this-week tracking comes from weekly_scores.breakdown_json
    select coalesce(breakdown_json, '{}'::jsonb) into existing_score
      from public.weekly_scores
     where user_id = u.id and week_start = target_week;
    existing_score := coalesce(existing_score, '{}'::jsonb);

    -- ── plants ────────────────────────────────────────────────────────────
    if not existing_score ? 'weekly:plants' then
      select count(distinct plant_name) into plants_unique
        from public.plant_logs
       where user_id = u.id and date >= target_week and date < wk_end;
      if plants_unique >= 30 then
        perform public.award_coins(u.id, 25, 'weekly:plants', null, target_week);
      end if;
    end if;

    -- ── savings ───────────────────────────────────────────────────────────
    if not existing_score ? 'weekly:savings' then
      select target_amount into s_target
        from public.savings_goals where user_id = u.id;
      if s_target is not null then
        select coalesce(sum(amount), 0) into savings_sum
          from public.savings_deposits
         where user_id = u.id and date >= target_week and date < wk_end;
        if savings_sum >= s_target then
          perform public.award_coins(u.id, 25, 'weekly:savings', null, target_week);
        end if;
      end if;
    end if;

    -- ── investing ─────────────────────────────────────────────────────────
    if not existing_score ? 'weekly:investing' then
      select target_amount into i_target
        from public.investment_goals where user_id = u.id;
      if i_target is not null then
        select coalesce(sum(amount), 0) into investing_sum
          from public.investment_deposits
         where user_id = u.id and date >= target_week and date < wk_end;
        if investing_sum >= i_target then
          perform public.award_coins(u.id, 25, 'weekly:investing', null, target_week);
        end if;
      end if;
    end if;

    -- ── social ────────────────────────────────────────────────────────────
    if not existing_score ? 'weekly:social' then
      select exists (
        select 1 from public.habit_logs
         where user_id = u.id and category = 'social' and date = target_week
      ) into social_logged;
      if social_logged then
        perform public.award_coins(u.id, 10, 'weekly:social', null, target_week);
      end if;
    end if;

    -- ── streak bonus (daily categories) ───────────────────────────────────
    foreach cat in array array['exercise','hobby','mental_health','sleep'] loop
      continue when existing_score ? ('streak:' || cat);

      select count(*), coalesce(sum(coins_awarded), 0)
        into cat_days, cat_coins
        from public.habit_logs
       where user_id = u.id and category = cat
         and date >= target_week and date < wk_end
         and coins_awarded > 0;

      if cat_days = 0 then continue; end if;

      -- "3 consecutive weeks in a category" — check the two prior weeks too.
      select count(*) into prior_rows
        from (
          select date_trunc('week', date) as wk
            from public.habit_logs
           where user_id = u.id and category = cat and coins_awarded > 0
             and date >= target_week - 14 and date < target_week
           group by 1
        ) g;

      if prior_rows >= 2 then
        perform public.award_coins(u.id, cat_coins, 'streak:' || cat, null, target_week);
      end if;
    end loop;

  end loop;
end;
$$;

revoke all on function public.weekly_rollup(date) from public;
-- Not granted to authenticated — only the Worker (service_role) or manual
-- service-role-authenticated SQL triggers this.
