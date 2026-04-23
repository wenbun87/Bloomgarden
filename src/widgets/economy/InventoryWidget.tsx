import { useEffect, useMemo, useState } from "react";
import { Coins, Crown, Droplet, Plus } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { supabase } from "@/lib/supabase";
import type { Planting, UserSeed } from "@/hooks/useGarden";
import { cn } from "@/lib/utils";

type Props = {
  plotCount: number;
  plantingsByPlot: Map<number, Planting>;
  seeds: UserSeed[];
  onChanged: () => void;
  className?: string;
};

export function InventoryWidget({
  plotCount,
  plantingsByPlot,
  seeds,
  onChanged,
  className,
}: Props) {
  const [plantingDialogPlot, setPlantingDialogPlot] = useState<number | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ticks once a minute — enough for the countdown to feel alive without
  // spamming re-renders. Grow times are measured in days.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const plots = useMemo(
    () => Array.from({ length: plotCount }, (_, i) => i),
    [plotCount],
  );

  async function plant(seed: UserSeed) {
    if (plantingDialogPlot === null) return;
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("plant_seed", {
      seed_id_in: seed.id,
      plot_index_in: plantingDialogPlot,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setPlantingDialogPlot(null);
    onChanged();
  }

  async function fertilize(planting: Planting) {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("apply_fertilizer", {
      planting_id_in: planting.id,
    });
    setBusy(false);
    if (rpcErr) setError(rpcErr.message);
    onChanged();
  }

  async function harvest(planting: Planting, action: "keep" | "sell") {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("harvest_planting", {
      planting_id_in: planting.id,
      action_in: action,
    });
    setBusy(false);
    if (rpcErr) setError(rpcErr.message);
    onChanged();
  }

  return (
    <WidgetCard
      title="Your garden"
      className={className}
      action={
        <span className="text-xs text-[var(--color-muted)]">
          {plantingsByPlot.size}/{plotCount} plots
        </span>
      }
    >
      <div className="grid grid-cols-4 gap-2">
        {plots.map((i) => {
          const planting = plantingsByPlot.get(i);
          return (
            <Plot
              key={i}
              index={i}
              planting={planting}
              now={now}
              onPlant={() => {
                setError(null);
                setPlantingDialogPlot(i);
              }}
              onFertilize={() => planting && fertilize(planting)}
              onHarvest={(action) => planting && harvest(planting, action)}
              busy={busy}
            />
          );
        })}
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <Dialog
        open={plantingDialogPlot !== null}
        onClose={() => setPlantingDialogPlot(null)}
        title={`Plant something — plot ${
          plantingDialogPlot !== null ? plantingDialogPlot + 1 : ""
        }`}
      >
        {seeds.length === 0 ? (
          <EmptyState
            title="Your bag is empty"
            hint="Buy seeds from the shop first."
          />
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {seeds.map((seed) => (
              <li key={seed.id}>
                <button
                  onClick={() => plant(seed)}
                  disabled={busy}
                  className="flex w-full items-center gap-3 rounded-card border border-[var(--color-border)] bg-white/60 px-3 py-2 text-left hover:bg-[var(--color-accent-soft)] disabled:opacity-50"
                >
                  <span className="text-2xl">{seed.species.sprite_emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {seed.species.name}
                      {seed.gifted_by && (
                        <span className="ml-2 text-xs text-[var(--color-accent)]">
                          gifted
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {seed.species.grow_days} days ·{" "}
                      {seed.species.harvest_type === "keep"
                        ? "display forever"
                        : `sells for ${seed.species.sell_value}`}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </WidgetCard>
  );
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "ready";
  const totalMinutes = Math.floor(ms / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function Plot({
  index,
  planting,
  now,
  onPlant,
  onFertilize,
  onHarvest,
  busy,
}: {
  index: number;
  planting: Planting | undefined;
  now: number;
  onPlant: () => void;
  onFertilize: () => void;
  onHarvest: (action: "keep" | "sell") => void;
  busy: boolean;
}) {
  // Empty plot
  if (!planting) {
    return (
      <button
        onClick={onPlant}
        className="group flex aspect-square items-center justify-center rounded-card border border-dashed border-[var(--color-border)] bg-white/40 text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]/50"
        aria-label={`Empty plot ${index + 1}`}
      >
        <Plus size={18} className="opacity-60 group-hover:opacity-100" />
      </button>
    );
  }

  const harvestMs = new Date(planting.harvests_at).getTime();
  const ready = planting.status === "growing" && harvestMs <= now;
  const kept = planting.status === "kept";
  const remainingLabel = formatCountdown(harvestMs - now);

  return (
    <div
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-card border text-center p-1.5",
        kept
          ? "border-amber-200/80 bg-amber-50/70"
          : ready
            ? "border-green-300/80 bg-green-50/70"
            : "border-[var(--color-border)] bg-white/70",
      )}
    >
      <span className="text-2xl leading-none">{planting.species.sprite_emoji}</span>
      <span className="truncate text-[10px] font-medium">
        {planting.species.name}
      </span>

      {kept && (
        <Crown size={10} className="absolute right-1 top-1 text-amber-500" />
      )}

      {!kept && !ready && (
        <>
          <span className="tabular-nums text-[10px] text-[var(--color-muted)]">
            {remainingLabel}
          </span>
          {planting.fertilizer_days < 3 && (
            <button
              onClick={onFertilize}
              disabled={busy}
              aria-label="Fertilize"
              title="Fertilize (15 coins, −1 day)"
              className="absolute right-1 top-1 text-[var(--color-muted)] hover:text-[var(--color-accent)] disabled:opacity-40"
            >
              <Droplet size={11} />
            </button>
          )}
        </>
      )}

      {ready && (
        <div className="mt-0.5 flex gap-1">
          {planting.species.harvest_type === "crop" && (
            <button
              onClick={() => onHarvest("sell")}
              disabled={busy}
              title={`Sell for ${planting.species.sell_value}`}
              className="flex items-center gap-0.5 rounded-pill bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] text-white disabled:opacity-50"
            >
              <Coins size={9} />
              {planting.species.sell_value}
            </button>
          )}
          <button
            onClick={() => onHarvest("keep")}
            disabled={busy}
            className="rounded-pill border border-[var(--color-border)] bg-white px-1.5 py-0.5 text-[10px] disabled:opacity-50"
          >
            Keep
          </button>
        </div>
      )}
    </div>
  );
}
