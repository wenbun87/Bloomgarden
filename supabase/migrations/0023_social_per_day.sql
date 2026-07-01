-- Bloomgarden — switch social to a per-day model.
-- Old behavior: one row per (user, week-start). Count was tracked in
-- `minutes`. The streak grid only marked Mondays.
-- New behavior: one row per (user, date) — like exercise. Each day can be
-- ticked individually in the streak grid. Coins still award once per week
-- if any social row exists in that week.
--
-- Existing rows at week-start dates remain valid — the rollup now checks
-- the full week range, so legacy rows still earn the +10.

-- ─── adjust_social_this_week (rewritten) ────────────────────────────────────
-- "Add another / undo" buttons in SocialWidget hit this RPC.
-- +1: insert today's row (idempotent — one row per day, max).
-- -1: remove today's row first; fall back to the most recent un-paid row in
--      the current week. Returns the new week count.
create or replace function public.adjust_social_this_week(delta_in integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  today_d  date := (now() at time zone 'UTC')::date;
  wk       date := public.week_start_utc(today_d);
  found_id uuid;
  cnt      integer;
begin
  if delta_in not in (-1, 1) then
    raise exception 'adjust_social_this_week: delta must be -1 or 1';
  end if;

  if delta_in = 1 then
    insert into public.habit_logs (user_id, category, date, coins_awarded)
    values (auth.uid(), 'social', today_d, 0)
    on conflict (user_id, category, date) do nothing;
  else
    -- Prefer to undo today's row.
    select id into found_id
      from public.habit_logs
     where user_id = auth.uid()
       and category = 'social'
       and date = today_d
       and coalesce(coins_awarded, 0) = 0
     limit 1;
    -- Otherwise, latest un-paid row in this week.
    if found_id is null then
      select id into found_id
        from public.habit_logs
       where user_id = auth.uid()
         and category = 'social'
         and date >= wk and date < wk + 7
         and coalesce(coins_awarded, 0) = 0
       order by date desc, created_at desc
       limit 1;
    end if;
    if found_id is not null then
      delete from public.habit_logs where id = found_id;
    end if;
  end if;

  select count(*) into cnt
    from public.habit_logs
   where user_id = auth.uid()
     and category = 'social'
     and date >= wk and date < wk + 7;
  return cnt;
end;
$$;

revoke all on function public.adjust_social_this_week(integer) from public;
grant execute on function public.adjust_social_this_week(integer) to authenticated;

-- ─── set_social_for_date — single-day toggle (streak-grid backtrack) ────────
create or replace function public.set_social_for_date(
  date_in date,
  on_flag boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if on_flag then
    insert into public.habit_logs (user_id, category, date, coins_awarded)
    values (auth.uid(), 'social', date_in, 0)
    on conflict (user_id, category, date) do nothing;
  else
    delete from public.habit_logs
     where user_id = auth.uid()
       and category = 'social'
       and date = date_in
       and coalesce(coins_awarded, 0) = 0;
  end if;
end;
$$;

revoke all on function public.set_social_for_date(date, boolean) from public;
grant execute on function public.set_social_for_date(date, boolean) to authenticated;

-- ─── weekly_rollup — check social existence anywhere in the week ────────────
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
  wk_end      date := target_week + 7;
  month_start date := date_trunc('month', target_week)::date;
  month_end   date := (date_trunc('month', target_week) + interval '1 month')::date;
  month_key   text := to_char(target_week, 'YYYY-MM');
  u record;
  plants_unique int;
  savings_sum   numeric;
  investing_sum numeric;
  s_target      numeric;
  i_target      numeric;
  social_logged boolean;
  cat           text;
  cat_days      int;
  cat_coins     int;
  prior_rows    int;
  existing_score jsonb;
begin
  for u in select id from public.profiles loop
    select coalesce(breakdown_json, '{}'::jsonb) into existing_score
      from public.weekly_scores
     where user_id = u.id and week_start = target_week;
    existing_score := coalesce(existing_score, '{}'::jsonb);

    -- ── plants (weekly) ───────────────────────────────────────────────────
    if not existing_score ? 'weekly:plants' then
      select count(distinct plant_name) into plants_unique
        from public.plant_logs
       where user_id = u.id and date >= target_week and date < wk_end;
      if plants_unique >= 30 then
        perform public.award_coins(u.id, 25, 'weekly:plants', null, target_week);
      end if;
    end if;

    -- ── savings (monthly, +100) ───────────────────────────────────────────
    if not exists (
      select 1 from public.coin_ledger
       where user_id = u.id
         and reason = 'monthly:savings:' || month_key
    ) then
      select target_amount into s_target
        from public.savings_goals where user_id = u.id;
      if s_target is not null then
        select coalesce(sum(amount), 0) into savings_sum
          from public.savings_deposits
         where user_id = u.id and date >= month_start and date < month_end;
        if savings_sum >= s_target then
          perform public.award_coins(
            u.id, 100, 'monthly:savings:' || month_key, null, target_week
          );
        end if;
      end if;
    end if;

    -- ── investing (monthly, +100) ─────────────────────────────────────────
    if not exists (
      select 1 from public.coin_ledger
       where user_id = u.id
         and reason = 'monthly:investing:' || month_key
    ) then
      select target_amount into i_target
        from public.investment_goals where user_id = u.id;
      if i_target is not null then
        select coalesce(sum(amount), 0) into investing_sum
          from public.investment_deposits
         where user_id = u.id and date >= month_start and date < month_end;
        if investing_sum >= i_target then
          perform public.award_coins(
            u.id, 100, 'monthly:investing:' || month_key, null, target_week
          );
        end if;
      end if;
    end if;

    -- ── social (weekly, +10) — any row in the week range now qualifies ────
    if not existing_score ? 'weekly:social' then
      select exists (
        select 1 from public.habit_logs
         where user_id = u.id
           and category = 'social'
           and date >= target_week and date < wk_end
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
