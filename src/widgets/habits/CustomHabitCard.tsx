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

const CADENCE_REWARD: Record<UserHabit["cadence"], number> = {
  daily: 2,
  weekly: 5,
  monthly: 20,
};

const CADENCE_LABEL: Record<UserHabit["cadence"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

type Props = {
  habit: UserHabit;
  logs: UserHabitLog[];
  onChanged: () => void;
};

export function CustomHabitCard({ habit, logs, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slot = currentSlotForCadence(habit.cadence);
  const existing = logs.find((l) => l.habit_id === habit.id && l.date === slot);
  const done = !!existing;
  const reward = CADENCE_REWARD[habit.cadence];
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
      subtitle={CADENCE_LABEL[habit.cadence]}
      action={<StreakBadge count={streak} />}
    >
      {done ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-green-100 text-green-700">
            <Check size={14} />
          </span>
          <span>Done · +{existing.coins_awarded}</span>
        </div>
      ) : (
        <div className="flex h-full flex-col space-y-2">
          <p className="min-h-[2.5rem] text-xs text-[var(--color-muted)]">
            Your own habit. Tap when done.
          </p>
          <Button onClick={submit} disabled={busy} className="mt-auto w-full">
            {busy ? "Logging…" : "Did it"}
          </Button>
          <p className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <Coins size={12} />+{reward}
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </WidgetCard>
  );
}
