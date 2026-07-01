-- Bloomgarden — personal calendar + friend free-day finder.
-- Each user keeps their own events; accepted friends can read them (titles
-- included, per product decision) so calendars can be overlaid to find days
-- when everyone is free. Google / ICS import is intentionally deferred —
-- manual entry only for now. The `source` column is here so a future importer
-- can mark rows 'google' without a schema change.

create table public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  event_date  date not null,
  all_day     boolean not null default true,
  start_time  time,
  end_time    time,
  note        text check (note is null or char_length(note) <= 500),
  source      text not null default 'manual' check (source in ('manual', 'google')),
  created_at  timestamptz not null default now()
);

create index calendar_events_user_date_idx
  on public.calendar_events (user_id, event_date);

alter table public.calendar_events enable row level security;

-- Read: self, or anyone you're accepted-friends with. Accepted edges are stored
-- as two rows (A→B and B→A), so this single-direction check is sufficient to
-- read a friend's calendar for the overlay.
create policy calendar_events_read_self_or_friend
  on public.calendar_events for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid()
        and f.friend_id = calendar_events.user_id
        and f.status = 'accepted'
    )
  );

-- Insert / update / delete: owner only. Friends can look, never touch.
create policy calendar_events_insert_self
  on public.calendar_events for insert
  with check (user_id = auth.uid());

create policy calendar_events_update_self
  on public.calendar_events for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy calendar_events_delete_self
  on public.calendar_events for delete
  using (user_id = auth.uid());
