-- Bloomgarden — shared calendar events (me + friends).
-- A shared event is a single row owned by the creator (user_id); the other
-- participants are listed in participant_ids, and shared_label holds the
-- display prefix ("W&A&B"). Participants see the event on their own calendar
-- and it counts as busy for the free-day finder. Applied to live via
-- execute_sql (this project's migrations aren't tracked by db push).

alter table public.calendar_events
  add column if not exists participant_ids uuid[] not null default '{}';
alter table public.calendar_events
  add column if not exists shared_label text;

-- Guard: every participant must be an accepted friend of the creator, and the
-- creator isn't listed among the participants.
create or replace function public.calendar_events_validate_participants()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if new.participant_ids is null then new.participant_ids := '{}'; end if;
  foreach pid in array new.participant_ids loop
    if pid = new.user_id then
      raise exception 'creator is implicit; do not include them in participant_ids';
    end if;
    if not exists (
      select 1 from public.friendships f
      where f.user_id = new.user_id and f.friend_id = pid and f.status = 'accepted'
    ) then
      raise exception 'participant % is not an accepted friend of the creator', pid;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists calendar_events_validate_participants_trg on public.calendar_events;
create trigger calendar_events_validate_participants_trg
  before insert or update on public.calendar_events
  for each row execute function public.calendar_events_validate_participants();

-- Extend read access so a participant sees a shared event on their own calendar
-- (not only when overlaying the creator).
drop policy if exists calendar_events_read_self_or_friend on public.calendar_events;
create policy calendar_events_read_self_or_friend
  on public.calendar_events for select
  using (
    user_id = auth.uid()
    or auth.uid() = any(participant_ids)
    or exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid()
        and f.friend_id = calendar_events.user_id
        and f.status = 'accepted'
    )
  );
