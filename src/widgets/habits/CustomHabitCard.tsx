import { useState } from "react";
import { Check, Coins } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { StreakBadge } from "@/components/StreakBadge";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { UserHabit, UserHabitLog } from "@/hooks/useUserHabits";
import {
  currentSlotForCadence,
  customHabitStreak,
} from "@/hooks/useUserHabits";
import { weekStartUtc } from "@/lib/dates";

const CADENCE_REWARD: Record<UserHabit["cadence"], number> = {
  daily: 2,
  weekly: 5,
  monthly: 20,
};

type Props = {
  habit: UserHabit;
  logs: UserHabitLog[];
  onChanged: () => void;
};

function addDaysUtc(ymd: string, delta: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function CustomHabitCard({ habit, logs, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slot = currentSlotForCadence(habit.cadence);
  const existing = logs.find((l) => l.habit_id === habit.id && l.date === slot);
  const loggedThisSlot = !!existing;

  const isQuota =
    habit.cadence === "daily" && habit.target_per_week != null;
  const quotaTarget = habit.target_per_week ?? 0;
  const quotaBonus = quotaTarget * CADENCE_REWARD.daily;

  // For daily-quota: count this week's logs across all days.
  let weeklyCount = 0;
  if (isQuota) {
    const wkStart = weekStartUtc();
    const wkEnd = addDaysUtc(wkStart, 7);
    weeklyCount = logs.filter(
      (l) => l.habit_id === habit.id && l.date >= wkStart && l.date < wkEnd,
    ).length;
  }
  const weekDone = isQuota && weeklyCount >= quotaTarget;

  const subtitle =
    habit.cadence === "daily"
      ? isQuota
        ? `${quotaTarget}× weekly`
        : "Daily"
      : habit.cadence === "weekly"
        ? "Weekly"
        : "Monthly";

  const streak = customHabitStreak(habit, logs);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("log_custom_habit", {
      habit_id_in: habit.id,
    });
    setBusy(false);
    if (rpcErr) return setError(rpcErr.message);
    onChanged();
  }

  return (
    <WidgetCard
      title={habit.name}
      subtitle={subtitle}
      action={<StreakBadge count={streak} />}
    >
      {loggedThisSlot ? (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-green-100 text-green-700">
              <Check size={14} />
            </span>
            <span>
              {isQuota
                ? `Logged today · ${weeklyCount}/${quotaTarget} this week`
                : `Done · +${existing.coins_awarded}`}
            </span>
          </div>
          {isQuota && (
            <WeeklyProgress
              count={weeklyCount}
              target={quotaTarget}
              bonus={quotaBonus}
              done={weekDone}
            />
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col space-y-2">
          <p className="min-h-[2.5rem] text-xs text-[var(--color-muted)]">
            Your own habit. Tap when done.
          </p>
          {isQuota && (
            <WeeklyProgress
              count={weeklyCount}
              target={quotaTarget}
              bonus={quotaBonus}
              done={weekDone}
            />
          )}
          <Button onClick={submit} disabled={busy} className="mt-auto w-full">
            {busy ? "Logging…" : "Did it"}
          </Button>
          <p className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <Coins size={12} />
            {isQuota
              ? `+${quotaBonus} when you hit your weekly target`
              : `+${CADENCE_REWARD[habit.cadence]}`}
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </WidgetCard>
  );
}

function WeeklyProgress({
  count,
  target,
  bonus,
  done,
}: {
  count: number;
  target: number;
  bonus: number;
  done: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--color-muted)]">This week</span>
        <span
          className={`tabular-nums ${done ? "text-green-700" : "text-[var(--color-muted)]"}`}
        >
          {count}/{target}
          {done && ` · +${bonus} earned`}
        </span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: target }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-pill ${
              i < count ? "bg-[var(--color-accent)]" : "bg-black/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
