import { useState } from "react";
import { Check, Coins } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { StreakBadge } from "@/components/StreakBadge";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { HabitLog } from "@/hooks/useHabitsToday";
import { HABIT_DAILY_REWARD, SLEEP_HOUR_THRESHOLD } from "@/lib/coins";

const QUALIFYING_HOURS = 7;

type Props = {
  existing: HabitLog | undefined;
  streak: number;
  onChanged: () => void;
};

export function SleepWidget({ existing, streak, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = (existing?.coins_awarded ?? 0) > 0;

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("log_habit", {
      category_in: "sleep",
      value_in: { hours: QUALIFYING_HOURS },
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    onChanged();
  }

  return (
    <WidgetCard
      title="Sleep"
      subtitle="Daily"
      action={<StreakBadge count={streak} />}
    >
      {done ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-green-100 text-green-700">
            <Check size={14} />
          </span>
          <span>Done · +{existing?.coins_awarded}</span>
        </div>
      ) : (
        <div className="flex h-full flex-col space-y-2">
          <p className="min-h-[2.5rem] text-xs text-[var(--color-muted)]">
            A full night — roughly {SLEEP_HOUR_THRESHOLD}+ hours.
          </p>
          <Button
            onClick={submit}
            disabled={busy}
            className="mt-auto w-full"
          >
            {busy ? "Logging…" : "I slept well"}
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
