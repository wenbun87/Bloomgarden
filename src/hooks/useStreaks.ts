import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayUtc, weekStartUtc } from "@/lib/dates";

type DailyCat = "exercise" | "hobby" | "mental_health" | "sleep";

type Streaks = {
  exercise: number;
  hobby: number;
  mental_health: number;
  sleep: number;
  social: number;
};

// Two parallel maps keyed by habit category.
//  - qualified:        ACTUAL log days (rendered dark in the year grid)
//  - qualifiedPeriods: period-start dates for qualifying weeks / months
//                      (Monday for week-qualifying, 1st for month-qualifying)
// Dashboard combines these into the StreakRow shape the grid consumes.
type DateMap = Record<string, Set<string>>;

function addDaysUtc(ymd: string, delta: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function addWeeksUtc(ymd: string, delta: number): string {
  return addDaysUtc(ymd, delta * 7);
}

function weekStartOf(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function monthStartOf(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export function useStreaks(userId: string | undefined) {
  const [streaks, setStreaks] = useState<Streaks>({
    exercise: 0,
    hobby: 0,
    mental_health: 0,
    sleep: 0,
    social: 0,
  });
  const [qualified, setQualified] = useState<DateMap>({});
  const [qualifiedPeriods, setQualifiedPeriods] = useState<DateMap>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const cutoff = addDaysUtc(todayUtc(), -365);

    const [logsRes, plantsRes, savingsRes, investingRes, savingsGoalRes, investGoalRes] =
      await Promise.all([
        supabase
          .from("habit_logs")
          .select("category, date, coins_awarded")
          .eq("user_id", userId)
          .gte("date", cutoff),
        supabase
          .from("plant_logs")
          .select("plant_name, date")
          .eq("user_id", userId)
          .gte("date", cutoff),
        supabase
          .from("savings_deposits")
          .select("amount, date")
          .eq("user_id", userId)
          .gte("date", cutoff),
        supabase
          .from("investment_deposits")
          .select("amount, date")
          .eq("user_id", userId)
          .gte("date", cutoff),
        supabase
          .from("savings_goals")
          .select("target_amount")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("investment_goals")
          .select("target_amount")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    const q: DateMap = {};
    const p: DateMap = {};

    // ── Daily cats + social from habit_logs ─────────────────────────────
    // Quota cats (hobby, mental_health) and social award 0 per-log coins —
    // they pay via a weekly bonus or are existence-only — so we can't gate
    // them by coins_awarded. Only exercise/sleep use coins>0 as the qualify
    // signal.
    const PAY_PER_LOG = new Set(["exercise", "sleep"]);
    for (const row of (logsRes.data ?? []) as {
      category: string;
      date: string;
      coins_awarded: number;
    }[]) {
      if (PAY_PER_LOG.has(row.category) && row.coins_awarded <= 0) continue;
      if (!q[row.category]) q[row.category] = new Set();
      q[row.category].add(row.date);
    }
    // Social: a week qualifies (light fill) if any social row exists in it.
    // Each row's date may now be any day, so collapse to week-starts.
    if (q.social) {
      const weeks = new Set<string>();
      for (const d of q.social) weeks.add(weekStartOf(d));
      p.social = weeks;
    }

    // ── Plants: days = each plant log date; periods = weeks with 30+ unique
    const plantDays = new Set<string>();
    const byWeek = new Map<string, Set<string>>();
    for (const row of (plantsRes.data ?? []) as {
      plant_name: string;
      date: string;
    }[]) {
      plantDays.add(row.date);
      const w = weekStartOf(row.date);
      if (!byWeek.has(w)) byWeek.set(w, new Set());
      byWeek.get(w)!.add(row.plant_name);
    }
    q.plants = plantDays;
    p.plants = new Set(
      [...byWeek.entries()].filter(([, names]) => names.size >= 30).map(([w]) => w),
    );

    // ── Savings: days = deposit dates; periods = months summing ≥ target ──
    const savingsTarget =
      (savingsGoalRes.data as { target_amount: number | string } | null)
        ?.target_amount != null
        ? Number(savingsGoalRes.data!.target_amount)
        : null;
    {
      const days = new Set<string>();
      const byMonth = new Map<string, number>();
      for (const row of (savingsRes.data ?? []) as {
        amount: number | string;
        date: string;
      }[]) {
        days.add(row.date);
        const m = monthStartOf(row.date);
        byMonth.set(m, (byMonth.get(m) ?? 0) + Number(row.amount));
      }
      q.savings = days;
      if (savingsTarget) {
        p.savings = new Set(
          [...byMonth.entries()]
            .filter(([, sum]) => sum >= savingsTarget)
            .map(([m]) => m),
        );
      } else {
        p.savings = new Set();
      }
    }

    // ── Investing: same pattern ──────────────────────────────────────────
    const investTarget =
      (investGoalRes.data as { target_amount: number | string } | null)
        ?.target_amount != null
        ? Number(investGoalRes.data!.target_amount)
        : null;
    {
      const days = new Set<string>();
      const byMonth = new Map<string, number>();
      for (const row of (investingRes.data ?? []) as {
        amount: number | string;
        date: string;
      }[]) {
        days.add(row.date);
        const m = monthStartOf(row.date);
        byMonth.set(m, (byMonth.get(m) ?? 0) + Number(row.amount));
      }
      q.investment = days;
      if (investTarget) {
        p.investment = new Set(
          [...byMonth.entries()]
            .filter(([, sum]) => sum >= investTarget)
            .map(([m]) => m),
        );
      } else {
        p.investment = new Set();
      }
    }

    const today = todayUtc();
    const yesterday = addDaysUtc(today, -1);

    function dailyStreak(cat: DailyCat): number {
      const set = q[cat];
      if (!set) return 0;
      const start = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
      if (!start) return 0;
      let count = 0;
      let cursor = start;
      while (set.has(cursor)) {
        count += 1;
        cursor = addDaysUtc(cursor, -1);
      }
      return count;
    }

    function socialStreak(): number {
      const set = q.social;
      if (!set) return 0;
      let count = 0;
      let cursor = weekStartUtc();
      while (set.has(cursor)) {
        count += 1;
        cursor = addWeeksUtc(cursor, -1);
      }
      return count;
    }

    setStreaks({
      exercise: dailyStreak("exercise"),
      hobby: dailyStreak("hobby"),
      mental_health: dailyStreak("mental_health"),
      sleep: dailyStreak("sleep"),
      social: socialStreak(),
    });
    setQualified(q);
    setQualifiedPeriods(p);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { streaks, qualified, qualifiedPeriods, loading, reload: load };
}
