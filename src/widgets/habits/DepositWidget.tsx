import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { notifyCoinsChanged } from "@/lib/coinBus";
import { HABIT_MONTHLY_REWARDS } from "@/lib/coins";

type Kind = "savings" | "investment";

type Props = {
  userId: string;
  kind: Kind;
};

const LABELS: Record<Kind, { title: string; verb: string; placeholder: string }> = {
  savings: { title: "Savings", verb: "Saved", placeholder: "Amount saved" },
  investment: {
    title: "Investing",
    verb: "Invested",
    placeholder: "Amount invested",
  },
};

function monthStartUtc(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

// Savings + investing are monthly goals. Sum of deposits in the current
// calendar month is compared against target. Weekly rollup checks this every
// Sunday; once the target is met, 100 coins land and the award is dedup'd
// for the rest of the month.
export function DepositWidget({ userId, kind }: Props) {
  const goalsTable = kind === "savings" ? "savings_goals" : "investment_goals";
  const depositsTable =
    kind === "savings" ? "savings_deposits" : "investment_deposits";
  const rewardAmount =
    kind === "savings"
      ? HABIT_MONTHLY_REWARDS.savings
      : HABIT_MONTHLY_REWARDS.investing;

  const [target, setTarget] = useState<number | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [sumThisMonth, setSumThisMonth] = useState(0);
  const [amountInput, setAmountInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const monthStart = monthStartUtc();
    const { data: goal } = await supabase
      .from(goalsTable)
      .select("target_amount")
      .eq("user_id", userId)
      .maybeSingle();
    setTarget((goal as { target_amount: number | null } | null)?.target_amount ?? null);

    const { data: deposits } = await supabase
      .from(depositsTable)
      .select("amount")
      .eq("user_id", userId)
      .gte("date", monthStart);
    const sum = (deposits ?? []).reduce(
      (acc: number, r: { amount: number | string }) => acc + Number(r.amount),
      0,
    );
    setSumThisMonth(sum);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, kind]);

  async function saveTarget(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(targetInput);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    setError(null);
    const { error: upsertErr } = await supabase.from(goalsTable).upsert({
      user_id: userId,
      target_amount: n,
      cadence: "monthly",
    });
    setBusy(false);
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    setTargetInput("");
    load();
  }

  async function addDeposit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amountInput);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("log_deposit", {
      kind_in: kind,
      amount_in: n,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setAmountInput("");
    notifyCoinsChanged();
    load();
  }

  const labels = LABELS[kind];
  const progress =
    target && target > 0
      ? Math.min(100, Math.round((sumThisMonth / target) * 100))
      : 0;

  return (
    <WidgetCard
      title={labels.title}
      subtitle="Monthly"
      action={
        target !== null ? (
          <span className="text-xs tabular-nums text-[var(--color-muted)]">
            {sumThisMonth.toLocaleString()}/{target.toLocaleString()}
          </span>
        ) : null
      }
    >
      {target === null ? (
        <form onSubmit={saveTarget} className="space-y-2">
          <p className="text-xs text-[var(--color-muted)]">
            Set your monthly target. No currency attached — use whatever unit
            you're tracking.
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="Target per month"
              className="flex-1"
            />
            <Button type="submit" disabled={busy || !targetInput.trim()}>
              Set target
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="mb-3 h-1.5 rounded-pill bg-black/5 overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <form onSubmit={addDeposit} className="flex gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={labels.placeholder}
              className="flex-1"
            />
            <Button type="submit" disabled={busy || !amountInput.trim()}>
              {busy ? "…" : labels.verb}
            </Button>
          </form>
          <p className="mt-3 flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <Coins size={12} />+{rewardAmount} when you hit your monthly target
          </p>
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </WidgetCard>
  );
}
