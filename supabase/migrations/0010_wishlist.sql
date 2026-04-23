-- Bloomgarden — wishlist. Items friends can browse (when show_in_profile=true)
-- to see what you'd like as a gift. Private-by-default.

create table public.wishlist_items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 140),
  url              text,
  price            numeric(12,2),
  notes            text check (notes is null or char_length(notes) <= 300),
  show_in_profile  boolean not null default false,
  created_at       timestamptz not null default now()
);

create index wishlist_items_user_idx on public.wishlist_items (user_id, created_at desc);

alter table public.wishlist_items enable row level security;

-- Owner: full CRUD.
create policy wishlist_own on public.wishlist_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Accepted friends can read items the owner chose to share.
create policy wishlist_read_public_to_friends on public.wishlist_items
  for select using (
    show_in_profile = true
    and public.is_friend_of(user_id)
  );
