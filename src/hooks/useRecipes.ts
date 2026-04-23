import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type RecipeIngredient = {
  name: string;
  amount: string;
  have?: boolean;
};

export type Recipe = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  minutes: number | null;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients_json: RecipeIngredient[];
  steps_json: string[];
  health_notes: string | null;
  source: "ai" | "manual";
  created_at: string;
};

type State = {
  recipes: Recipe[];
  loading: boolean;
  error: string | null;
};

function numberify(rows: Recipe[]): Recipe[] {
  return rows.map((r) => ({
    ...r,
    calories: Number(r.calories),
    protein_g: Number(r.protein_g),
    carbs_g: Number(r.carbs_g),
    fat_g: Number(r.fat_g),
    servings: Number(r.servings),
  }));
}

export function useRecipes(userId: string | undefined) {
  const [state, setState] = useState<State>({
    recipes: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      setState({ recipes: [], loading: false, error: error.message });
      return;
    }
    setState({
      recipes: numberify((data ?? []) as Recipe[]),
      loading: false,
      error: null,
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
