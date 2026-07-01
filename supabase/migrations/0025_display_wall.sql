-- Bloomgarden — display wall.
-- Kept plants (status='kept') no longer occupy plots. They live on a
-- standalone "Display Collection" wall — `plot_index` is set to NULL and
-- `displayed = true` flags them as displayed-but-not-in-plot.
--
-- Migrates existing kept rows: clears plot_index + flips displayed=true.

-- ─── Schema changes ─────────────────────────────────────────────────────────
alter table public.plantings
  alter column plot_index drop not null;

-- The original unique (user_id, plot_index) constraint blocks NULLs in some
-- Postgres versions and accepts duplicates in others. Replace with a partial
-- unique that only enforces uniqueness when plot_index IS NOT NULL.
alter table public.plantings drop constraint if exists plantings_user_id_plot_index_key;
create unique index if not exists plantings_user_plot_unique
  on public.plantings (user_id, plot_index)
  where plot_index is not null;

alter table public.plantings
  add column if not exists displayed boolean not null default false;

create index if not exists plantings_user_displayed_idx
  on public.plantings (user_id) where displayed = true;

-- ─── Migrate existing kept rows onto the wall ───────────────────────────────
update public.plantings
   set displayed = true,
       plot_index = null
 where status = 'kept';

-- ─── Replace harvest_planting: keep moves the plant onto the display wall ───
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
       set status = 'kept',
           harvested_at = now(),
           displayed = true,
           plot_index = null   -- frees the plot for the next planting
     where id = planting_id_in;
  elsif action_in = 'sell' then
    if sp.harvest_type = 'keep' then
      raise exception 'display plants cannot be sold';
    end if;
    perform public.award_coins(
      auth.uid(), sp.sell_value, 'sell:' || sp.slug, pl.id, (now() at time zone 'UTC')::date
    );
    delete from public.plantings where id = planting_id_in;
  else
    raise exception 'action must be keep or sell';
  end if;
end;
$$;

-- ─── remove_from_display: take a kept plant off the wall (deletes row) ──────
-- Useful if the user wants to clean up. Idempotent.
create or replace function public.remove_from_display(planting_id_in uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.plantings
   where id = planting_id_in
     and user_id = auth.uid()
     and displayed = true;
end;
$$;

revoke all on function public.remove_from_display(uuid) from public;
grant execute on function public.remove_from_display(uuid) to authenticated;
