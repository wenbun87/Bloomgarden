import { useState } from "react";
import { Check, Coins } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { StreakBadge } from "@/components/StreakBadge";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { HabitLog } from "@/hooks/useHabitsToday";
import { DAILY_MINUTE_THRESHOLD, HABIT_DAILY_REWARD } from "@/lib/coins";

// One-tap daily card shared by Exercise, Hobby, and Mental Health. Sleep uses
// its own widget. If `weeklyTarget` is set, the card becomes a quota card:
// tapping still logs today, but the card shows "X/N this week" and marks the
// week "done" at N. Coins still earn per log (capped once per day).
type Props = {
  category: "exercise" | "hobby" | "mental_health";
  title: string;
  hint: string;
  existing: HabitLog | undefined;
  streak: number;
  weeklyCount?: number;       // days this week the habit's been done (0-7)
  weeklyTarget?: number;      // X in "X per week"; omit for daily
  onChanged: () => void;
};

export function DailyHabitCard({
  category,
  title,
  hint,
  existing,
  streak,
  weeklyCount,
  weeklyTarget,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loggedToday = (existing?.coins_awarded ?? 0) > 0;
  const weekDone =
    weeklyTarget != null && (weeklyCount ?? 0) >= weeklyTarget;

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("log_habit", {
      category_in: category,
      minutes_in: DAILY_MINUTE_THRESHOLD,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    onChanged();
  }

  const subtitle = weeklyTarget
    ? `${weeklyTarget}× weekly`
    : "Daily";

  return (
    <WidgetCard
      title={title}
      subtitle={subtitle}
      action={<StreakBadge count={streak} />}
    >
      {loggedToday ? (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-green-100 text-green-700">
              <Check size={14} />
            </span>
            <span>Done today · +{existing?.coins_awarded}</span>
          </div>
          {weeklyTarget != null && (
            <WeeklyProgress
              count={weeklyCount ?? 0}
              target={weeklyTarget}
              done={weekDone}
            />
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col space-y-2">
          <p className="min-h-[2.5rem] text-xs text-[var(--color-muted)]">
            {hint}
          </p>
          {weeklyTarget != null && (
            <WeeklyProgress
              count={weeklyCount ?? 0}
              target={weeklyTarget}
              done={weekDone}
            />
          )}
          <Button
            onClick={submit}
            disabled={busy}
            className="mt-auto w-full"
          >
            {busy ? "Logging…" : "Did it"}
          </Button>
          <p className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <Coins size={12} />+{HABIT_DAILY_REWARD}
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
  done,
}: {
  count: number;
  target: number;
  done: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-[var(--color-muted)]">This week</span>
        <span
          className={`tabular-nums ${done ? "text-green-700" : "text-[var(--color-muted)]"}`}
        >
          {Math.min(count, target)}/{target}
          {done && " · done"}
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
