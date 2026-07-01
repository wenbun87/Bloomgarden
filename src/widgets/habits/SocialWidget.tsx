import { useState } from "react";
import { Check, Coins } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { StreakBadge } from "@/components/StreakBadge";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { HabitLog } from "@/hooks/useHabitsToday";
import { HABIT_WEEKLY_REWARDS } from "@/lib/coins";

type Props = {
  // Today's social row, if it exists.
  existing: HabitLog | undefined;
  // Total count of social rows in the current week.
  weekCount: number;
  streak: number;
  onChanged: () => void;
};

export function SocialWidget({
  existing,
  weekCount,
  streak,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayLogged = !!existing;

  async function adjust(delta: 1 | -1) {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc(
      "adjust_social_this_week",
      { delta_in: delta },
    );
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    onChanged();
  }

  return (
    <WidgetCard
      title="Social"
      subtitle="Weekly"
      action={<StreakBadge count={streak} />}
    >
      {todayLogged ? (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-green-100 text-green-700">
              <Check size={14} />
            </span>
            <span>
              Connected today · {weekCount}{" "}
              {weekCount === 1 ? "day" : "days"} this week
            </span>
          </div>
          <button
            type="button"
            onClick={() => adjust(-1)}
            disabled={busy}
            className="self-start text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            Undo today
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-muted)]">
            {weekCount > 0
              ? `${weekCount} ${weekCount === 1 ? "day" : "days"} this week. Add today?`
              : "A real call or hang with a friend. Tap each day you connect."}
          </p>
          <Button onClick={() => adjust(1)} disabled={busy} className="w-full">
            {busy ? "Saving…" : "I connected with a friend"}
          </Button>
          <p className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <Coins size={12} />
            +{HABIT_WEEKLY_REWARDS.social} once at Sunday rollup
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </WidgetCard>
  );
}
