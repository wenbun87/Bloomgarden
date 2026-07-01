-- Bloomgarden — let the weekly social habit accumulate a count.
-- Reuses habit_logs.minutes to track # of times the user marked "I hung
-- out / called a friend" within the current ISO week. One row per week as
-- before (date = week-start Monday); coins still award once at Sunday
-- rollup based on row existence — the count is purely for tracking.

create or replace function public.adjust_social_this_week(delta_in integer)
returns integer  -- the new count for the current week
language plpgsql
security definer
set search_path = public
as $$
declare
  wk        date := public.week_start_utc((now() at time zone 'UTC')::date);
  current_n integer;
  new_n     integer;
  paid_out  boolean;
begin
  if delta_in not in (-1, 1) then
    raise exception 'adjust_social_this_week: delta must be -1 or 1';
  end if;

  select coalesce(minutes, 0), coalesce(coins_awarded, 0) > 0
    into current_n, paid_out
    from public.habit_logs
   where user_id = auth.uid()
     and category = 'social'
     and date = wk;

  -- No row yet: only +1 is meaningful.
  if not found then
    if delta_in < 0 then
      return 0;
    end if;
    insert into public.habit_logs (user_id, category, date, minutes, coins_awarded)
    values (auth.uid(), 'social', wk, 1, 0);
    return 1;
  end if;

  new_n := greatest(0, current_n + delta_in);

  if new_n = 0 then
    -- Decrementing to zero: drop the row only if no coins yet (so the
    -- streak grid stops marking the week). If already paid out, keep the
    -- row at minutes=0 so the +10 stays earned and the streak holds.
    if not paid_out then
      delete from public.habit_logs
       where user_id = auth.uid()
         and category = 'social'
         and date = wk;
    else
      update public.habit_logs
         set minutes = 0
       where user_id = auth.uid()
         and category = 'social'
         and date = wk;
    end if;
    return 0;
  end if;

  update public.habit_logs
     set minutes = new_n
   where user_id = auth.uid()
     and category = 'social'
     and date = wk;
  return new_n;
end;
$$;

revoke all on function public.adjust_social_this_week(integer) from public;
grant execute on function public.adjust_social_this_week(integer) to authenticated;
