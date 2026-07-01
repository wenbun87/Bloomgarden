-- Bloomgarden — the Pruning page. Track items the user is decluttering:
-- listed for sale, given away, or sold. Each row is one item; status moves
-- it through the lifecycle. Funds received from sales feed the weekly
-- summary + funds graph.

create table if not exists public.prune_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  status          text not null check (status in ('listed','given','sold')),
  value           numeric(14,2),                        -- asking / estimated
  funds_received  numeric(14,2),                        -- set on status='sold'
  recipient       text,                                 -- given-to or sold-to
  note            text,
  listed_at       date,
  given_at        date,
  sold_at         date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists prune_items_user_status_idx
  on public.prune_items (user_id, status, sold_at desc);
create index if not exists prune_items_user_sold_idx
  on public.prune_items (user_id, sold_at desc) where status = 'sold';

alter table public.prune_items enable row level security;

create policy prune_items_read_own on public.prune_items
  for select using (auth.uid() = user_id);
create policy prune_items_insert_own on public.prune_items
  for insert with check (auth.uid() = user_id);
create policy prune_items_update_own on public.prune_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy prune_items_delete_own on public.prune_items
  for delete using (auth.uid() = user_id);

-- Touch updated_at on every UPDATE.
create or replace function public.prune_items_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prune_items_touch_trg on public.prune_items;
create trigger prune_items_touch_trg
  before update on public.prune_items
  for each row execute function public.prune_items_touch();
