-- Bloomgarden — expand account types with property, crypto, debt.
-- Debt balances are entered as POSITIVE and subtracted from net worth — same
-- convention as every personal-finance app.

alter table public.accounts drop constraint accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in ('cash','investment','retirement','property','crypto','debt','other'));

-- Update the net-worth capture so debt accounts reduce the total.
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
  if not exists (select 1 from auth.users where id = u) then
    return coalesce(new, old);
  end if;
  select coalesce(
           sum(case when type = 'debt' then -balance else balance end),
           0
         ) into t
    from public.accounts where user_id = u;
  insert into public.net_worth_snapshots (user_id, total) values (u, t);
  return coalesce(new, old);
end;
$$;

-- Re-snapshot every user now so existing histories reflect the new formula.
-- Touches one row per user to fire the trigger; cheap on a small user base.
do $$
declare
  u record;
begin
  for u in select distinct user_id from public.accounts loop
    update public.accounts
       set updated_at = now()
     where id = (
       select id from public.accounts
        where user_id = u.user_id
        order by created_at
        limit 1
     );
  end loop;
end $$;
