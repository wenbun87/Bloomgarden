-- Bloomgarden — custom habits can target X times per week. Idempotent.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'user_habits'
       and column_name = 'target_per_week'
  ) then
    alter table public.user_habits
      add column target_per_week integer
        check (target_per_week is null or target_per_week between 1 and 7);
  end if;
end $$;
