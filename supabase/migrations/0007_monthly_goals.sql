-- Bloomgarden — Phase C+: savings + investing become monthly at 100 coins.
-- Replaces the 25-coin-per-week reward for these two categories.
-- Plants and social stay weekly (25 and 10 respectively).

-- ═══════════════════════════════════════════════════════════════════════════
-- Update existing goals + defaults
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.savings_goals    alter column cadence set default 'monthly';
alter table public.investment_goals alter column cadence set default 'monthly';

update public.savings_goals    set cadence = 'monthly' where cadence = 'weekly';
update public.investment_goals set cadence = 'monthly' where cadence = 'weekly';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rewrite weekly_rollup — savings + investing now check calendar-month sums
-- and award once per month via a month-scoped reason key.
-- ═══════════════════════════════════════════════════════════════════════════

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
  month_start date := date_trunc('month', target_week)::date;
  month_end   date := (date_trunc('month', target_week) + interval '1 month')::date;
  month_key   text := to_char(target_week, 'YYYY-MM');
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
    -- Dedup key = 'monthly:savings:YYYY-MM'. Awarded once per calendar month.
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

    -- ── social (weekly, +10) ──────────────────────────────────────────────
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
