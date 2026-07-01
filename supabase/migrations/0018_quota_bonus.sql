-- Bloomgarden — quota-style coin awards.
-- Hobby + Mental health (3× weekly built-ins) and any custom daily habit
-- with a target_per_week now pay nothing per log, and a single bonus
-- equal to (target × base reward) when the weekly count first hits target.
-- Subsequent taps in the same week still log (and show in the counter as
-- 4/3, 5/3, 6/3) but don't award additional coins.

-- ═══════════════════════════════════════════════════════════════════════════
-- log_habit — built-ins (hobby + mental_health become quota-bonus)
-- ═══════════════════════════════════════════════════════════════════════════

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
  qualifies     boolean := false;
  is_quota      boolean := false;
  target_award  integer := 0;
  existing      public.habit_logs;
  row           public.habit_logs;
  delta         integer;
  this_week     date;
  weekly_n      integer;
  reason_key    text;
  quota_target  integer := 3;
  quota_bonus   integer := 15;        -- 5 × 3
begin
  if category_in not in ('exercise','hobby','mental_health','sleep') then
    raise exception 'log_habit: unsupported category %', category_in;
  end if;

  is_quota := category_in in ('hobby','mental_health');

  if category_in in ('exercise','hobby','mental_health') then
    qualifies := coalesce(minutes_in, 0) >= 30;
  elsif category_in = 'sleep' then
    qualifies := coalesce((value_in->>'hours')::numeric, 0) >= 6;
  end if;

  -- Per-log reward: only for non-quota cats. Quota cats earn via a single
  -- weekly bonus below.
  if qualifies and not is_quota then
    target_award := 5;
  end if;

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

  -- Quota bonus: hobby / mental_health pay 15 once when the week's qualifying
  -- count crosses 3. Idempotent via the unique reason key.
  if is_quota and qualifies then
    this_week := public.week_start_utc(date_in);
    reason_key := 'quota:' || category_in || ':' || to_char(this_week, 'YYYY-MM-DD');

    if not exists (
      select 1 from public.coin_ledger
       where user_id = auth.uid() and reason = reason_key
    ) then
      select count(*) into weekly_n
        from public.habit_logs
       where user_id = auth.uid()
         and category = category_in
         and date >= this_week
         and date < this_week + 7
         and coalesce(minutes, 0) >= 30;
      if weekly_n >= quota_target then
        perform public.award_coins(
          auth.uid(), quota_bonus, reason_key, null, date_in
        );
      end if;
    end if;
  end if;

  return row;
end;
$$;

revoke all on function public.log_habit(text, integer, jsonb, date) from public;
grant execute on function public.log_habit(text, integer, jsonb, date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- log_custom_habit — daily habits with target_per_week become quota-bonus.
-- Bonus = 2 × target_per_week.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.log_custom_habit(habit_id_in uuid)
returns public.user_habit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  h          public.user_habits;
  today      date := (now() at time zone 'UTC')::date;
  slot       date;
  reward     integer;
  is_quota   boolean := false;
  bonus      integer;
  weekly_n   integer;
  reason_key text;
  existing   public.user_habit_logs;
  row        public.user_habit_logs;
begin
  select * into h from public.user_habits
   where id = habit_id_in and user_id = auth.uid();
  if h.id is null then raise exception 'habit not found'; end if;

  if h.cadence = 'daily' then
    slot := today;
    is_quota := h.target_per_week is not null;
    -- Daily-quota habits get their reward via the weekly bonus path below.
    reward := case when is_quota then 0 else 2 end;
  elsif h.cadence = 'weekly' then
    slot := public.week_start_utc(today);
    reward := 5;
  else
    slot := date_trunc('month', today)::date;
    reward := 20;
  end if;

  -- Idempotent per slot: re-tapping same day/week/month returns existing row.
  select * into existing from public.user_habit_logs
   where habit_id = habit_id_in and date = slot;
  if existing.id is not null then
    return existing;
  end if;

  insert into public.user_habit_logs (user_id, habit_id, date, coins_awarded)
  values (auth.uid(), habit_id_in, slot, reward)
  returning * into row;

  if reward > 0 then
    perform public.award_coins(
      auth.uid(),
      reward,
      'custom:' || h.cadence || ':' || habit_id_in::text,
      row.id,
      slot
    );
  end if;

  -- Daily-quota: pay (target × 2) once per week when count hits target.
  if is_quota then
    bonus := h.target_per_week * 2;
    reason_key := 'quota:custom:' || habit_id_in::text || ':' ||
                  to_char(public.week_start_utc(today), 'YYYY-MM-DD');

    if not exists (
      select 1 from public.coin_ledger
       where user_id = auth.uid() and reason = reason_key
    ) then
      select count(*) into weekly_n
        from public.user_habit_logs
       where habit_id = habit_id_in
         and date >= public.week_start_utc(today)
         and date < public.week_start_utc(today) + 7;
      if weekly_n >= h.target_per_week then
        perform public.award_coins(
          auth.uid(), bonus, reason_key, null, today
        );
      end if;
    end if;
  end if;

  return row;
end;
$$;

revoke all on function public.log_custom_habit(uuid) from public;
grant execute on function public.log_custom_habit(uuid) to authenticated;
