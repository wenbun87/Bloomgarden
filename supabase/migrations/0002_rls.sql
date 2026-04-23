-- Bloomgarden RLS — Phase A subset.
-- Principle: every user sees only their own data + data of accepted friends.
-- Nothing is readable without a session. Reviewed twice per CLAUDE.md rule.

alter table public.profiles    enable row level security;
alter table public.friendships enable row level security;

-- ─── profiles ────────────────────────────────────────────────────────────────

-- Read: self, or anyone you're accepted-friends with.
create policy profiles_read_self_or_friend
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid()
        and f.friend_id = profiles.id
        and f.status = 'accepted'
    )
  );

-- Lookup-by-username: anyone signed in can resolve a username to an id so
-- friend requests work. This view is the only path to another user's row that
-- bypasses the friend check — and it exposes only non-sensitive fields.
-- `security_invoker = off` makes the view run as its owner, bypassing RLS on
-- `profiles`. Without this, users can't find each other to send requests.
create or replace view public.profile_lookup
  with (security_invoker = off)
  as
  select id, username, display_name, avatar_url
  from public.profiles;

grant select on public.profile_lookup to authenticated;

-- Insert: only via the on_auth_user_created trigger (security definer).
-- Clients never insert profiles directly.

-- Update: self only, and only fields the user owns.
-- coin_balance / lifetime_coins become function-only in migration 0003.
create policy profiles_update_self
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── friendships ─────────────────────────────────────────────────────────────

-- Read: either side of the edge.
create policy friendships_read_involved
  on public.friendships for select
  using (user_id = auth.uid() or friend_id = auth.uid());

-- Insert: only the requester can create a pending row.
create policy friendships_insert_self_request
  on public.friendships for insert
  with check (user_id = auth.uid() and status = 'pending');

-- Update (accept): only the recipient of a pending request can flip to accepted.
-- To keep the "two rows per accepted edge" invariant, we accept via an RPC
-- below rather than a raw UPDATE from the client.
-- (No client-side UPDATE policy on friendships.)

-- Delete: either side can unfriend / cancel a request.
create policy friendships_delete_involved
  on public.friendships for delete
  using (user_id = auth.uid() or friend_id = auth.uid());

-- ─── RPC: accept_friend_request ──────────────────────────────────────────────
-- Flips the pending row to accepted AND inserts the reciprocal accepted row,
-- in a single transaction. Called by the recipient.
create or replace function public.accept_friend_request(requester uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if requester = auth.uid() then
    raise exception 'cannot accept your own request';
  end if;

  update public.friendships
     set status = 'accepted'
   where user_id = requester
     and friend_id = auth.uid()
     and status = 'pending';

  if not found then
    raise exception 'no pending request from %', requester;
  end if;

  insert into public.friendships (user_id, friend_id, status)
  values (auth.uid(), requester, 'accepted')
  on conflict (user_id, friend_id) do update
    set status = 'accepted';
end;
$$;

revoke all on function public.accept_friend_request(uuid) from public;
grant execute on function public.accept_friend_request(uuid) to authenticated;
