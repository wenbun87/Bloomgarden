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
  socialWeekCount: number;
  loading: boolean;
  error: string | null;
};

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function useHabitsToday(userId: string | undefined) {
  const [state, setState] = useState<State>({
    byCategory: {},
    socialWeekCount: 0,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) {
      setState({ byCategory: {}, socialWeekCount: 0, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const today = todayUtc();
    const wk = weekStartUtc();
    const wkEnd = addDays(wk, 7);

    // Today's daily logs + every social row in the current week (per-day
    // social model — multiple social rows can exist within a single week).
    const { data, error } = await supabase
      .from("habit_logs")
      .select("id, category, date, minutes, value_json, coins_awarded")
      .eq("user_id", userId)
      .or(
        `date.eq.${today},and(category.eq.social,date.gte.${wk},date.lt.${wkEnd})`,
      );

    if (error) {
      setState({
        byCategory: {},
        socialWeekCount: 0,
        loading: false,
        error: error.message,
      });
      return;
    }

    const byCategory: State["byCategory"] = {};
    let socialWeekCount = 0;
    for (const row of (data ?? []) as HabitLog[]) {
      if (row.category === "social") {
        socialWeekCount += 1;
        if (row.date === today) byCategory.social = row;
      } else if (row.date === today) {
        byCategory[row.category] = row;
      }
    }
    setState({
      byCategory,
      socialWeekCount,
      loading: false,
      error: null,
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
