import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayUtc } from "@/lib/dates";

export type FoodEntry = {
  id: string;
  date: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  grams: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  nutriscore: string | null;
  nova_group: number | null;
  ecoscore: string | null;
  created_at: string;
};

type State = {
  today: FoodEntry[];
  loading: boolean;
  error: string | null;
};

function numberify(rows: FoodEntry[]): FoodEntry[] {
  return rows.map((r) => ({
    ...r,
    grams: Number(r.grams),
    calories: Number(r.calories),
    protein_g: Number(r.protein_g),
    carbs_g: Number(r.carbs_g),
    fat_g: Number(r.fat_g),
    nova_group: r.nova_group == null ? null : Number(r.nova_group),
  }));
}

export function useFoodEntries(userId: string | undefined) {
  const [state, setState] = useState<State>({
    today: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase
      .from("food_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("date", todayUtc())
      .order("created_at", { ascending: false });
    if (error) {
      setState({ today: [], loading: false, error: error.message });
      return;
    }
    setState({
      today: numberify((data ?? []) as FoodEntry[]),
      loading: false,
      error: null,
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
