-- Bloomgarden — Phase B.5: garden economy.
-- Adds the pure-plant garden: shop catalog, user bag, plantings, plot count,
-- and all the spend/plant/harvest/gift/fertilize RPCs. Clubhouse deferred.
--
-- Ledger shift: the `coin_ledger.delta >= 0` check from 0003 is relaxed here
-- because spending is a real user action (not a punishment). Earning habits
-- remain positive-only; spending writes negative deltas. `profiles.coin_balance`
-- can never go below zero (enforced in spend_coins).

-- ═══════════════════════════════════════════════════════════════════════════
-- RELAX LEDGER CONSTRAINT
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.coin_ledger drop constraint coin_ledger_delta_check;
-- No new constraint: spend_coins enforces balance >= 0 on update.

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── plant_species (catalog) ─────────────────────────────────────────────────
create table public.plant_species (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  season            text not null check (season in ('spring','summer','autumn','winter','always')),
  rarity            text not null check (rarity in ('common','rare','legendary','heirloom')),
  seed_cost         integer not null check (seed_cost > 0),
  grow_days         integer not null check (grow_days > 0),
  sell_value        integer not null check (sell_value >= 0),
  harvest_type      text not null check (harvest_type in ('keep','crop')),
  -- unlock_rule_json: null = no gate. Otherwise:
  --   {"type":"lifetime_coins","min":2000}
  --   {"type":"streak","category":"exercise","weeks":4}
  unlock_rule_json  jsonb,
  sprite_emoji      text not null default '🌱',   -- placeholder until Saturday design pass
  description       text,
  created_at        timestamptz not null default now()
);

-- ─── garden_plots (plot-count per user) ──────────────────────────────────────
create table public.garden_plots (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  plot_count  integer not null default 4 check (plot_count between 4 and 16),
  created_at  timestamptz not null default now()
);

-- ─── user_seeds (the bag) ────────────────────────────────────────────────────
create table public.user_seeds (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  species_id   uuid not null references public.plant_species(id),
  gifted_by    uuid references auth.users(id) on delete set null,
  acquired_at  timestamptz not null default now()
);

create index user_seeds_user_idx on public.user_seeds (user_id, acquired_at desc);

-- ─── plantings (in-ground: growing, or kept-forever) ─────────────────────────
create table public.plantings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  species_id       uuid not null references public.plant_species(id),
  plot_index       integer not null check (plot_index >= 0 and plot_index < 16),
  planted_at       timestamptz not null default now(),
  harvests_at      timestamptz not null,
  fertilizer_days  integer not null default 0 check (fertilizer_days between 0 and 3),
  status           text not null default 'growing' check (status in ('growing','kept')),
  harvested_at     timestamptz,
  unique (user_id, plot_index)
);

create index plantings_user_idx on public.plantings (user_id, plot_index);

-- ═══════════════════════════════════════════════════════════════════════════
-- EXTEND handle_new_user: auto-provision garden_plots on sign-up
-- ═══════════════════════════════════════════════════════════════════════════
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
  insert into public.garden_plots (user_id) values (new.id);
  return new;
end;
$$;

-- Backfill for existing users
insert into public.garden_plots (user_id)
  select id from public.profiles
  on conflict (user_id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.plant_species enable row level security;
alter table public.garden_plots  enable row level security;
alter table public.user_seeds    enable row level security;
alter table public.plantings     enable row level security;

-- Catalog: readable by anyone signed in; no client writes.
create policy plant_species_read on public.plant_species
  for select using (auth.role() = 'authenticated');

-- Plots: read-own + read-friends (garden visiting); writes via RPC only.
create policy garden_plots_read_self_or_friend on public.garden_plots
  for select using (
    user_id = auth.uid() or public.is_friend_of(user_id)
  );

-- Seeds: read-own only. Friends don't see your bag (private). Writes via RPC.
create policy user_seeds_read_own on public.user_seeds
  for select using (user_id = auth.uid());

-- Plantings: read-own + read-friends (the social payoff — friends see your
-- garden). Writes via RPC only.
create policy plantings_read_self_or_friend on public.plantings
  for select using (
    user_id = auth.uid() or public.is_friend_of(user_id)
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- HELPERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Northern-hemisphere seasons (placeholder — can be made per-user in future
-- via profiles.hemisphere or profiles.timezone).
create or replace function public.current_utc_season()
returns text
language sql stable
as $$
  select case extract(month from (now() at time zone 'UTC'))::int
    when 3 then 'spring' when 4 then 'spring' when 5 then 'spring'
    when 6 then 'summer' when 7 then 'summer' when 8 then 'summer'
    when 9 then 'autumn' when 10 then 'autumn' when 11 then 'autumn'
    else 'winter'
  end;
$$;

-- Plot expansion pricing: 50 × 2^(current_count − 4).
-- 4→5 costs 50, 5→6 costs 100, …, 15→16 costs ~102,400.
create or replace function public.plot_expansion_cost(current_count int)
returns integer
language sql immutable
as $$
  select (50 * (2 ^ (current_count - 4)))::int;
$$;

-- Unlock-rule check. Returns true if the user meets the rule (or null = free).
create or replace function public.meets_unlock_rule(
  target_user uuid,
  rule        jsonb
)
returns boolean
language plpgsql stable
security definer
set search_path = public
as $$
declare
  t text;
  min_lifetime int;
begin
  if rule is null then return true; end if;
  t := rule->>'type';

  if t = 'lifetime_coins' then
    min_lifetime := (rule->>'min')::int;
    return (select lifetime_coins from public.profiles where id = target_user) >= min_lifetime;
  end if;

  -- Streak rules checked in weekly_rollup already; for buy-time gating we
  -- approximate with a simple "hit qualifying days in N of last M weeks".
  -- Phase D will tighten this; for now lifetime_coins is the primary gate.
  if t = 'streak' then
    return true;   -- soft-pass for v1; tighten in Phase D
  end if;

  return false;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COIN ENGINE — spend side
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── spend_coins (internal) ──────────────────────────────────────────────────
-- Writes a negative ledger row and decrements profiles.coin_balance.
-- Does NOT touch lifetime_coins (lifetime is earned, never spent).
-- Throws if balance would go negative.
create or replace function public.spend_coins(
  target_user uuid,
  cost        integer,
  reason_in   text,
  ref         uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if cost <= 0 then return; end if;

  select coin_balance into current_balance
    from public.profiles where id = target_user for update;

  if current_balance is null then
    raise exception 'profile not found for %', target_user;
  end if;
  if current_balance < cost then
    raise exception 'insufficient coins (have %, need %)', current_balance, cost;
  end if;

  update public.profiles
     set coin_balance = coin_balance - cost
   where id = target_user;

  insert into public.coin_ledger (user_id, delta, reason, ref_id)
  values (target_user, -cost, reason_in, ref);
end;
$$;

revoke all on function public.spend_coins(uuid, integer, text, uuid) from public;
-- internal only

-- ═══════════════════════════════════════════════════════════════════════════
-- GARDEN RPCs
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── buy_seed: adds a seed to the bag ───────────────────────────────────────
-- Validates season (either matches current or 'always'), rarity gate, and
-- unlock_rule. Deducts seed_cost via spend_coins.
create or replace function public.buy_seed(species_id_in uuid)
returns public.user_seeds
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.plant_species;
  row public.user_seeds;
  season_now text := public.current_utc_season();
begin
  select * into sp from public.plant_species where id = species_id_in;
  if sp.id is null then raise exception 'unknown species'; end if;

  if sp.season not in ('always', season_now) then
    raise exception '% is out of season', sp.name;
  end if;
  if not public.meets_unlock_rule(auth.uid(), sp.unlock_rule_json) then
    raise exception '% is not unlocked yet', sp.name;
  end if;

  perform public.spend_coins(auth.uid(), sp.seed_cost, 'shop:seed:' || sp.slug, sp.id);

  insert into public.user_seeds (user_id, species_id)
  values (auth.uid(), species_id_in)
  returning * into row;

  return row;
end;
$$;
revoke all on function public.buy_seed(uuid) from public;
grant execute on function public.buy_seed(uuid) to authenticated;

-- ─── buy_mystery_pack: random seed from a tier in current season ────────────
create or replace function public.buy_mystery_pack(tier_in text)
returns public.user_seeds
language plpgsql
security definer
set search_path = public
as $$
declare
  pack_cost integer;
  season_now text := public.current_utc_season();
  chosen public.plant_species;
  row public.user_seeds;
begin
  if tier_in = 'common' then
    pack_cost := 20;
  elsif tier_in = 'rare' then
    pack_cost := 75;
  elsif tier_in = 'legendary' then
    pack_cost := 250;
  else
    raise exception 'unknown pack tier %', tier_in;
  end if;

  select * into chosen
    from public.plant_species
   where rarity = tier_in
     and season in ('always', season_now)
     and (unlock_rule_json is null or public.meets_unlock_rule(auth.uid(), unlock_rule_json))
   order by random()
   limit 1;

  if chosen.id is null then
    raise exception 'no % seeds available this season', tier_in;
  end if;

  perform public.spend_coins(auth.uid(), pack_cost, 'shop:pack:' || tier_in, chosen.id);

  insert into public.user_seeds (user_id, species_id)
  values (auth.uid(), chosen.id)
  returning * into row;

  return row;
end;
$$;
revoke all on function public.buy_mystery_pack(text) from public;
grant execute on function public.buy_mystery_pack(text) to authenticated;

-- ─── buy_plot_expansion: +1 plot, scaling price ─────────────────────────────
create or replace function public.buy_plot_expansion()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  cost integer;
begin
  select plot_count into current_count
    from public.garden_plots where user_id = auth.uid() for update;

  if current_count is null then
    insert into public.garden_plots (user_id) values (auth.uid());
    current_count := 4;
  end if;

  if current_count >= 16 then
    raise exception 'max plots reached';
  end if;

  cost := public.plot_expansion_cost(current_count);
  perform public.spend_coins(auth.uid(), cost, 'shop:plot_expansion');

  update public.garden_plots
     set plot_count = plot_count + 1
   where user_id = auth.uid();

  return current_count + 1;
end;
$$;
revoke all on function public.buy_plot_expansion() from public;
grant execute on function public.buy_plot_expansion() to authenticated;

-- ─── plant_seed: move a seed from bag into a plot ───────────────────────────
create or replace function public.plant_seed(
  seed_id_in    uuid,
  plot_index_in integer
)
returns public.plantings
language plpgsql
security definer
set search_path = public
as $$
declare
  seed public.user_seeds;
  sp public.plant_species;
  plots int;
  row public.plantings;
begin
  select * into seed from public.user_seeds
    where id = seed_id_in and user_id = auth.uid();
  if seed.id is null then raise exception 'seed not in your bag'; end if;

  select plot_count into plots from public.garden_plots where user_id = auth.uid();
  if plot_index_in >= coalesce(plots, 4) then
    raise exception 'plot % is outside your garden', plot_index_in;
  end if;

  if exists (
    select 1 from public.plantings
     where user_id = auth.uid() and plot_index = plot_index_in
  ) then
    raise exception 'plot % is already occupied', plot_index_in;
  end if;

  select * into sp from public.plant_species where id = seed.species_id;

  insert into public.plantings (user_id, species_id, plot_index, harvests_at)
  values (
    auth.uid(),
    seed.species_id,
    plot_index_in,
    now() + (sp.grow_days::text || ' days')::interval
  )
  returning * into row;

  delete from public.user_seeds where id = seed_id_in;

  return row;
end;
$$;
revoke all on function public.plant_seed(uuid, integer) from public;
grant execute on function public.plant_seed(uuid, integer) to authenticated;

-- ─── apply_fertilizer: −1 day, max 3 per planting, 15 coins each ────────────
create or replace function public.apply_fertilizer(planting_id_in uuid)
returns public.plantings
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.plantings;
  row public.plantings;
begin
  select * into pl from public.plantings
    where id = planting_id_in and user_id = auth.uid();
  if pl.id is null then raise exception 'planting not found'; end if;
  if pl.status <> 'growing' then raise exception 'only growing plants can be fertilized'; end if;
  if pl.fertilizer_days >= 3 then raise exception 'fertilizer maxed for this planting'; end if;

  perform public.spend_coins(auth.uid(), 15, 'shop:fertilizer', pl.id);

  update public.plantings
     set fertilizer_days = fertilizer_days + 1,
         harvests_at     = harvests_at - interval '1 day'
   where id = planting_id_in
   returning * into row;

  return row;
end;
$$;
revoke all on function public.apply_fertilizer(uuid) from public;
grant execute on function public.apply_fertilizer(uuid) to authenticated;

-- ─── harvest_planting: keep (display forever) or sell (coins) ───────────────
create or replace function public.harvest_planting(
  planting_id_in uuid,
  action_in      text  -- 'keep' | 'sell'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pl public.plantings;
  sp public.plant_species;
begin
  select * into pl from public.plantings
    where id = planting_id_in and user_id = auth.uid();
  if pl.id is null then raise exception 'planting not found'; end if;
  if pl.status <> 'growing' then raise exception 'already harvested'; end if;
  if pl.harvests_at > now() then raise exception 'not ready yet'; end if;

  select * into sp from public.plant_species where id = pl.species_id;

  if action_in = 'keep' then
    update public.plantings
       set status = 'kept', harvested_at = now()
     where id = planting_id_in;
  elsif action_in = 'sell' then
    if sp.harvest_type = 'keep' then
      raise exception 'display plants cannot be sold';
    end if;
    -- Sell writes a POSITIVE ledger row and updates balance + lifetime.
    perform public.award_coins(
      auth.uid(), sp.sell_value, 'sell:' || sp.slug, pl.id, (now() at time zone 'UTC')::date
    );
    delete from public.plantings where id = planting_id_in;
  else
    raise exception 'action must be keep or sell';
  end if;
end;
$$;
revoke all on function public.harvest_planting(uuid, text) from public;
grant execute on function public.harvest_planting(uuid, text) to authenticated;

-- ─── gift_seed: pay 2× seed_cost, give to an accepted friend ────────────────
create or replace function public.gift_seed(
  species_id_in uuid,
  friend_id_in  uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sp public.plant_species;
  season_now text := public.current_utc_season();
  new_seed uuid;
begin
  if friend_id_in = auth.uid() then
    raise exception 'cannot gift to yourself';
  end if;
  if not exists (
    select 1 from public.friendships
     where user_id = auth.uid() and friend_id = friend_id_in and status = 'accepted'
  ) then
    raise exception 'you can only gift to accepted friends';
  end if;

  select * into sp from public.plant_species where id = species_id_in;
  if sp.id is null then raise exception 'unknown species'; end if;
  if sp.season not in ('always', season_now) then
    raise exception '% is out of season', sp.name;
  end if;

  perform public.spend_coins(
    auth.uid(), sp.seed_cost * 2, 'gift:' || sp.slug, friend_id_in
  );

  insert into public.user_seeds (user_id, species_id, gifted_by)
  values (friend_id_in, species_id_in, auth.uid())
  returning id into new_seed;

  return new_seed;
end;
$$;
revoke all on function public.gift_seed(uuid, uuid) from public;
grant execute on function public.gift_seed(uuid, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA — plant species catalog
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.plant_species
  (slug, name, season, rarity, seed_cost, grow_days, sell_value, harvest_type, unlock_rule_json, sprite_emoji, description)
values
  -- Always-available staples
  ('daisy',        'Daisy',        'always', 'common',    10,  3,  16, 'crop', null, '🌼', 'Always in bloom. Gentle, cheerful.'),
  ('basil',        'Basil',        'always', 'common',    12,  3,  20, 'crop', null, '🌿', 'Fragrant kitchen herb.'),
  ('young-oak',    'Young oak',    'always', 'rare',     100, 10,   0, 'keep', null, '🌳', 'Slow-growing keep-forever tree.'),

  -- Spring
  ('tulip',          'Tulip',          'spring', 'common', 15, 4, 25,  'crop', null, '🌷', 'Spring bulb, bright and quick.'),
  ('magnolia',       'Magnolia',       'spring', 'common', 20, 5, 35,  'crop', null, '🌸', 'Soft pink petals, full of spring.'),
  ('cherry-blossom', 'Cherry blossom', 'spring', 'rare',   50, 5,   0, 'keep', null, '🌸', 'Keep-forever display plant.'),
  ('peony',          'Peony',          'spring', 'rare',   60, 6, 100, 'crop', null, '🌺', 'Round, luxurious bloom.'),

  -- Summer
  ('sunflower',      'Sunflower',      'summer', 'common', 20, 5, 35,  'crop', null, '🌻', 'Follows the sun; tall and happy.'),
  ('jasmine',        'Jasmine',        'summer', 'common', 25, 5, 40,  'crop', null, '🤍', 'Night-fragrant white blooms.'),
  ('lavender',       'Lavender',       'summer', 'rare',   55, 6, 95,  'crop', null, '💜', 'Quiets the mind.'),
  ('bougainvillea',  'Bougainvillea',  'summer', 'rare',   70, 7,   0, 'keep', null, '🌺', 'Vivid trellis-climber. Kept forever.'),

  -- Autumn
  ('cosmos',          'Cosmos',           'autumn', 'common', 10, 4, 18, 'crop', null, '🌸', 'Wind-light pink petals.'),
  ('chrysanthemum',   'Chrysanthemum',    'autumn', 'common', 15, 4, 25, 'crop', null, '🌼', 'Layered and cozy.'),
  ('ornamental-kale', 'Ornamental kale',  'autumn', 'common', 20, 5, 30, 'crop', null, '🥬', 'Rosette of autumn purple.'),
  ('japanese-maple',  'Japanese maple',   'autumn', 'rare',   80, 7,  0, 'keep', null, '🍁', 'Keep-forever crimson.'),

  -- Winter
  ('poinsettia',   'Poinsettia',    'winter', 'common', 20, 5, 30,  'crop', null, '🌺', 'Deep red winter bract.'),
  ('winter-berry', 'Winter berry',  'winter', 'common', 15, 4, 25,  'crop', null, '🍒', 'Cold-weather jewel tones.'),
  ('hellebore',    'Hellebore',     'winter', 'rare',   50, 6, 85,  'crop', null, '🌷', 'Blooms through frost.'),
  ('evergreen',    'Evergreen',     'winter', 'rare',   60, 7,  0,  'keep', null, '🌲', 'Kept forever. Steady and still.'),

  -- Legendary (lifetime-gated)
  ('dragon-fruit',    'Dragon fruit',    'always', 'legendary', 300, 14, 500,
    'crop', '{"type":"lifetime_coins","min":1200}'::jsonb, '🐉', 'Rare tropical. Unlocks at 1200 lifetime coins.'),
  ('wisteria-arch',   'Wisteria arch',   'spring', 'legendary', 400, 14,  0,
    'keep', '{"type":"lifetime_coins","min":1800}'::jsonb, '🪻', 'A cascading spring arch. Display forever.'),

  -- Heirloom (lifetime-gated, display-only, expensive, status symbols)
  ('rainbow-rose',    'Rainbow rose',    'always', 'heirloom',  600, 14, 0,
    'keep', '{"type":"lifetime_coins","min":2000}'::jsonb, '🌹', 'Heirloom. A long-haul gardener''s prize.'),
  ('moonflower',      'Moonflower',      'always', 'heirloom',  800, 18, 0,
    'keep', '{"type":"lifetime_coins","min":2500}'::jsonb, '🌙', 'Heirloom. Unfurls at midnight.'),
  ('ancient-bonsai',  'Ancient bonsai',  'always', 'heirloom', 1000, 21, 0,
    'keep', '{"type":"lifetime_coins","min":3000}'::jsonb, '🎍', 'Heirloom. Decades in one pot.'),
  ('wisteria-tree',   'Wisteria tree',   'always', 'heirloom', 1200, 21, 0,
    'keep', '{"type":"lifetime_coins","min":4000}'::jsonb, '🪻', 'The garden''s crown jewel.');
