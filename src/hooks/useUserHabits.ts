import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayUtc, weekStartUtc } from "@/lib/dates";

export type UserHabit = {
  id: string;
  name: string;
  cadence: "daily" | "weekly" | "monthly";
  // Only used when cadence = daily. If set, the habit is "N times per week"
  // — each day still counts individually, but the week is "complete" at N.
  target_per_week: number | null;
  created_at: string;
};

export type UserHabitLog = {
  id: string;
  habit_id: string;
  date: string;
  coins_awarded: number;
};

type State = {
  habits: UserHabit[];
  hidden: Set<string>;
  logs: UserHabitLog[];
  loading: boolean;
  error: string | null;
};

// Builtin categories that can be hidden. Mirrors the CHECK constraint in 0011.
export const HIDEABLE_CATEGORIES = [
  "exercise",
  "hobby",
  "mental_health",
  "sleep",
  "plants",
  "social",
  "savings",
  "investment",
] as const;

export type HideableCategory = (typeof HIDEABLE_CATEGORIES)[number];

function monthStartUtc(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function addDaysUtcStr(ymd: string, delta: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function addMonthsUtcStr(ymd: string, delta: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}

export function useUserHabits(userId: string | undefined) {
  const [state, setState] = useState<State>({
    habits: [],
    hidden: new Set(),
    logs: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: null }));

    // 365 days keeps a full year of streak history handy.
    const cutoff = addDaysUtcStr(todayUtc(), -365);

    const [habitsRes, hiddenRes, logsRes] = await Promise.all([
      supabase
        .from("user_habits")
        .select("*")
        .eq("user_id", userId)
        .order("created_at"),
      supabase
        .from("user_habit_hidden")
        .select("category")
        .eq("user_id", userId),
      supabase
        .from("user_habit_logs")
        .select("id, habit_id, date, coins_awarded")
        .eq("user_id", userId)
        .gte("date", cutoff)
        .order("date", { ascending: false }),
    ]);

    const err = habitsRes.error || hiddenRes.error || logsRes.error;
    if (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
      return;
    }

    setState({
      habits: (habitsRes.data ?? []) as UserHabit[],
      hidden: new Set(
        ((hiddenRes.data ?? []) as { category: string }[]).map((r) => r.category),
      ),
      logs: (logsRes.data ?? []) as UserHabitLog[],
      loading: false,
      error: null,
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

// Returns the expected slot date for a habit based on its cadence.
export function currentSlotForCadence(
  cadence: UserHabit["cadence"],
): string {
  if (cadence === "daily") return todayUtc();
  if (cadence === "weekly") return weekStartUtc();
  return monthStartUtc();
}

// Current consecutive-streak count for a custom habit. Walks back from the
// current slot (lenient: if current slot isn't logged yet, starts at the
// previous slot, so missing "today" doesn't break a daily streak mid-day).
export function customHabitStreak(
  habit: UserHabit,
  logs: UserHabitLog[],
): number {
  const dates = new Set(
    logs.filter((l) => l.habit_id === habit.id).map((l) => l.date),
  );
  if (dates.size === 0) return 0;

  const step = (ymd: string): string => {
    if (habit.cadence === "daily") return addDaysUtcStr(ymd, -1);
    if (habit.cadence === "weekly") return addDaysUtcStr(ymd, -7);
    return addMonthsUtcStr(ymd, -1);
  };

  const current = currentSlotForCadence(habit.cadence);
  const prev = step(current);
  const start = dates.has(current)
    ? current
    : dates.has(prev)
      ? prev
      : null;
  if (!start) return 0;

  let count = 0;
  let cursor = start;
  while (dates.has(cursor)) {
    count += 1;
    cursor = step(cursor);
  }
  return count;
}
