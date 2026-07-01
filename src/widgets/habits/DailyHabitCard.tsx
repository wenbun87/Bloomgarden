import { useState } from "react";
import { Check, Coins } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { StreakBadge } from "@/components/StreakBadge";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { HabitLog } from "@/hooks/useHabitsToday";
import { DAILY_MINUTE_THRESHOLD, HABIT_DAILY_REWARD } from "@/lib/coins";

// One-tap daily card shared by Exercise, Hobby, and Mental Health. Sleep uses
// its own widget. If `weeklyTarget` is set, the card is a quota habit:
//  - Each tap logs (one log per day, idempotent).
//  - No coins awarded per log; instead a single `quotaBonus` is awarded once
//    per week when the count first hits the target.
//  - Counter can show 4/3, 5/3, 6/3 — taps past target keep counting.
type Props = {
  category: "exercise" | "hobby" | "mental_health";
  title: string;
  hint: string;
  existing: HabitLog | undefined;
  streak: number;
  weeklyCount?: number;
  weeklyTarget?: number;
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

  const loggedToday = !!existing;
  const isQuota = weeklyTarget != null;
  const count = weeklyCount ?? 0;
  const weekDone = isQuota && count >= (weeklyTarget ?? 0);
  const quotaBonus = isQuota ? HABIT_DAILY_REWARD * (weeklyTarget ?? 0) : 0;

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

  const subtitle = isQuota ? `${weeklyTarget}× weekly` : "Daily";

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
            <span>
              {isQuota
                ? `Logged today · ${count}/${weeklyTarget} this week`
                : `Done today · +${existing.coins_awarded}`}
            </span>
          </div>
          {isQuota && (
            <WeeklyProgress
              count={count}
              target={weeklyTarget!}
              bonus={quotaBonus}
              done={weekDone}
            />
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col space-y-2">
          <p className="min-h-[2.5rem] text-xs text-[var(--color-muted)]">
            {hint}
          </p>
          {isQuota && (
            <WeeklyProgress
              count={count}
              target={weeklyTarget!}
              bonus={quotaBonus}
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
            <Coins size={12} />
            {isQuota
              ? `+${quotaBonus} when you hit your weekly target`
              : `+${HABIT_DAILY_REWARD}`}
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
