import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type PlantSpecies = {
  id: string;
  slug: string;
  name: string;
  season: "spring" | "summer" | "autumn" | "winter" | "always";
  rarity: "common" | "rare" | "legendary" | "heirloom";
  seed_cost: number;
  grow_days: number;
  sell_value: number;
  harvest_type: "keep" | "crop";
  unlock_rule_json: { type: string; min?: number } | null;
  sprite_emoji: string;
  description: string | null;
};

export type UserSeed = {
  id: string;
  species_id: string;
  gifted_by: string | null;
  acquired_at: string;
  species: PlantSpecies;
};

export type Planting = {
  id: string;
  user_id: string;
  species_id: string;
  plot_index: number | null;       // null when on the display wall
  planted_at: string;
  harvests_at: string;
  fertilizer_days: number;
  status: "growing" | "kept";
  harvested_at: string | null;
  displayed: boolean;
  species: PlantSpecies;
};

type GardenState = {
  species: PlantSpecies[];
  seeds: UserSeed[];
  plantings: Planting[];
  plotCount: number;
  loading: boolean;
  error: string | null;
};

// Single hook for the whole garden snapshot: catalog + user bag + plantings +
// plot count. Cheaper than four scattered fetches and keeps refresh coherent.
export function useGarden(userId: string | undefined) {
  const [state, setState] = useState<GardenState>({
    species: [],
    seeds: [],
    plantings: [],
    plotCount: 4,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));

    const [speciesRes, seedsRes, plantingsRes, plotsRes] = await Promise.all([
      supabase.from("plant_species").select("*").order("rarity").order("name"),
      supabase
        .from("user_seeds")
        .select("id, species_id, gifted_by, acquired_at, species:plant_species(*)")
        .eq("user_id", userId)
        .order("acquired_at", { ascending: false }),
      supabase
        .from("plantings")
        .select(
          "id, user_id, species_id, plot_index, planted_at, harvests_at, fertilizer_days, status, harvested_at, displayed, species:plant_species(*)",
        )
        .eq("user_id", userId)
        .order("plot_index", { nullsFirst: false }),
      supabase
        .from("garden_plots")
        .select("plot_count")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    // Load partials. A single failing query (e.g. plantings missing a new
    // column before a migration runs) shouldn't take down species + seeds +
    // plot count too — render what we have, surface the error string.
    const firstErr =
      speciesRes.error ||
      seedsRes.error ||
      plantingsRes.error ||
      plotsRes.error;

    setState({
      species: (speciesRes.data ?? []) as PlantSpecies[],
      seeds: (seedsRes.data ?? []) as unknown as UserSeed[],
      plantings: (plantingsRes.data ?? []) as unknown as Planting[],
      plotCount:
        (plotsRes.data as { plot_count: number } | null)?.plot_count ?? 4,
      loading: false,
      error: firstErr ? firstErr.message : null,
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const plantingsByPlot = useMemo(() => {
    const m = new Map<number, Planting>();
    for (const p of state.plantings) {
      if (p.plot_index !== null) m.set(p.plot_index, p);
    }
    return m;
  }, [state.plantings]);

  const displayed = useMemo(
    () => state.plantings.filter((p) => p.displayed),
    [state.plantings],
  );

  return { ...state, plantingsByPlot, displayed, reload: load };
}
