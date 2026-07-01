-- Bloomgarden — backfill + un-log support.
-- Adds unlog_habit + unlog_custom_habit RPCs that delete a day's log and
-- reverse any coins paid for it (including quota bonuses if the weekly count
-- drops below target). Also gives log_custom_habit an optional date_in arg
-- so the front-end can backfill missed days.

-- ═══════════════════════════════════════════════════════════════════════════
-- log_custom_habit — accept optional date_in for backfilling.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.log_custom_habit(
  habit_id_in uuid,
  date_in     date default null
)
returns public.user_habit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  h           public.user_habits;
  today       date := (now() at time zone 'UTC')::date;
  target_day  date := coalesce(date_in, today);
  slot        date;
  reward      integer;
  is_quota    boolean := false;
  bonus       integer;
  weekly_n    integer;
  reason_key  text;
  existing    public.user_habit_logs;
  row         public.user_habit_logs;
begin
  select * into h from public.user_habits
   where id = habit_id_in and user_id = auth.uid();
  if h.id is null then raise exception 'habit not found'; end if;

  -- Slot date: snaps to the cadence's reference day.
  if h.cadence = 'daily' then
    slot := target_day;
    is_quota := h.target_per_week is not null;
    reward := case when is_quota then 0 else 2 end;
  elsif h.cadence = 'weekly' then
    slot := public.week_start_utc(target_day);
    reward := 5;
  else
    slot := date_trunc('month', target_day)::date;
    reward := 20;
  end if;

  -- Reject backfills more than 7 days in the past (anti-streak-gaming).
  if slot < today - 7 then
    raise exception 'cannot log more than 7 days in the past';
  end if;

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
      'custom:' || h.cadence || ':' || habit_id_in::text || ':' || slot::text,
      row.id,
      slot
    );
  end if;

  if is_quota then
    bonus := h.target_per_week * 2;
    reason_key := 'quota:custom:' || habit_id_in::text || ':' ||
                  to_char(public.week_start_utc(slot), 'YYYY-MM-DD');
    if not exists (
      select 1 from public.coin_ledger
       where user_id = auth.uid() and reason = reason_key
    ) then
      select count(*) into weekly_n
        from public.user_habit_logs
       where habit_id = habit_id_in
         and date >= public.week_start_utc(slot)
         and date < public.week_start_utc(slot) + 7;
      if weekly_n >= h.target_per_week then
        perform public.award_coins(
          auth.uid(), bonus, reason_key, null, slot
        );
      end if;
    end if;
  end if;

  return row;
end;
$$;

revoke all on function public.log_custom_habit(uuid, date) from public;
grant execute on function public.log_custom_habit(uuid, date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- reverse_coins — internal helper: insert a negative ledger row + decrement
-- balance (clamped at 0). Lifetime_coins is not decreased.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.reverse_coins(
  target_user uuid,
  amount      integer,
  reason_in   text,
  ref         uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
  to_remove integer;
begin
  if amount <= 0 then return; end if;

  select coin_balance into current_balance
    from public.profiles where id = target_user for update;
  to_remove := least(amount, coalesce(current_balance, 0));

  if to_remove > 0 then
    update public.profiles
       set coin_balance = coin_balance - to_remove
     where id = target_user;
  end if;

  -- Ledger always records the intent (full -amount), even if balance was
  -- clamped. Lifetime untouched — earnings stay on the books.
  insert into public.coin_ledger (user_id, delta, reason, ref_id)
  values (target_user, -amount, reason_in, ref);

  -- Update weekly_scores to reflect the reversal.
  update public.weekly_scores
     set total_coins = greatest(0, total_coins - amount),
         updated_at = now()
   where user_id = target_user
     and week_start = public.week_start_utc((now() at time zone 'UTC')::date);
end;
$$;

revoke all on function public.reverse_coins(uuid, integer, text, uuid) from public;

-- ═══════════════════════════════════════════════════════════════════════════
-- unlog_habit — remove a built-in habit log + reverse coins.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.unlog_habit(
  category_in text,
  date_in     date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today        date := (now() at time zone 'UTC')::date;
  is_quota     boolean := false;
  existing     public.habit_logs;
  this_week    date;
  reason_key   text;
  weekly_n     integer;
  quota_bonus  integer := 15;
  bonus_paid   boolean;
begin
  if date_in < today - 7 then
    raise exception 'cannot un-log more than 7 days in the past';
  end if;

  select * into existing from public.habit_logs
   where user_id = auth.uid()
     and category = category_in
     and date = date_in;
  if existing.id is null then return; end if;

  is_quota := category_in in ('hobby','mental_health');

  -- Reverse the per-log payment if any.
  if existing.coins_awarded > 0 then
    perform public.reverse_coins(
      auth.uid(),
      existing.coins_awarded,
      'unlog:habit:' || category_in || ':' || existing.id::text,
      existing.id
    );
  end if;

  delete from public.habit_logs where id = existing.id;

  -- Quota bonus: if removing this row drops the week below 3 AND the bonus
  -- was paid for this week, reverse the bonus too.
  if is_quota then
    this_week := public.week_start_utc(date_in);
    reason_key := 'quota:' || category_in || ':' || to_char(this_week, 'YYYY-MM-DD');

    select exists (
      select 1 from public.coin_ledger
       where user_id = auth.uid()
         and reason = reason_key
         and delta > 0
    ) into bonus_paid;

    if bonus_paid then
      select count(*) into weekly_n
        from public.habit_logs
       where user_id = auth.uid()
         and category = category_in
         and date >= this_week
         and date < this_week + 7
         and coalesce(minutes, 0) >= 30;
      if weekly_n < 3 then
        perform public.reverse_coins(
          auth.uid(), quota_bonus, 'unlog:' || reason_key, null
        );
      end if;
    end if;
  end if;
end;
$$;

revoke all on function public.unlog_habit(text, date) from public;
grant execute on function public.unlog_habit(text, date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- unlog_custom_habit — same logic for custom daily habits.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.unlog_custom_habit(
  habit_id_in uuid,
  date_in     date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today       date := (now() at time zone 'UTC')::date;
  h           public.user_habits;
  existing    public.user_habit_logs;
  is_quota    boolean := false;
  bonus       integer;
  reason_key  text;
  weekly_n    integer;
  bonus_paid  boolean;
begin
  if date_in < today - 7 then
    raise exception 'cannot un-log more than 7 days in the past';
  end if;

  select * into h from public.user_habits
   where id = habit_id_in and user_id = auth.uid();
  if h.id is null then raise exception 'habit not found'; end if;

  select * into existing from public.user_habit_logs
   where habit_id = habit_id_in and date = date_in;
  if existing.id is null then return; end if;

  is_quota := h.cadence = 'daily' and h.target_per_week is not null;

  if existing.coins_awarded > 0 then
    perform public.reverse_coins(
      auth.uid(),
      existing.coins_awarded,
      'unlog:custom:' || habit_id_in::text || ':' || existing.id::text,
      existing.id
    );
  end if;

  delete from public.user_habit_logs where id = existing.id;

  if is_quota then
    bonus := h.target_per_week * 2;
    reason_key := 'quota:custom:' || habit_id_in::text || ':' ||
                  to_char(public.week_start_utc(date_in), 'YYYY-MM-DD');

    select exists (
      select 1 from public.coin_ledger
       where user_id = auth.uid()
         and reason = reason_key
         and delta > 0
    ) into bonus_paid;

    if bonus_paid then
      select count(*) into weekly_n
        from public.user_habit_logs
       where habit_id = habit_id_in
         and date >= public.week_start_utc(date_in)
         and date < public.week_start_utc(date_in) + 7;
      if weekly_n < h.target_per_week then
        perform public.reverse_coins(
          auth.uid(), bonus, 'unlog:' || reason_key, null
        );
      end if;
    end if;
  end if;
end;
$$;

revoke all on function public.unlog_custom_habit(uuid, date) from public;
grant execute on function public.unlog_custom_habit(uuid, date) to authenticated;
