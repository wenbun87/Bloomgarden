import { useSession } from "@/hooks/useSession";
import { useHabitsToday } from "@/hooks/useHabitsToday";
import { useProfile } from "@/hooks/useProfile";
import { useStreaks } from "@/hooks/useStreaks";
import { useHiddenWidgets } from "@/hooks/useHiddenWidgets";
import { useUserHabits } from "@/hooks/useUserHabits";
import { DailyHabitCard } from "@/widgets/habits/DailyHabitCard";
import { SleepWidget } from "@/widgets/habits/SleepWidget";
import { SocialWidget } from "@/widgets/habits/SocialWidget";
import { PlantsWidget } from "@/widgets/habits/PlantsWidget";
import { DepositWidget } from "@/widgets/habits/DepositWidget";
import { CustomHabitCard } from "@/widgets/habits/CustomHabitCard";
import {
  StreakGridWidget,
  type StreakRow,
} from "@/widgets/habits/StreakGridWidget";
import { BUILTIN_WEEKLY_QUOTA, countInWeek } from "@/lib/quota";
import { HeroStrip } from "@/widgets/garden/HeroStrip";

export default function Dashboard() {
  const { session } = useSession();
  const userId = session?.user.id;
  const {
    byCategory,
    socialWeekCount,
    reload: reloadHabits,
  } = useHabitsToday(userId);
  const { profile, reload: reloadProfile } = useProfile(userId);
  const streaksState = useStreaks(userId);
  const userHabits = useUserHabits(userId);
  const widgets = useHiddenWidgets(userId);

  if (!userId) return null;

  function reloadAll() {
    reloadHabits();
    reloadProfile();
    streaksState.reload();
    userHabits.reload();
  }

  const s = streaksState.streaks;
  const hidden = userHabits.hidden;

  function greeting(): string {
    const h = new Date().getHours();
    if (h < 5) return "evening";
    if (h < 12) return "morning";
    if (h < 18) return "afternoon";
    return "evening";
  }

  const hobbyWeekCount = countInWeek(
    streaksState.qualified.hobby ?? new Set(),
  );
  const mentalWeekCount = countInWeek(
    streaksState.qualified.mental_health ?? new Set(),
  );

  const customPalette = [
    { tint: "text-emerald-600", cellClass: "bg-emerald-400", lightCellClass: "bg-emerald-400/25" },
    { tint: "text-teal-600", cellClass: "bg-teal-400", lightCellClass: "bg-teal-400/25" },
    { tint: "text-fuchsia-600", cellClass: "bg-fuchsia-400", lightCellClass: "bg-fuchsia-400/25" },
    { tint: "text-orange-600", cellClass: "bg-orange-400", lightCellClass: "bg-orange-400/25" },
    { tint: "text-amber-600", cellClass: "bg-amber-400", lightCellClass: "bg-amber-400/25" },
    { tint: "text-cyan-600", cellClass: "bg-cyan-400", lightCellClass: "bg-cyan-400/25" },
  ];

  // Helpers for building qualifiedPeriods for daily-quota habits.
  function weekStartStr(ymd: string): string {
    const d = new Date(ymd + "T00:00:00Z");
    const dow = d.getUTCDay();
    const offset = dow === 0 ? -6 : 1 - dow;
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  function quotaWeekStarts(
    dates: Set<string>,
    target: number,
  ): Set<string> {
    const byWeek = new Map<string, number>();
    for (const d of dates) {
      const w = weekStartStr(d);
      byWeek.set(w, (byWeek.get(w) ?? 0) + 1);
    }
    return new Set(
      [...byWeek.entries()]
        .filter(([, n]) => n >= target)
        .map(([w]) => w),
    );
  }

  const builtinSpec: {
    key: string;
    label: string;
    tint: string;
    cellClass: string;
    lightCellClass: string;
    weeklyTarget?: number;
    periodType?: "week" | "month";
    tappable?: StreakRow["tappable"];
  }[] = [
    { key: "exercise", label: "Exercise", tint: "text-sky-600", cellClass: "bg-sky-400", lightCellClass: "bg-sky-400/25", tappable: { kind: "builtin", category: "exercise" } },
    { key: "hobby", label: "Hobby · 3× weekly", tint: "text-violet-600", cellClass: "bg-violet-400", lightCellClass: "bg-violet-400/25", weeklyTarget: 3, periodType: "week", tappable: { kind: "builtin", category: "hobby" } },
    { key: "mental_health", label: "Mental health · 3× weekly", tint: "text-rose-600", cellClass: "bg-rose-400", lightCellClass: "bg-rose-400/25", weeklyTarget: 3, periodType: "week", tappable: { kind: "builtin", category: "mental_health" } },
    { key: "sleep", label: "Sleep", tint: "text-indigo-600", cellClass: "bg-indigo-400", lightCellClass: "bg-indigo-400/25", tappable: { kind: "builtin", category: "sleep" } },
    { key: "plants", label: "Plants · weekly", tint: "text-lime-600", cellClass: "bg-lime-400", lightCellClass: "bg-lime-400/25", periodType: "week" },
    { key: "social", label: "Social · weekly", tint: "text-pink-600", cellClass: "bg-pink-400", lightCellClass: "bg-pink-400/25", periodType: "week", tappable: { kind: "social" } },
    { key: "savings", label: "Savings · monthly", tint: "text-emerald-700", cellClass: "bg-emerald-500", lightCellClass: "bg-emerald-500/25", periodType: "month", tappable: { kind: "deposit", depositKind: "savings" } },
    { key: "investment", label: "Investing · monthly", tint: "text-cyan-700", cellClass: "bg-cyan-500", lightCellClass: "bg-cyan-500/25", periodType: "month", tappable: { kind: "deposit", depositKind: "investment" } },
  ];

  const builtinRows: StreakRow[] = builtinSpec
    .filter((r) => !hidden.has(r.key))
    .map((r) => {
      const logDays = streaksState.qualified[r.key] ?? new Set<string>();
      let periods = streaksState.qualifiedPeriods[r.key];
      // For daily-quota built-ins, compute periods from logs + target.
      if (r.weeklyTarget) {
        periods = quotaWeekStarts(logDays, r.weeklyTarget);
      }
      return {
        key: r.key,
        label: r.label,
        tint: r.tint,
        cellClass: r.cellClass,
        lightCellClass: r.lightCellClass,
        periodType: r.periodType,
        qualified: logDays,
        qualifiedPeriods: periods,
        tappable: r.tappable,
      };
    });

  const customRows: StreakRow[] = userHabits.habits.map((h, i) => {
    const palette = customPalette[i % customPalette.length];
    const logDates = userHabits.logs
      .filter((l) => l.habit_id === h.id)
      .map((l) => l.date);
    const logDays = new Set(logDates);

    const cadenceLabel =
      h.cadence === "daily"
        ? h.target_per_week
          ? ` · ${h.target_per_week}× weekly`
          : ""
        : h.cadence === "weekly"
          ? " · weekly"
          : " · monthly";

    // Period-level qualification depends on cadence.
    let periods: Set<string> | undefined;
    let periodType: "week" | "month" | undefined;
    if (h.cadence === "daily" && h.target_per_week) {
      periods = quotaWeekStarts(logDays, h.target_per_week);
      periodType = "week";
    } else if (h.cadence === "weekly") {
      // Log date IS the week's Monday — every logged week qualifies.
      periods = new Set(logDates);
      periodType = "week";
    } else if (h.cadence === "monthly") {
      // Log date IS the 1st of the month.
      periods = new Set(logDates);
      periodType = "month";
    }

    return {
      key: `custom:${h.id}`,
      label: `${h.name}${cadenceLabel}`,
      tint: palette.tint,
      cellClass: palette.cellClass,
      lightCellClass: palette.lightCellClass,
      periodType,
      qualified: logDays,
      qualifiedPeriods: periods,
      // Daily custom habits are tappable. Weekly / monthly cells stay
      // read-only since "log this exact day" doesn't map cleanly there.
      tappable:
        h.cadence === "daily"
          ? { kind: "custom", habitId: h.id }
          : undefined,
    };
  });

  const streakRows = [...builtinRows, ...customRows];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">
          Good {greeting()},{" "}
          <span style={{ color: "var(--color-grass-deep)" }}>
            {profile?.display_name?.split(" ")[0] ?? "friend"}
          </span>
          .
        </h1>
        <p className="page-sub">
          A calm place to grow your life. Tap a card to log a habit, earn
          coins, and grow your garden with friends.
        </p>
      </div>

      <HeroStrip />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!hidden.has("exercise") && (
          <DailyHabitCard
            category="exercise"
            title="Exercise"
            hint="30+ min of movement, steps, a workout, a walk."
            existing={byCategory.exercise}
            streak={s.exercise}
            onChanged={reloadAll}
          />
        )}
        {!hidden.has("hobby") && (
          <DailyHabitCard
            category="hobby"
            title="Hobby"
            hint="Reading, a side project, music — anything chosen."
            existing={byCategory.hobby}
            streak={s.hobby}
            weeklyCount={hobbyWeekCount}
            weeklyTarget={BUILTIN_WEEKLY_QUOTA.hobby}
            onChanged={reloadAll}
          />
        )}
        {!hidden.has("mental_health") && (
          <DailyHabitCard
            category="mental_health"
            title="Mental health"
            hint="Meditation, yoga, sauna — caring for your nervous system."
            existing={byCategory.mental_health}
            streak={s.mental_health}
            weeklyCount={mentalWeekCount}
            weeklyTarget={BUILTIN_WEEKLY_QUOTA.mental_health}
            onChanged={reloadAll}
          />
        )}
        {!hidden.has("sleep") && (
          <SleepWidget
            existing={byCategory.sleep}
            streak={s.sleep}
            onChanged={reloadAll}
          />
        )}
        {!hidden.has("plants") && <PlantsWidget userId={userId} />}
        {!hidden.has("social") && (
          <SocialWidget
            existing={byCategory.social}
            weekCount={socialWeekCount}
            streak={s.social}
            onChanged={reloadAll}
          />
        )}
        {!hidden.has("savings") && (
          <DepositWidget userId={userId} kind="savings" />
        )}
        {!hidden.has("investment") && (
          <DepositWidget userId={userId} kind="investment" />
        )}
        {userHabits.habits.map((h) => (
          <CustomHabitCard
            key={h.id}
            habit={h}
            logs={userHabits.logs}
            onChanged={reloadAll}
          />
        ))}
      </section>

      {!widgets.hidden.has("dashboard:streaks") && (
        <StreakGridWidget rows={streakRows} onChanged={reloadAll} />
      )}
    </div>
  );
}
