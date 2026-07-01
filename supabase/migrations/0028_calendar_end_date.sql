-- Bloomgarden — multi-day calendar events.
-- Adds an optional end_date so an event can span a range of days. null means a
-- single-day event (ends on event_date). event_date stays the start day.
-- Applied to live via execute_sql (this project's migrations are not tracked by
-- supabase db push — see project notes).

alter table public.calendar_events
  add column if not exists end_date date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'calendar_events_end_after_start'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_end_after_start
      check (end_date is null or end_date >= event_date);
  end if;
end $$;
