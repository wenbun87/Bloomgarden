-- Bloomgarden schema — Phase A subset.
-- Later phases (B, B.5, C, D) add habit_logs, plant_logs, goals, accounts,
-- todos, weekly_scores, coin_ledger, plant_species, plantings, garden_plots,
-- clubhouse, market_briefs, portfolio_*, research_briefs, research_feeds.

create extension if not exists "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name    text not null check (char_length(display_name) between 1 and 40),
  avatar_url      text,
  timezone        text not null default 'UTC',
  coin_balance    integer not null default 0 check (coin_balance >= 0),
  lifetime_coins  integer not null default 0 check (lifetime_coins >= 0),
  global_opt_in   boolean not null default false,
  created_at      timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (username);

-- ─── friendships ─────────────────────────────────────────────────────────────
-- Two rows per accepted friendship (A→B and B→A) so every lookup is a single
-- "where user_id = me" scan. Pending requests are a single row (requester→target).
create table public.friendships (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  friend_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null check (status in ('pending','accepted')),
  created_at  timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index friendships_friend_idx on public.friendships (friend_id);

-- ─── trigger: auto-create a bare profile row on sign-up ──────────────────────
-- Username is provisional (first 16 chars of uid). Onboarding replaces it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'u_' || substr(replace(new.id::text, '-', ''), 1, 14),
    coalesce(new.raw_user_meta_data->>'display_name', 'New Gardener')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
