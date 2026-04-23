-- Bloomgarden — messages, global leaderboard, realtime on profiles.

-- ═══════════════════════════════════════════════════════════════════════════
-- Global leaderboard — weekly_scores readable by all authenticated users.
-- Profile pages stay friend-gated (separate policy on profiles).
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists weekly_scores_read_self_or_friend on public.weekly_scores;

create policy weekly_scores_read_all on public.weekly_scores
  for select using (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════════════
-- Messages — mailbox for seed + note gifts between friends.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references auth.users(id) on delete cascade,
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  body          text check (body is null or char_length(body) <= 500),
  -- If a seed was gifted with the message, we denormalise both the user_seeds
  -- row and the species_id. seed_id is set null if the recipient plants it.
  seed_id       uuid references public.user_seeds(id) on delete set null,
  species_id    uuid references public.plant_species(id),
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  check (body is not null or species_id is not null),
  check (sender_id <> recipient_id)
);

create index messages_recipient_unread_idx
  on public.messages (recipient_id, read_at, created_at desc);

alter table public.messages enable row level security;

create policy messages_read_involved on public.messages
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Only the recipient can mark-read (we gate to read_at-only updates via RPC).
create policy messages_update_recipient on public.messages
  for update using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy messages_delete_involved on public.messages
  for delete using (sender_id = auth.uid() or recipient_id = auth.uid());

-- ─── send_message: optional seed gift + optional note, friends-only ────────
create or replace function public.send_message(
  recipient_in uuid,
  body_in      text default null,
  species_in   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.plant_species;
  season_now text := public.current_utc_season();
  seed_row_id uuid;
  msg_id uuid;
  body_trim text;
begin
  if recipient_in = auth.uid() then
    raise exception 'cannot message yourself';
  end if;
  if not exists (
    select 1 from public.friendships
     where user_id = auth.uid()
       and friend_id = recipient_in
       and status = 'accepted'
  ) then
    raise exception 'you can only message accepted friends';
  end if;

  body_trim := nullif(trim(coalesce(body_in, '')), '');
  if body_trim is null and species_in is null then
    raise exception 'message needs a body or a seed';
  end if;

  if species_in is not null then
    select * into sp from public.plant_species where id = species_in;
    if sp.id is null then raise exception 'unknown species'; end if;
    if sp.season not in ('always', season_now) then
      raise exception '% is out of season', sp.name;
    end if;
    perform public.spend_coins(
      auth.uid(), sp.seed_cost * 2, 'gift:' || sp.slug, recipient_in
    );
    insert into public.user_seeds (user_id, species_id, gifted_by)
    values (recipient_in, species_in, auth.uid())
    returning id into seed_row_id;
  end if;

  insert into public.messages (sender_id, recipient_id, body, seed_id, species_id)
  values (auth.uid(), recipient_in, body_trim, seed_row_id, species_in)
  returning id into msg_id;

  return msg_id;
end;
$$;

revoke all on function public.send_message(uuid, text, uuid) from public;
grant execute on function public.send_message(uuid, text, uuid) to authenticated;

-- ─── mark_message_read ────────────────────────────────────────────────────
create or replace function public.mark_message_read(message_id_in uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages
     set read_at = now()
   where id = message_id_in
     and recipient_id = auth.uid()
     and read_at is null;
$$;

revoke all on function public.mark_message_read(uuid) from public;
grant execute on function public.mark_message_read(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Realtime — make coin_balance updates push live to the client.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles replica identity full;
alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;
