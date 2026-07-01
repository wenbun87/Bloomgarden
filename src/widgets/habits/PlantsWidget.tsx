import { useEffect, useMemo, useState } from "react";
import { Coins, X } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { notifyCoinsChanged } from "@/lib/coinBus";
import { weekStartUtc } from "@/lib/dates";
import { HABIT_WEEKLY_REWARDS, PLANTS_WEEKLY_GOAL } from "@/lib/coins";

type PlantRow = { id: string; plant_name: string; date: string };

type Props = { userId: string };

export function PlantsWidget({ userId }: Props) {
  const [thisWeek, setThisWeek] = useState<PlantRow[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  async function load() {
    const weekStart = weekStartUtc();
    const { data: week } = await supabase
      .from("plant_logs")
      .select("id, plant_name, date")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .order("created_at", { ascending: false });
    setThisWeek((week ?? []) as PlantRow[]);

    const { data: all } = await supabase
      .from("plant_logs")
      .select("plant_name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    const uniq = Array.from(
      new Set((all ?? []).map((r: any) => r.plant_name as string)),
    );
    setHistory(uniq);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const uniqueThisWeek = useMemo(() => {
    const set = new Set(thisWeek.map((r) => r.plant_name));
    return set;
  }, [thisWeek]);

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return [];
    return history
      .filter((n) => n.startsWith(q) && !uniqueThisWeek.has(n))
      .slice(0, 5);
  }, [history, name, uniqueThisWeek]);

  async function submit(value: string) {
    const v = value.trim().toLowerCase();
    if (!v) return;
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("log_plant", {
      plant_name_in: v,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setName("");
    notifyCoinsChanged();
    load();
  }

  async function remove(id: string) {
    const { error: delErr } = await supabase
      .from("plant_logs")
      .delete()
      .eq("id", id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    load();
  }

  const progress = Math.min(
    100,
    Math.round((uniqueThisWeek.size / PLANTS_WEEKLY_GOAL) * 100),
  );

  return (
    <WidgetCard
      title="Plants"
      subtitle="Weekly"
      action={
        <span className="text-xs tabular-nums text-[var(--color-muted)]">
          {uniqueThisWeek.size}/{PLANTS_WEEKLY_GOAL}
        </span>
      }
    >
      <div className="mb-3 h-1.5 rounded-pill bg-black/5 overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mb-2 text-xs text-[var(--color-muted)]">
        Eating 30+ plants a week is good for your gut's microbiome.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(name);
        }}
        className="relative flex gap-2"
      >
        <div className="relative flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="kale, cherry, basil…"
          />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-11 z-10 overflow-hidden rounded-card border border-[var(--color-border)] bg-white shadow-card">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => submit(s)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-accent-soft)]"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="submit" disabled={busy || !name.trim()}>
          Add
        </Button>
      </form>

      {uniqueThisWeek.size > 0 && (
        <>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="mt-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            {listOpen
              ? "Hide list"
              : `Show ${uniqueThisWeek.size} plant${uniqueThisWeek.size === 1 ? "" : "s"} this week`}
          </button>
          {listOpen && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {[...uniqueThisWeek].map((n) => {
                const first = thisWeek.find((r) => r.plant_name === n);
                return (
                  <li
                    key={n}
                    className="group flex items-center gap-1 rounded-pill bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs"
                  >
                    {n}
                    {first && (
                      <button
                        onClick={() => remove(first.id)}
                        className="opacity-0 group-hover:opacity-100"
                        aria-label={`Remove ${n}`}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <p className="mt-3 flex items-center gap-1 text-xs text-[var(--color-muted)]">
        <Coins size={12} />
        +{HABIT_WEEKLY_REWARDS.plants} at {PLANTS_WEEKLY_GOAL}+ unique species
      </p>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </WidgetCard>
  );
}
