-- Bloomgarden — backtrack social, savings, and investing from the streak
-- grid. Lets users tap any past cell to log/unlog those entries.
--
--  • set_social_for_week(week_start_in, on_flag) — toggle social for a past
--    week. Mirrors set_social_this_week but week-flexible.
--  • log_deposit_for_date(kind, amount, date) — log a deposit on any date.
--  • delete_deposit(kind, id) — remove a specific deposit by id.
--    (Listing is read-only via RLS-allowed select on the deposit tables.)
--
-- Coins logic is unchanged: rollups still award based on existence/sum
-- within their period; backdated entries fold in to the next rollup or
-- the current one for the matching period.

-- ─── set_social_for_week ────────────────────────────────────────────────────
create or replace function public.set_social_for_week(
  week_start_in date,
  on_flag       boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wk date;
begin
  -- Snap input to the actual week-start (Monday) so callers can pass any
  -- date in the week and still hit the right row.
  wk := public.week_start_utc(week_start_in);

  if on_flag then
    insert into public.habit_logs (user_id, category, date, minutes, coins_awarded)
    values (auth.uid(), 'social', wk, 1, 0)
    on conflict (user_id, category, date) do nothing;
  else
    delete from public.habit_logs
     where user_id = auth.uid()
       and category = 'social'
       and date = wk
       and coalesce(coins_awarded, 0) = 0;  -- preserve paid-out weeks
  end if;
end;
$$;

revoke all on function public.set_social_for_week(date, boolean) from public;
grant execute on function public.set_social_for_week(date, boolean) to authenticated;

-- ─── log_deposit_for_date ───────────────────────────────────────────────────
create or replace function public.log_deposit_for_date(
  kind_in   text,
  amount_in numeric,
  date_in   date
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
    insert into public.savings_deposits (user_id, amount, date)
    values (auth.uid(), amount_in, date_in)
    returning id into row_id;
  elsif kind_in = 'investment' then
    insert into public.investment_deposits (user_id, amount, date)
    values (auth.uid(), amount_in, date_in)
    returning id into row_id;
  else
    raise exception 'unknown kind %', kind_in;
  end if;

  return row_id;
end;
$$;

revoke all on function public.log_deposit_for_date(text, numeric, date) from public;
grant execute on function public.log_deposit_for_date(text, numeric, date) to authenticated;

-- ─── delete_deposit ─────────────────────────────────────────────────────────
create or replace function public.delete_deposit(
  kind_in text,
  id_in   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if kind_in = 'savings' then
    delete from public.savings_deposits
     where id = id_in and user_id = auth.uid();
  elsif kind_in = 'investment' then
    delete from public.investment_deposits
     where id = id_in and user_id = auth.uid();
  else
    raise exception 'unknown kind %', kind_in;
  end if;
end;
$$;

revoke all on function public.delete_deposit(text, uuid) from public;
grant execute on function public.delete_deposit(text, uuid) to authenticated;
