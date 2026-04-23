import { useState } from "react";
import { Check, Coins } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { StreakBadge } from "@/components/StreakBadge";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { HabitLog } from "@/hooks/useHabitsToday";
import { HABIT_WEEKLY_REWARDS } from "@/lib/coins";

type Props = {
  existing: HabitLog | undefined;
  streak: number;
  onChanged: () => void;
};

export function SocialWidget({ existing, streak, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggled = !!existing;
  const paidOut = (existing?.coins_awarded ?? 0) > 0;

  async function toggle() {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("set_social_this_week", {
      on_flag: !toggled,
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
      title="Social"
      subtitle="Weekly"
      action={<StreakBadge count={streak} />}
    >
      {toggled ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-green-100 text-green-700">
              <Check size={14} />
            </span>
            <span>
              Connected this week{paidOut ? ` · +${existing?.coins_awarded}` : ""}
            </span>
          </div>
          {!paidOut && (
            <button
              onClick={toggle}
              disabled={busy}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              Undo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-muted)]">
            A real call or hang with a friend this week.
          </p>
          <Button onClick={toggle} disabled={busy} className="w-full">
            {busy ? "Saving…" : "I connected with a friend"}
          </Button>
          <p className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <Coins size={12} />
            +{HABIT_WEEKLY_REWARDS.social} at Sunday rollup
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </WidgetCard>
  );
}
