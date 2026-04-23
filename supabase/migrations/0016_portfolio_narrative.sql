-- Bloomgarden — portfolio narrative. Idempotent re-run safe.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'portfolio_snapshots'
       and column_name = 'narrative'
  ) then
    alter table public.portfolio_snapshots add column narrative text;
  end if;
end $$;
