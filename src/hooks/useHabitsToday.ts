import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayUtc, weekStartUtc } from "@/lib/dates";

export type HabitLog = {
  id: string;
  category: "exercise" | "hobby" | "mental_health" | "sleep" | "social";
  date: string;
  minutes: number | null;
  value_json: Record<string, unknown> | null;
  coins_awarded: number;
};

type State = {
  byCategory: Partial<Record<HabitLog["category"], HabitLog>>;
  loading: boolean;
  error: string | null;
};

export function useHabitsToday(userId: string | undefined) {
  const [state, setState] = useState<State>({
    byCategory: {},
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) {
      setState({ byCategory: {}, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const today = todayUtc();
    const weekStart = weekStartUtc();

    // Daily categories: today's row. Social: this week's row (stored at weekStart).
    const { data, error } = await supabase
      .from("habit_logs")
      .select("id, category, date, minutes, value_json, coins_awarded")
      .eq("user_id", userId)
      .or(`date.eq.${today},and(category.eq.social,date.eq.${weekStart})`);

    if (error) {
      setState({ byCategory: {}, loading: false, error: error.message });
      return;
    }

    const byCategory: State["byCategory"] = {};
    for (const row of (data ?? []) as HabitLog[]) {
      byCategory[row.category] = row;
    }
    setState({ byCategory, loading: false, error: null });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
